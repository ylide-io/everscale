"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.everscaleBlockchainFactory = exports.EverscaleBlockchainController = void 0;
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const everscale_standalone_client_1 = require("everscale-standalone-client");
const core_1 = __importDefault(require("everscale-standalone-client/core"));
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const sdk_1 = require("@ylide/sdk");
const constants_1 = require("../misc/constants");
const contracts_1 = require("../contracts");
const misc_1 = require("../misc");
const GqlSender_1 = require("../misc/GqlSender");
const everscale_encrypt_1 = __importStar(require("@ylide/everscale-encrypt"));
const moment_1 = __importDefault(require("moment"));
class EverscaleBlockchainController extends sdk_1.AbstractBlockchainController {
    ever;
    gql;
    everscaleEncryptCore = (0, everscale_encrypt_1.default)();
    MESSAGES_FETCH_LIMIT = 50;
    mailerContract;
    registryContract;
    mainnetEndpoints = [
        'eri01.main.everos.dev',
        'gra01.main.everos.dev',
        'gra02.main.everos.dev',
        'lim01.main.everos.dev',
        'rbx01.main.everos.dev',
    ];
    constructor(options = {}) {
        super(options);
        if (options.endpoints) {
            this.gql = new GqlSender_1.GqlSender({
                endpoints: options.endpoints,
                local: false,
            });
        }
        else if (options.dev) {
            this.gql = new GqlSender_1.GqlSender({
                endpoints: ['localhost'],
                local: true,
            });
        }
        else {
            this.gql = new GqlSender_1.GqlSender({
                endpoints: this.mainnetEndpoints,
                local: false,
            });
        }
        this.ever = new everscale_inpage_provider_1.ProviderRpcClient({
            fallback: () => everscale_standalone_client_1.EverscaleStandaloneClient.create({
                connection: options.dev ? 'local' : 'mainnet',
            }),
        });
        this.mailerContract = new contracts_1.MailerContract(this, options.mailerContractAddress || (options.dev ? constants_1.DEV_MAILER_ADDRESS : constants_1.MAILER_ADDRESS));
        this.registryContract = new contracts_1.RegistryContract(this, options.registryContractAddress || (options.dev ? constants_1.DEV_REGISTRY_ADDRESS : constants_1.REGISTRY_ADDRESS));
    }
    getDefaultMailerAddress() {
        return this.mailerContract.contractAddress;
    }
    async getRecipientReadingRules(address) {
        return [];
    }
    async extractPublicKeyFromAddress(address) {
        const rawKey = await this.registryContract.getPublicKeyByAddress(':' + address.split(':')[1]);
        if (!rawKey) {
            return null;
        }
        return sdk_1.PublicKey.fromBytes(sdk_1.PublicKeyType.YLIDE, rawKey);
    }
    async _retrieveMessageHistoryByTime(mailerAddress, subject, fromTimestamp, toTimestamp, limit) {
        await core_1.default.ensureNekotonLoaded();
        if (!mailerAddress) {
            mailerAddress = this.getDefaultMailerAddress();
        }
        const events = await this.queryMessagesList(mailerAddress, subject, limit, {
            fromDate: fromTimestamp ? moment_1.default.unix(fromTimestamp).utc().toISOString() : undefined,
            toDate: toTimestamp ? moment_1.default.unix(toTimestamp).utc().toISOString() : undefined,
        });
        const result = events.map(m => this.formatPushMessage(m));
        return result.filter(r => (!fromTimestamp || r.blockchainMeta.block.timestamp > fromTimestamp) &&
            (!toTimestamp || r.blockchainMeta.block.timestamp <= toTimestamp));
    }
    async _retrieveMessageHistoryByBounds(mailerAddress, subject, fromMessage, toMessage, limit) {
        await core_1.default.ensureNekotonLoaded();
        const events = await this.queryMessagesList(mailerAddress, subject, limit, {
            fromMessage: fromMessage?.blockchainMeta,
            toMessage: toMessage?.blockchainMeta,
        });
        const result = events.map(m => this.formatPushMessage(m));
        const topBound = toMessage ? result.findIndex(r => r.msgId === toMessage.msgId) : -1;
        const bottomBound = fromMessage ? result.findIndex(r => r.msgId === fromMessage.msgId) : -1;
        return result.slice(bottomBound === -1 ? 0 : bottomBound + 1, topBound === -1 ? undefined : topBound);
    }
    async retrieveMessageHistoryByTime(recipient, mailerAddress, fromTimestamp, toTimestamp, limit) {
        if (!mailerAddress) {
            mailerAddress = this.getDefaultMailerAddress();
        }
        return this._retrieveMessageHistoryByTime(mailerAddress, { type: sdk_1.BlockchainSourceSubjectType.RECIPIENT, address: recipient }, fromTimestamp, toTimestamp, limit);
    }
    async retrieveMessageHistoryByBounds(recipient, mailerAddress, fromMessage, toMessage, limit) {
        if (!mailerAddress) {
            mailerAddress = this.getDefaultMailerAddress();
        }
        return this._retrieveMessageHistoryByBounds(mailerAddress, { type: sdk_1.BlockchainSourceSubjectType.RECIPIENT, address: recipient }, fromMessage, toMessage, limit);
    }
    async retrieveBroadcastHistoryByTime(sender, mailerAddress, fromTimestamp, toTimestamp, limit) {
        if (!mailerAddress) {
            mailerAddress = this.getDefaultMailerAddress();
        }
        return this._retrieveMessageHistoryByTime(mailerAddress, { type: sdk_1.BlockchainSourceSubjectType.AUTHOR, address: sender }, fromTimestamp, toTimestamp, limit);
    }
    async retrieveBroadcastHistoryByBounds(sender, mailerAddress, fromMessage, toMessage, limit) {
        if (!mailerAddress) {
            mailerAddress = this.getDefaultMailerAddress();
        }
        return this._retrieveMessageHistoryByBounds(mailerAddress, { type: sdk_1.BlockchainSourceSubjectType.AUTHOR, address: sender }, fromMessage, toMessage, limit);
    }
    // // message history block
    // // Query messages by interval options.since (included) - options.to (excluded)
    // async retrieveMessageHistoryByDates(
    // 	recipientAddress: Uint256 | null,
    // 	options?: RetrievingMessagesOptions,
    // ): Promise<IMessage[]> {
    // 	await core.ensureNekotonLoaded();
    // 	console.log('ttt');
    // 	const fullMessages: IMessage[] = [];
    // 	const messages = await this.queryMessagesList(recipientAddress, 50, {
    // 		nextPageAfterMessage: options?.fromMessage,
    // 		messagesLimit: 50,
    // 	});
    // 	while (true) {
    // 		fullMessages.push(
    // 			...(await Promise.all(
    // 				messages.map(async m => {
    // 					if (m.id === options?.toMessage?.blockchainMeta.id) {
    // 						foundDuplicate = true;
    // 					}
    // 					const pushMessage = this.formatPushMessage(m);
    // 					const content = await this.retrieveMessageContentByMsgId(pushMessage.msgId);
    // 					if (content && !content.corrupted) {
    // 						pushMessage.isContentLoaded = true;
    // 						pushMessage.contentLink = content;
    // 					}
    // 					return pushMessage;
    // 				}),
    // 			)),
    // 		);
    // 		if (foundDuplicate) break;
    // 		if (messages.length < this.MESSAGES_FETCH_LIMIT) break;
    // 	}
    // 	return fullMessages;
    // }
    async gqlQueryMessages(query, variables = {}) {
        const data = await this.gqlQuery(query, variables);
        if (!data ||
            !data.data ||
            !data.data.messages ||
            !Array.isArray(data.data.messages) ||
            !data.data.messages.length) {
            return [];
        }
        return data.data.messages;
    }
    async gqlQuery(query, variables = {}) {
        return this.gql.send(JSON.stringify({
            query,
            variables,
        }));
    }
    convertMsgIdToAddress(msgId) {
        return `:${msgId}`;
    }
    async retrieveAndVerifyMessageContent(msg) {
        const result = await this.retrieveMessageContentByMsgId(msg.msgId);
        if (!result) {
            return null;
        }
        if (result.corrupted) {
            return result;
        }
        if (result.senderAddress !== msg.senderAddress) {
            return {
                msgId: msg.msgId,
                corrupted: true,
                chunks: [],
                reason: sdk_1.MessageContentFailure.NON_INTEGRITY_PARTS,
            };
        }
        return result;
    }
    async retrieveMessageContentByMsgId(msgId) {
        await core_1.default.ensureNekotonLoaded();
        const fakeAddress = this.convertMsgIdToAddress(msgId);
        const messages = await this.gqlQueryMessages((0, misc_1.getContractMessagesQuery)(fakeAddress, this.mailerContract.contractAddress), {});
        if (!messages.length) {
            return null;
        }
        let decodedChunks;
        try {
            decodedChunks = messages.map((m) => ({
                msg: m,
                body: this.mailerContract.decodeContentMessageBody(m.body),
            }));
        }
        catch (err) {
            return {
                msgId,
                corrupted: true,
                chunks: messages.map((m) => ({ createdAt: m.created_at })),
                reason: sdk_1.MessageContentFailure.NON_DECRYPTABLE,
            };
        }
        const parts = decodedChunks[0].body.parts;
        const sender = decodedChunks[0].body.sender;
        if (!decodedChunks.every(t => t.body.parts === parts) || !decodedChunks.every(t => t.body.sender === sender)) {
            return {
                msgId,
                corrupted: true,
                chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
                reason: sdk_1.MessageContentFailure.NON_INTEGRITY_PARTS,
            };
        }
        for (let idx = 0; idx < parts; idx++) {
            if (!decodedChunks.find(d => d.body.partIdx === idx)) {
                return {
                    msgId,
                    corrupted: true,
                    chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
                    reason: sdk_1.MessageContentFailure.NOT_ALL_PARTS,
                };
            }
        }
        if (decodedChunks.length !== parts) {
            return {
                msgId,
                corrupted: true,
                chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
                reason: sdk_1.MessageContentFailure.DOUBLED_PARTS,
            };
        }
        const sortedChunks = decodedChunks
            .sort((a, b) => {
            return a.body.partIdx - b.body.partIdx;
        })
            .map(m => m.body.content);
        const contentSize = sortedChunks.reduce((p, c) => p + c.length, 0);
        const buf = smart_buffer_1.default.ofSize(contentSize);
        for (const chunk of sortedChunks) {
            buf.writeBytes(chunk);
        }
        return {
            msgId,
            corrupted: false,
            storage: 'everscale',
            createdAt: Math.min(...decodedChunks.map(d => d.msg.created_at)),
            senderAddress: sender,
            parts,
            content: buf.bytes,
        };
    }
    formatPushMessage(message) {
        const body = this.mailerContract.decodePushMessageBody(message.body);
        return {
            msgId: body.msgId,
            createdAt: message.created_at,
            senderAddress: body.sender,
            recipientAddress: this.addressToUint256(message.dst.startsWith(':') ? `0${message.dst}` : message.dst),
            blockchain: 'everscale',
            key: body.key,
            isContentLoaded: false,
            isContentDecrypted: false,
            contentLink: null,
            decryptedContent: null,
            blockchainMeta: message,
            userspaceMeta: null,
        };
    }
    isAddressValid(address) {
        if (address.length !== 66) {
            return false;
        }
        else if (!address.includes(':')) {
            return false;
        }
        const splitAddress = address.split(':');
        if (splitAddress[0] !== '0') {
            return false;
        }
        if (splitAddress[1].includes('_'))
            return false;
        const regExp = new RegExp('^[^\\W]+$');
        return regExp.test(splitAddress[1]);
    }
    // Query messages by interval sinceDate(excluded) - untilDate (excluded)
    async queryMessagesList(mailerAddress, subject, limit, filter, nextPageAfterMessage) {
        const address = subject.address ? this.uint256ToAddress(subject.address, true, true) : null;
        const result = await this.gqlQueryMessages(`
			query {
				messages(
				filter: {
					msg_type: { eq: 2 },
					${address ? `dst: { eq: "${address}" },` : ''}
					src: { eq: "${mailerAddress}" },
					created_lt: { ${nextPageAfterMessage?.created_lt ? `lt: "${nextPageAfterMessage.created_lt}"` : ''} }
					${filter?.fromDate ? `, created_at: { gt: ${filter.fromDate} }` : ``}
					${filter?.toDate ? `, created_at: { lt: ${filter.toDate} }` : ``}
					${filter?.fromMessage ? `, created_lt: { gt: ${filter.fromMessage.created_lt} }` : ``}
					${filter?.toMessage ? `, created_lt: { lt: ${filter.toMessage.created_lt} }` : ``}
				}
				orderBy: [{path: "created_at", direction: DESC}]
				limit: ${Math.min(limit || this.MESSAGES_FETCH_LIMIT, this.MESSAGES_FETCH_LIMIT)}
				) {
				body
				id
				src
				created_at
				created_lt
				dst
				}
			}
		  `);
        if (limit && result.length === limit) {
            return result;
        }
        else {
            if (result.length === 0) {
                return [];
            }
            else {
                const after = await this.queryMessagesList(mailerAddress, subject, limit ? limit - result.length : undefined, filter, result[result.length - 1]);
                return result.concat(after);
            }
        }
    }
    async extractNativePublicKeyFromAddress(addressStr) {
        const nt = core_1.default.nekoton;
        await core_1.default.ensureNekotonLoaded();
        const address = new everscale_inpage_provider_1.Address(addressStr);
        const boc = await this.ever.getFullContractState({ address });
        if (!boc.state) {
            return null;
        }
        try {
            const pk = nt.extractPublicKey(boc.state.boc);
            return pk ? smart_buffer_1.default.ofHexString(pk).bytes : null;
        }
        catch (err) {
            return null;
        }
    }
    async decodeNativeKey(senderPublicKey, recipientPublicKey, key) {
        try {
            const { encData, nonce } = (0, sdk_1.unpackSymmetricalyEncryptedData)(key);
            const decryptedText = await this.ever.decryptData({
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
    }
    async getExtraEncryptionStrategiesFromAddress(address) {
        const native = await this.extractNativePublicKeyFromAddress(address);
        if (native) {
            return [
                {
                    ylide: false,
                    blockchain: 'everscale',
                    address: address,
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
        const ephemeralSecret = (0, everscale_encrypt_1.generate_ephemeral)();
        const ephemeralPublic = (0, everscale_encrypt_1.get_public_key)(ephemeralSecret);
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
            const encryptedKey = smart_buffer_1.default.ofHexString((0, everscale_encrypt_1.encrypt)(nativeSenderPrivateKey.toHexString(), recipientNativePublicKey.toHexString(), new smart_buffer_1.default(messageKey).toHexString(), nonce.toHexString()));
            const packedKey = (0, sdk_1.packSymmetricalyEncryptedData)(encryptedKey.bytes, nonce.bytes);
            return new sdk_1.MessageKey(addedPublicKeyIndex, packedKey);
        });
    }
    addressToUint256(address) {
        return (0, sdk_1.hexToUint256)(address.split(':')[1].toLowerCase());
    }
    uint256ToAddress(value, withPrefix = true, nullPrefix = false) {
        if (value.length !== 64) {
            throw new Error('Value must have 32-bytes');
        }
        return `${withPrefix ? (nullPrefix ? ':' : '0:') : ''}${value}`;
    }
    compareMessagesTime(a, b) {
        if (a.createdAt === b.createdAt) {
            return 0;
        }
        else {
            return a.createdAt - b.createdAt;
        }
    }
}
exports.EverscaleBlockchainController = EverscaleBlockchainController;
exports.everscaleBlockchainFactory = {
    create: (options) => new EverscaleBlockchainController(options),
    blockchain: 'everscale',
};
//# sourceMappingURL=EverscaleBlockchainController.js.map