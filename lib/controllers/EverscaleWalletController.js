"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.everscaleWalletFactory = exports.EverscaleWalletController = void 0;
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
class EverscaleWalletController extends sdk_1.AbstractWalletController {
    blockchainController;
    constructor(blockchainController, options = {}) {
        super(blockchainController, options);
        this.blockchainController = blockchainController;
    }
    async signMagicString(magicString) {
        const me = await this.getAuthenticatedAccount();
        if (!me) {
            throw new Error(`Can't derive without auth`);
        }
        const result = await this.blockchainController.ever.signData({
            publicKey: me.publicKey.toHex(),
            data: smart_buffer_1.default.ofUTF8String(magicString).toBase64String(),
        });
        return (0, sdk_1.sha256)(smart_buffer_1.default.ofHexString(result.signatureHex).bytes);
    }
    // account block
    async getAuthenticatedAccount() {
        await this.blockchainController.ever.ensureInitialized();
        const providerState = await this.blockchainController.ever.getProviderState();
        if (providerState.permissions.accountInteraction) {
            return {
                blockchain: 'everscale',
                address: providerState.permissions.accountInteraction.address.toString(),
                publicKey: sdk_1.PublicKey.fromHexString(sdk_1.PublicKeyType.EVERSCALE_NATIVE, providerState.permissions.accountInteraction.publicKey),
            };
        }
        else {
            return null;
        }
    }
    async attachPublicKey(publicKey) {
        const me = await this.getAuthenticatedAccount();
        if (!me) {
            throw new Error('Not authorized');
        }
        await this.blockchainController.registryContract.attachPublicKey(me.address, publicKey);
    }
    async requestAuthentication() {
        const { accountInteraction } = await this.blockchainController.ever.requestPermissions({
            permissions: ['basic', 'accountInteraction'],
        });
        if (accountInteraction) {
            return {
                blockchain: 'everscale',
                address: accountInteraction.address.toString(),
                publicKey: sdk_1.PublicKey.fromHexString(sdk_1.PublicKeyType.EVERSCALE_NATIVE, accountInteraction.publicKey),
            };
        }
        else {
            throw new Error('Not authenticated');
        }
    }
    async disconnectAccount() {
        await this.blockchainController.ever.disconnect();
    }
    async publishMessage(me, contentData, recipients) {
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1 && recipients.length === 1) {
            const transaction = await this.blockchainController.mailerContract.sendSmallMail(me.address, uniqueId, recipients[0].address, recipients[0].messageKey.toBytes(), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = this.blockchainController.mailerContract.decodeContentMessageBody(contentMsg.body);
            return decodedEvent.msgId;
        }
        else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
            const transaction = await this.blockchainController.mailerContract.sendBulkMail(me.address, uniqueId, recipients.map(r => r.address), recipients.map(r => r.messageKey.toBytes()), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = this.blockchainController.mailerContract.decodeContentMessageBody(contentMsg.body);
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.blockchainController.mailerContract.buildHash(me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.blockchainController.mailerContract.sendMultipartMailPart(me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            for (let i = 0; i < recipients.length; i += 210) {
                const recs = recipients.slice(i, i + 210);
                await this.blockchainController.mailerContract.addRecipients(me.address, uniqueId, initTime, recs.map(r => r.address), recs.map(r => r.messageKey.toBytes()));
            }
            return msgId;
        }
    }
    async broadcastMessage(me, contentData) {
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1) {
            const transaction = await this.blockchainController.mailerContract.broadcastMail(me.address, uniqueId, chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = this.blockchainController.mailerContract.decodeContentMessageBody(contentMsg.body);
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.blockchainController.mailerContract.buildHash(me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.blockchainController.mailerContract.sendMultipartMailPart(me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            await this.blockchainController.mailerContract.broadcastMailHeader(me.address, uniqueId, initTime);
            return msgId;
        }
    }
    async decryptMessageKey(senderPublicKey, recipientAccount, encryptedKey) {
        if (senderPublicKey.type !== sdk_1.PublicKeyType.EVERSCALE_NATIVE) {
            throw new Error('EverWallet can only decrypt native encryption of EverWallet');
        }
        const { encData, nonce } = (0, sdk_1.unpackSymmetricalyEncryptedData)(encryptedKey);
        const decryptionResultBase64 = await this.blockchainController.ever.decryptData({
            algorithm: 'ChaCha20Poly1305',
            sourcePublicKey: senderPublicKey.toHex(),
            recipientPublicKey: recipientAccount.publicKey.toHex(),
            data: new smart_buffer_1.default(encData).toBase64String(),
            nonce: new smart_buffer_1.default(nonce).toBase64String(),
        });
        return smart_buffer_1.default.ofBase64String(decryptionResultBase64).bytes;
    }
}
exports.EverscaleWalletController = EverscaleWalletController;
exports.everscaleWalletFactory = {
    create: (options) => new EverscaleWalletController(options),
    isWalletAvailable: () => new everscale_inpage_provider_1.ProviderRpcClient().hasProvider(),
    blockchain: 'everscale',
    wallet: 'everwallet',
};
//# sourceMappingURL=EverscaleWalletController.js.map