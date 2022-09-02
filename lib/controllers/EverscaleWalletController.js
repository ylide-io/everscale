"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.everscaleWalletFactory = exports.EverscaleWalletController = void 0;
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const everscale_standalone_client_1 = require("everscale-standalone-client");
const contracts_1 = require("../contracts");
const misc_1 = require("../misc");
const contractUtils_1 = require("../contracts/contractUtils");
class EverscaleWalletController extends sdk_1.AbstractWalletController {
    ever;
    mailerContract;
    broadcasterContract;
    registryContract;
    constructor(options = {}) {
        super(options);
        this.ever = new everscale_inpage_provider_1.ProviderRpcClient({
            fallback: () => everscale_standalone_client_1.EverscaleStandaloneClient.create({
                connection: options.dev ? 'local' : 'mainnet',
            }),
        });
        this.broadcasterContract = new contracts_1.MailerContract(this.ever, options.broadcasterContractAddress || (options.dev ? misc_1.DEV_BROADCASTER_ADDRESS : misc_1.BROADCASTER_ADDRESS));
        this.mailerContract = new contracts_1.MailerContract(this.ever, options.mailerContractAddress || (options.dev ? misc_1.DEV_MAILER_ADDRESS : misc_1.MAILER_ADDRESS));
        this.registryContract = new contracts_1.RegistryContract(this.ever, options.registryContractAddress || (options.dev ? misc_1.DEV_REGISTRY_ADDRESS : misc_1.REGISTRY_ADDRESS));
    }
    async ensureAccount(needAccount) {
        const me = await this.getAuthenticatedAccount();
        if (!me || me.address !== needAccount.address) {
            throw new Error(`Need ${needAccount.address} account, got from wallet ${me?.address}`);
        }
    }
    addressToUint256(address) {
        return (0, sdk_1.hexToUint256)(address.split(':')[1].toLowerCase());
    }
    async requestYlidePrivateKey(me) {
        throw new Error('Method not available.');
    }
    async signMagicString(account, magicString) {
        await this.ensureAccount(account);
        const me = await this.getAuthenticatedAccount();
        if (!me) {
            throw new Error(`Can't derive without auth`);
        }
        const result = await this.ever.signData({
            publicKey: me.publicKey.toHex(),
            data: smart_buffer_1.default.ofUTF8String(magicString).toBase64String(),
        });
        // @ts-ignore
        return (0, sdk_1.sha256)(smart_buffer_1.default.ofHexString(result.signatureHex || result.signature_hex).bytes);
    }
    // account block
    async getAuthenticatedAccount() {
        await this.ever.ensureInitialized();
        const providerState = await this.ever.getProviderState();
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
    async getCurrentBlockchain() {
        return 'everscale';
    }
    async attachPublicKey(account, publicKey) {
        await this.ensureAccount(account);
        await this.registryContract.attachPublicKey(account.address, publicKey);
    }
    async requestAuthentication() {
        const acc = await this.getAuthenticatedAccount();
        if (acc) {
            await this.disconnectAccount(acc);
        }
        const { accountInteraction } = await this.ever.requestPermissions({
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
    async disconnectAccount(account) {
        await this.ensureAccount(account);
        await this.ever.disconnect();
    }
    async publishMessage(me, contentData, recipients) {
        await this.ensureAccount(me);
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1 && recipients.length === 1) {
            const transaction = await this.mailerContract.sendSmallMail(me.address, uniqueId, recipients[0].address, recipients[0].messageKey.toBytes(), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = (0, contractUtils_1.decodeContentMessageBody)(contentMsg.body);
            return decodedEvent.msgId;
        }
        else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
            const transaction = await this.mailerContract.sendBulkMail(me.address, uniqueId, recipients.map(r => r.address), recipients.map(r => r.messageKey.toBytes()), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = (0, contractUtils_1.decodeContentMessageBody)(contentMsg.body);
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.mailerContract.buildHash(me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.mailerContract.sendMultipartMailPart(me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            for (let i = 0; i < recipients.length; i += 210) {
                const recs = recipients.slice(i, i + 210);
                await this.mailerContract.addRecipients(me.address, uniqueId, initTime, recs.map(r => r.address), recs.map(r => r.messageKey.toBytes()));
            }
            return msgId;
        }
    }
    async broadcastMessage(me, contentData) {
        await this.ensureAccount(me);
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1) {
            const transaction = await this.broadcasterContract.broadcastMail(me.address, uniqueId, chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = (0, contractUtils_1.decodeContentMessageBody)(contentMsg.body);
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.broadcasterContract.buildHash(me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.broadcasterContract.sendMultipartMailPart(me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            await this.broadcasterContract.broadcastMailHeader(me.address, uniqueId, initTime);
            return msgId;
        }
    }
    async decryptMessageKey(recipientAccount, senderPublicKey, encryptedKey) {
        if (senderPublicKey.type !== sdk_1.PublicKeyType.EVERSCALE_NATIVE) {
            throw new Error('EverWallet can only decrypt native encryption of EverWallet');
        }
        const { encData, nonce } = (0, sdk_1.unpackSymmetricalyEncryptedData)(encryptedKey);
        const decryptionResultBase64 = await this.ever.decryptData({
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
    blockchainGroup: 'everscale',
    wallet: 'everwallet',
};
//# sourceMappingURL=EverscaleWalletController.js.map