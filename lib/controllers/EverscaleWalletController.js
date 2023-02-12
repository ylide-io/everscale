"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.everscaleWalletFactory = exports.EverscaleWalletController = void 0;
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const misc_1 = require("../misc");
const EverscaleBlockchainController_1 = require("./EverscaleBlockchainController");
const EverscaleBlockchainReader_1 = require("./helpers/EverscaleBlockchainReader");
class EverscaleWalletController extends sdk_1.AbstractWalletController {
    blockchainReader;
    currentMailer;
    currentBroadcaster;
    currentRegistry;
    mainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];
    lastCurrentAccount = null;
    // on(event: WalletEvent.ACCOUNT_CHANGED, fn: (newAccount: IGenericAccount) => void, context?: any): this;
    // on(event: WalletEvent.BLOCKCHAIN_CHANGED, fn: (newBlockchain: string) => void, context?: any): this;
    // on(event: WalletEvent.LOGIN, fn: (newAccount: IGenericAccount) => void, context?: any): this;
    // on(event: WalletEvent.LOGOUT, fn: () => void, context?: any): this;
    constructor(options = {}) {
        super(options);
        this.onSwitchAccountRequest = options?.onSwitchAccountRequest || null;
        this.blockchainReader = new EverscaleBlockchainReader_1.EverscaleBlockchainReader(options?.endpoints || this.mainnetEndpoints, options.dev || false);
        const contracts = options?.dev ? misc_1.EVERSCALE_LOCAL : misc_1.EVERSCALE_MAINNET;
        const currentMailerLink = contracts.mailerContracts.find(c => c.id === contracts.currentMailerId);
        const currentBroadcasterLink = contracts.mailerContracts.find(c => c.id === contracts.currentBroadcasterId);
        const currentRegistryLink = contracts.registryContracts.find(c => c.id === contracts.currentRegistryId);
        this.currentMailer = {
            link: currentMailerLink,
            wrapper: new EverscaleBlockchainController_1.EverscaleBlockchainController.mailerWrappers[currentMailerLink.type](this.blockchainReader),
        };
        this.currentBroadcaster = {
            link: currentBroadcasterLink,
            wrapper: new EverscaleBlockchainController_1.EverscaleBlockchainController.mailerWrappers[currentBroadcasterLink.type](this.blockchainReader),
        };
        this.currentRegistry = {
            link: currentRegistryLink,
            wrapper: new EverscaleBlockchainController_1.EverscaleBlockchainController.registryWrappers[currentRegistryLink.type](this.blockchainReader),
        };
    }
    blockchainGroup() {
        return 'everscale';
    }
    wallet() {
        return 'everwallet';
    }
    isMultipleAccountsSupported() {
        return false;
    }
    async init() {
        await this.getAuthenticatedAccount();
        const logoutSubscription = await this.blockchainReader.ever.subscribe('loggedOut');
        logoutSubscription.on('data', () => this.emit(sdk_1.WalletEvent.LOGOUT));
        const networkSubscription = await this.blockchainReader.ever.subscribe('networkChanged');
        networkSubscription.on('data', data => {
            // tslint:disable-next-line
            console.log('networkSubscription data: ', data);
        });
        const permissionsSubscription = await this.blockchainReader.ever.subscribe('permissionsChanged');
        permissionsSubscription.on('data', data => {
            const oldAccount = this.lastCurrentAccount;
            if (data.permissions.accountInteraction) {
                this.lastCurrentAccount = {
                    blockchain: 'everscale',
                    address: data.permissions.accountInteraction.address.toString(),
                    publicKey: sdk_1.PublicKey.fromHexString(sdk_1.PublicKeyType.EVERSCALE_NATIVE, data.permissions.accountInteraction.publicKey),
                };
                if (oldAccount) {
                    this.emit(sdk_1.WalletEvent.ACCOUNT_CHANGED, this.lastCurrentAccount);
                }
                else {
                    this.emit(sdk_1.WalletEvent.LOGIN, this.lastCurrentAccount);
                }
            }
            else {
                if (oldAccount) {
                    this.emit(sdk_1.WalletEvent.LOGOUT);
                }
            }
        });
    }
    async ensureAccount(needAccount) {
        let me = await this.getAuthenticatedAccount();
        if (!me || me.address !== needAccount.address) {
            await this.switchAccountRequest(me, needAccount);
            me = await this.getAuthenticatedAccount();
        }
        if (!me || me.address !== needAccount.address) {
            throw new sdk_1.YlideError(sdk_1.YlideErrorType.ACCOUNT_UNREACHABLE, { currentAccount: me, needAccount });
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
        const result = await this.blockchainReader.ever.signData({
            publicKey: me.publicKey.toHex(),
            data: smart_buffer_1.default.ofUTF8String(magicString).toBase64String(),
        });
        // @ts-ignore
        return (0, sdk_1.sha256)(smart_buffer_1.default.ofHexString(result.signatureHex || result.signature_hex).bytes);
    }
    // account block
    async getAuthenticatedAccount() {
        await this.blockchainReader.ever.ensureInitialized();
        const providerState = await this.blockchainReader.ever.getProviderState();
        if (providerState.permissions.accountInteraction) {
            this.lastCurrentAccount = {
                blockchain: 'everscale',
                address: providerState.permissions.accountInteraction.address.toString(),
                publicKey: sdk_1.PublicKey.fromHexString(sdk_1.PublicKeyType.EVERSCALE_NATIVE, providerState.permissions.accountInteraction.publicKey),
            };
            return this.lastCurrentAccount;
        }
        else {
            this.lastCurrentAccount = null;
            return null;
        }
    }
    async getCurrentBlockchain() {
        return 'everscale';
    }
    async attachPublicKey(me, publicKey, keyVersion = sdk_1.YlidePublicKeyVersion.KEY_V2, registrar = sdk_1.ServiceCode.SDK, options) {
        await this.ensureAccount(me);
        await this.currentRegistry.wrapper.attachPublicKey(this.currentRegistry.link, me.address, {
            keyVersion,
            publicKey: sdk_1.PublicKey.fromBytes(sdk_1.PublicKeyType.YLIDE, publicKey),
            timestamp: Math.floor(Date.now() / 1000),
            registrar,
        });
    }
    async requestAuthentication() {
        const acc = await this.getAuthenticatedAccount();
        if (acc) {
            await this.disconnectAccount(acc);
        }
        const { accountInteraction } = await this.blockchainReader.ever.requestPermissions({
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
        await this.blockchainReader.ever.disconnect();
    }
    async sendMail(me, contentData, recipients) {
        await this.ensureAccount(me);
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1 && recipients.length === 1) {
            const transaction = await this.currentMailer.wrapper.sendSmallMail(this.currentMailer.link, me.address, uniqueId, recipients[0].address, recipients[0].messageKey.toBytes(), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = 'yappy';
            return decodedEvent.msgId;
        }
        else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
            const transaction = await this.currentMailer.wrapper.sendBulkMail(this.currentMailer.link, me.address, uniqueId, recipients.map(r => r.address), recipients.map(r => r.messageKey.toBytes()), chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = 'yappy';
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.currentMailer.wrapper.buildHash(this.currentMailer.link, me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.currentMailer.wrapper.sendMessageContentPart(this.currentMailer.link, me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            for (let i = 0; i < recipients.length; i += 210) {
                const recs = recipients.slice(i, i + 210);
                await this.currentMailer.wrapper.addRecipients(this.currentMailer.link, me.address, uniqueId, initTime, recs.map(r => r.address), recs.map(r => r.messageKey.toBytes()));
            }
            return msgId;
        }
    }
    async sendBroadcast(me, contentData) {
        await this.ensureAccount(me);
        const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
        const chunks = sdk_1.MessageChunks.splitMessageChunks(contentData);
        if (chunks.length === 1) {
            const transaction = await this.currentBroadcaster.wrapper.sendBroadcast(this.currentBroadcaster.link, me.address, uniqueId, chunks[0]);
            const om = transaction.childTransaction.outMessages;
            const contentMsg = om.length ? om[0] : null;
            if (!contentMsg || !contentMsg.body) {
                throw new Error('Content event was not found');
            }
            const decodedEvent = 'yappy'; // decodeContentMessageBody(contentMsg.body!);
            return decodedEvent.msgId;
        }
        else {
            const initTime = Math.floor(Date.now() / 1000);
            const msgId = await this.currentBroadcaster.wrapper.buildHash(this.currentBroadcaster.link, me.publicKey.bytes, uniqueId, initTime);
            for (let i = 0; i < chunks.length; i++) {
                await this.currentBroadcaster.wrapper.sendMessageContentPart(this.currentBroadcaster.link, me.address, uniqueId, initTime, chunks.length, i, chunks[i]);
            }
            await this.currentBroadcaster.wrapper.sendBroadcastHeader(this.currentBroadcaster.link, me.address, uniqueId, initTime);
            return msgId;
        }
    }
    async decryptMessageKey(recipientAccount, senderPublicKey, encryptedKey) {
        if (senderPublicKey.type !== sdk_1.PublicKeyType.EVERSCALE_NATIVE) {
            throw new Error('EverWallet can only decrypt native encryption of EverWallet');
        }
        const { encData, nonce } = (0, sdk_1.unpackSymmetricalyEncryptedData)(encryptedKey);
        const decryptionResultBase64 = await this.blockchainReader.ever.decryptData({
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
    create: async (options) => new EverscaleWalletController(options),
    isWalletAvailable: () => new everscale_inpage_provider_1.ProviderRpcClient().hasProvider(),
    blockchainGroup: 'everscale',
    wallet: 'everwallet',
};
//# sourceMappingURL=EverscaleWalletController.js.map