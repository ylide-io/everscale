"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.everscaleBlockchainFactory = exports.EverscaleBlockchainController = void 0;
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const core_1 = __importDefault(require("everscale-standalone-client/core"));
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const sdk_1 = require("@ylide/sdk");
const misc_1 = require("../misc");
const encrypt_1 = require("../encrypt");
const EverscaleBlockchainReader_1 = require("./helpers/EverscaleBlockchainReader");
const EverscaleMailerV6Wrapper_1 = require("../contract-wrappers/EverscaleMailerV6Wrapper");
const EverscaleRegistryV2Wrapper_1 = require("../contract-wrappers/EverscaleRegistryV2Wrapper");
const EverscaleMailerV5Wrapper_1 = require("../contract-wrappers/EverscaleMailerV5Wrapper");
const EverscaleRegistryV1Wrapper_1 = require("../contract-wrappers/EverscaleRegistryV1Wrapper");
const messages_sources_1 = require("../messages-sources");
class EverscaleBlockchainController extends sdk_1.AbstractBlockchainController {
    blockchainReader;
    static mailerWrappers = {
        [misc_1.TVMMailerContractType.TVMMailerV5]: EverscaleMailerV5Wrapper_1.EverscaleMailerV5Wrapper,
        [misc_1.TVMMailerContractType.TVMMailerV6]: EverscaleMailerV6Wrapper_1.EverscaleMailerV6Wrapper,
    };
    static registryWrappers = {
        [misc_1.TVMRegistryContractType.TVMRegistryV1]: EverscaleRegistryV1Wrapper_1.EverscaleRegistryV1Wrapper,
        [misc_1.TVMRegistryContractType.TVMRegistryV2]: EverscaleRegistryV2Wrapper_1.EverscaleRegistryV2Wrapper,
    };
    mailers = [];
    broadcasters = [];
    registries = [];
    currentMailer;
    currentBroadcaster;
    currentRegistry;
    MESSAGES_FETCH_LIMIT = 50;
    mainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];
    constructor(options = {}) {
        super();
        this.blockchainReader = new EverscaleBlockchainReader_1.EverscaleBlockchainReader(options?.endpoints || this.mainnetEndpoints, options.dev || false);
        const contracts = options?.dev ? misc_1.EVERSCALE_LOCAL : misc_1.EVERSCALE_MAINNET;
        this.mailers = contracts.mailerContracts.map(link => ({
            link,
            wrapper: new EverscaleBlockchainController.mailerWrappers[link.type](this.blockchainReader),
        }));
        this.broadcasters = contracts.broadcasterContracts.map(link => ({
            link,
            wrapper: new EverscaleBlockchainController.mailerWrappers[link.type](this.blockchainReader),
        }));
        this.registries = contracts.registryContracts.map(link => ({
            link,
            wrapper: new EverscaleBlockchainController.registryWrappers[link.type](this.blockchainReader),
        }));
        const currentMailerLink = contracts.mailerContracts.find(c => c.id === contracts.currentMailerId);
        const currentBroadcasterLink = contracts.mailerContracts.find(c => c.id === contracts.currentBroadcasterId);
        const currentRegistryLink = contracts.registryContracts.find(c => c.id === contracts.currentRegistryId);
        this.currentMailer = {
            link: currentMailerLink,
            wrapper: new EverscaleBlockchainController.mailerWrappers[currentMailerLink.type](this.blockchainReader),
        };
        this.currentBroadcaster = {
            link: currentBroadcasterLink,
            wrapper: new EverscaleBlockchainController.mailerWrappers[currentBroadcasterLink.type](this.blockchainReader),
        };
        this.currentRegistry = {
            link: currentRegistryLink,
            wrapper: new EverscaleBlockchainController.registryWrappers[currentRegistryLink.type](this.blockchainReader),
        };
    }
    blockchainGroup() {
        return 'everscale';
    }
    blockchain() {
        return 'everscale';
    }
    isReadingBySenderAvailable() {
        return false;
    }
    defaultNameService() {
        return null;
    }
    async init() {
        // np
    }
    async getBalance(address) {
        const stringValue = await this.blockchainReader.ever.getBalance(new everscale_inpage_provider_1.Address(address));
        return {
            original: stringValue,
            numeric: Number(stringValue),
            string: stringValue,
            e18: stringValue,
        };
    }
    async getRecipientReadingRules(address) {
        return [];
    }
    async extractPublicKeyFromAddress(address) {
        return this.currentRegistry.wrapper.getPublicKeyByAddress(this.currentRegistry.link, address);
    }
    async extractPublicKeysHistoryByAddress(address) {
        const raw = (await Promise.all(this.registries.map(reg => reg.wrapper.getPublicKeysHistoryForAddress(reg.link, address)))).flat();
        raw.sort((a, b) => b.timestamp - a.timestamp);
        return raw;
    }
    isValidMsgId(msgId) {
        try {
            const parsed = (0, misc_1.decodeTvmMsgId)(msgId);
            return ((parsed.isBroadcast
                ? this.broadcasters.find(b => b.link.id === parsed.contractId)
                : this.mailers.find(m => m.link.id === parsed.contractId)) !== undefined);
        }
        catch (err) {
            return false;
        }
    }
    async getMessageByMsgId(msgId) {
        const parsed = (0, misc_1.decodeTvmMsgId)(msgId);
        const mailer = parsed.isBroadcast
            ? this.broadcasters.find(b => b.link.id === parsed.contractId)
            : this.mailers.find(m => m.link.id === parsed.contractId);
        if (!mailer) {
            throw new Error(`Unknown contract ${parsed.contractId}`);
        }
        if (parsed.isBroadcast) {
            return await mailer.wrapper.getBroadcastPushEvent(mailer.link, parsed.lt);
        }
        else {
            return await mailer.wrapper.getMailPushEvent(mailer.link, parsed.lt);
        }
    }
    getBlockchainSourceSubjects(subject) {
        if (subject.type === sdk_1.BlockchainSourceType.BROADCAST) {
            return this.broadcasters.map(m => ({
                ...subject,
                blockchain: this.blockchain(),
                id: `tvm-${this.blockchain()}-broadcaster-${String(m.link.id)}`,
            }));
        }
        else {
            return this.mailers.map(m => ({
                ...subject,
                blockchain: this.blockchain(),
                id: `tvm-${this.blockchain()}-mailer-${String(m.link.id)}`,
            }));
        }
    }
    ininiateMessagesSource(subject) {
        let mailer;
        if (subject.type === sdk_1.BlockchainSourceType.BROADCAST) {
            mailer = this.broadcasters.find(m => `tvm-${this.blockchain()}-broadcaster-${String(m.link.id)}` === subject.id);
        }
        else {
            mailer = this.mailers.find(m => `tvm-${this.blockchain()}-mailer-${String(m.link.id)}` === subject.id);
        }
        if (!mailer) {
            throw new Error('Unknown subject');
        }
        if (subject.type === sdk_1.BlockchainSourceType.DIRECT && subject.sender) {
            throw new Error('Sender is not supported for direct messages request in TVM');
        }
        if (mailer.wrapper instanceof EverscaleMailerV6Wrapper_1.EverscaleMailerV6Wrapper) {
            return new messages_sources_1.EverscaleMailerV6Source(this, mailer.link, mailer.wrapper, subject);
        }
        else {
            return new messages_sources_1.EverscaleMailerV5Source(this, mailer.link, mailer.wrapper, subject);
        }
    }
    async retrieveMessageContent(msg) {
        const decodedMsgId = (0, misc_1.decodeTvmMsgId)(msg.msgId);
        const mailer = (decodedMsgId.isBroadcast ? this.broadcasters : this.mailers).find(m => m.link.id === decodedMsgId.contractId);
        if (!mailer) {
            throw new Error('This message does not belongs to this blockchain controller');
        }
        return mailer.wrapper.retrieveMessageContent(mailer.link, msg);
    }
    isAddressValid(address) {
        return (0, misc_1.isTVMAddressValid)(address);
    }
    // Query messages by interval sinceDate(excluded) - untilDate (excluded)
    async extractNativePublicKeyFromAddress(addressStr) {
        return await this.blockchainReader.operation(async (ever, gql, core) => {
            const address = new everscale_inpage_provider_1.Address(addressStr);
            const boc = await ever.getFullContractState({ address });
            if (!boc.state) {
                return null;
            }
            try {
                const pk = core.extractPublicKey(boc.state.boc);
                return pk ? smart_buffer_1.default.ofHexString(pk).bytes : null;
            }
            catch (err) {
                return null;
            }
        });
    }
    async decodeNativeKey(senderPublicKey, recipientPublicKey, key) {
        return await this.blockchainReader.operation(async (ever, gql, core) => {
            try {
                const { encData, nonce } = (0, sdk_1.unpackSymmetricalyEncryptedData)(key);
                const decryptedText = await ever.decryptData({
                    algorithm: 'ChaCha20Poly1305',
                    data: new smart_buffer_1.default(encData).toBase64String(),
                    nonce: new smart_buffer_1.default(nonce).toBase64String(),
                    recipientPublicKey: new smart_buffer_1.default(recipientPublicKey).toHexString(),
                    sourcePublicKey: new smart_buffer_1.default(senderPublicKey).toHexString(),
                });
                if (decryptedText) {
                    return smart_buffer_1.default.ofBase64String(decryptedText).bytes;
                }
                else {
                    throw new Error('Error decrypting message text');
                }
            }
            catch (e) {
                throw e;
            }
        });
    }
    async getExtraEncryptionStrategiesFromAddress(address) {
        const native = await this.extractNativePublicKeyFromAddress(address);
        if (native) {
            return [
                {
                    ylide: false,
                    blockchain: 'everscale',
                    address,
                    type: 'everscale-native',
                    data: {
                        nativePublicKey: native,
                    },
                },
            ];
        }
        else {
            return [];
        }
    }
    getSupportedExtraEncryptionStrategies() {
        return ['everscale-native'];
    }
    async prepareExtraEncryptionStrategyBulk(entries) {
        await core_1.default.ensureNekotonLoaded();
        const ephemeralSecret = (0, encrypt_1.generate_ephemeral)();
        const ephemeralPublic = (0, encrypt_1.get_public_key)(ephemeralSecret);
        return {
            addedPublicKey: {
                key: sdk_1.PublicKey.fromHexString(sdk_1.PublicKeyType.EVERSCALE_NATIVE, ephemeralPublic),
            },
            blockchain: 'everscale',
            type: 'everscale-native',
            data: {
                nativeEphemeralKeySecret: ephemeralSecret,
            },
        };
    }
    async executeExtraEncryptionStrategy(entries, bulk, addedPublicKeyIndex, messageKey) {
        const nativeSenderPrivateKey = smart_buffer_1.default.ofHexString(bulk.data.nativeEphemeralKeySecret);
        return entries.map(entry => {
            const recipientNativePublicKey = new smart_buffer_1.default(entry.data.nativePublicKey);
            const nonce = new smart_buffer_1.default(tweetnacl_1.default.randomBytes(12));
            const encryptedKey = smart_buffer_1.default.ofHexString((0, encrypt_1.encrypt)(nativeSenderPrivateKey.toHexString(), recipientNativePublicKey.toHexString(), new smart_buffer_1.default(messageKey).toHexString(), nonce.toHexString()));
            const packedKey = (0, sdk_1.packSymmetricalyEncryptedData)(encryptedKey.bytes, nonce.bytes);
            return new sdk_1.MessageKey(addedPublicKeyIndex, packedKey);
        });
    }
    addressToUint256(address) {
        return (0, misc_1.everscaleAddressToUint256)(address);
    }
    compareMessagesTime(a, b) {
        return a.createdAt - b.createdAt;
    }
}
exports.EverscaleBlockchainController = EverscaleBlockchainController;
exports.everscaleBlockchainFactory = {
    create: async (options) => new EverscaleBlockchainController(options),
    blockchain: 'everscale',
    blockchainGroup: 'everscale',
};
//# sourceMappingURL=EverscaleBlockchainController.js.map