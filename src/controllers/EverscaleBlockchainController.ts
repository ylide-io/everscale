import SmartBuffer from '@ylide/smart-buffer';
import { EverscaleStandaloneClient } from 'everscale-standalone-client';
import core from 'everscale-standalone-client/core';
import { Address, ProviderRpcClient } from 'everscale-inpage-provider';
import nacl from 'tweetnacl';
import {
	AbstractBlockchainController,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	MessageContentFailure,
	unpackSymmetricalyEncryptedData,
	IExtraEncryptionStrateryBulk,
	IExtraEncryptionStrateryEntry,
	MessageKey,
	PublicKey,
	PublicKeyType,
	packSymmetricalyEncryptedData,
	BlockchainControllerFactory,
	Uint256,
	hexToUint256,
	ISourceSubject,
	BlockchainSourceSubjectType,
} from '@ylide/sdk';
import { DEV_MAILER_ADDRESS, DEV_REGISTRY_ADDRESS, MAILER_ADDRESS, REGISTRY_ADDRESS } from '../misc/constants';
import { MailerContract, RegistryContract } from '../contracts';
import { IEverscaleContentMessageBody, IEverscaleMessage } from '../misc';
import { getContractMessagesQuery } from '../misc';
import { GqlSender } from '../misc/GqlSender';
import initSync, { encrypt, generate_ephemeral, get_public_key } from '@ylide/everscale-encrypt';
import moment from 'moment';

export class EverscaleBlockchainController extends AbstractBlockchainController {
	ever: ProviderRpcClient;
	gql: GqlSender;

	readonly everscaleEncryptCore = initSync();

	readonly MESSAGES_FETCH_LIMIT = 50;

	readonly mailerContract: MailerContract;
	readonly registryContract: RegistryContract;

	private readonly mainnetEndpoints = [
		'eri01.main.everos.dev',
		'gra01.main.everos.dev',
		'gra02.main.everos.dev',
		'lim01.main.everos.dev',
		'rbx01.main.everos.dev',
	];

	constructor(
		options: {
			dev?: boolean;
			mailerContractAddress?: string;
			registryContractAddress?: string;
			endpoints?: string[];
		} = {},
	) {
		super(options);

		if (options.endpoints) {
			this.gql = new GqlSender({
				endpoints: options.endpoints,
				local: false,
			});
		} else if (options.dev) {
			this.gql = new GqlSender({
				endpoints: ['localhost'],
				local: true,
			});
		} else {
			this.gql = new GqlSender({
				endpoints: this.mainnetEndpoints,
				local: false,
			});
		}

		this.ever = new ProviderRpcClient({
			fallback: () =>
				EverscaleStandaloneClient.create({
					connection: options.dev ? 'local' : 'mainnet',
				}),
		});

		this.mailerContract = new MailerContract(
			this,
			options.mailerContractAddress || (options.dev ? DEV_MAILER_ADDRESS : MAILER_ADDRESS),
		);
		this.registryContract = new RegistryContract(
			this,
			options.registryContractAddress || (options.dev ? DEV_REGISTRY_ADDRESS : REGISTRY_ADDRESS),
		);
	}

	getDefaultMailerAddress() {
		return this.mailerContract.contractAddress;
	}

	async getRecipientReadingRules(address: Uint256): Promise<any> {
		return [];
	}

	async extractPublicKeyFromAddress(address: string): Promise<PublicKey | null> {
		const rawKey = await this.registryContract.getPublicKeyByAddress(':' + address.split(':')[1]);
		if (!rawKey) {
			return null;
		}
		return PublicKey.fromBytes(PublicKeyType.YLIDE, rawKey);
	}

	private async _retrieveMessageHistoryByTime(
		mailerAddress: string,
		subject: ISourceSubject,
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		await core.ensureNekotonLoaded();
		if (!mailerAddress) {
			mailerAddress = this.getDefaultMailerAddress();
		}
		const events = await this.queryMessagesList(mailerAddress, subject, limit, {
			fromDate: fromTimestamp ? moment.unix(fromTimestamp).utc().toISOString() : undefined,
			toDate: toTimestamp ? moment.unix(toTimestamp).utc().toISOString() : undefined,
		});
		const result = events.map(m => this.formatPushMessage(m));
		return result.filter(
			r =>
				(!fromTimestamp || r.blockchainMeta.block.timestamp > fromTimestamp) &&
				(!toTimestamp || r.blockchainMeta.block.timestamp <= toTimestamp),
		);
	}

	private async _retrieveMessageHistoryByBounds(
		mailerAddress: string,
		subject: ISourceSubject,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		await core.ensureNekotonLoaded();
		const events = await this.queryMessagesList(mailerAddress, subject, limit, {
			fromMessage: fromMessage?.blockchainMeta,
			toMessage: toMessage?.blockchainMeta,
		});
		const result = events.map(m => this.formatPushMessage(m));
		const topBound = toMessage ? result.findIndex(r => r.msgId === toMessage.msgId) : -1;
		const bottomBound = fromMessage ? result.findIndex(r => r.msgId === fromMessage.msgId) : -1;
		return result.slice(bottomBound === -1 ? 0 : bottomBound + 1, topBound === -1 ? undefined : topBound);
	}

	async retrieveMessageHistoryByTime(
		recipient: Uint256 | null,
		mailerAddress?: string,
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		if (!mailerAddress) {
			mailerAddress = this.getDefaultMailerAddress();
		}
		return this._retrieveMessageHistoryByTime(
			mailerAddress,
			{ type: BlockchainSourceSubjectType.RECIPIENT, address: recipient },
			fromTimestamp,
			toTimestamp,
			limit,
		);
	}

	async retrieveMessageHistoryByBounds(
		recipient: Uint256 | null,
		mailerAddress?: string,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		if (!mailerAddress) {
			mailerAddress = this.getDefaultMailerAddress();
		}
		return this._retrieveMessageHistoryByBounds(
			mailerAddress,
			{ type: BlockchainSourceSubjectType.RECIPIENT, address: recipient },
			fromMessage,
			toMessage,
			limit,
		);
	}

	async retrieveBroadcastHistoryByTime(
		sender: Uint256 | null,
		mailerAddress?: string,
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		if (!mailerAddress) {
			mailerAddress = this.getDefaultMailerAddress();
		}
		return this._retrieveMessageHistoryByTime(
			mailerAddress,
			{ type: BlockchainSourceSubjectType.AUTHOR, address: sender },
			fromTimestamp,
			toTimestamp,
			limit,
		);
	}

	async retrieveBroadcastHistoryByBounds(
		sender: Uint256 | null,
		mailerAddress?: string,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		if (!mailerAddress) {
			mailerAddress = this.getDefaultMailerAddress();
		}
		return this._retrieveMessageHistoryByBounds(
			mailerAddress,
			{ type: BlockchainSourceSubjectType.AUTHOR, address: sender },
			fromMessage,
			toMessage,
			limit,
		);
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

	async gqlQueryMessages(query: string, variables: Record<string, any> = {}) {
		const data = await this.gqlQuery(query, variables);
		if (
			!data ||
			!data.data ||
			!data.data.messages ||
			!Array.isArray(data.data.messages) ||
			!data.data.messages.length
		) {
			return [];
		}
		return data.data.messages as IEverscaleMessage[];
	}

	private async gqlQuery(query: string, variables: Record<string, any> = {}) {
		return this.gql.send(
			JSON.stringify({
				query,
				variables,
			}),
		);
	}

	private convertMsgIdToAddress(msgId: string) {
		return `:${msgId}`;
	}

	async retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null> {
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
				reason: MessageContentFailure.NON_INTEGRITY_PARTS,
			};
		}
		return result;
	}

	async retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | IMessageCorruptedContent | null> {
		await core.ensureNekotonLoaded();
		const fakeAddress = this.convertMsgIdToAddress(msgId);
		const messages = await this.gqlQueryMessages(
			getContractMessagesQuery(fakeAddress, this.mailerContract.contractAddress),
			{},
		);
		if (!messages.length) {
			return null;
		}
		let decodedChunks: { msg: IEverscaleMessage; body: IEverscaleContentMessageBody }[];
		try {
			decodedChunks = messages.map((m: IEverscaleMessage) => ({
				msg: m,
				body: this.mailerContract.decodeContentMessageBody(m.body),
			}));
		} catch (err) {
			return {
				msgId,
				corrupted: true,
				chunks: messages.map((m: IEverscaleMessage) => ({ createdAt: m.created_at })),
				reason: MessageContentFailure.NON_DECRYPTABLE,
			};
		}
		const parts = decodedChunks[0].body.parts;
		const sender = decodedChunks[0].body.sender;
		if (!decodedChunks.every(t => t.body.parts === parts) || !decodedChunks.every(t => t.body.sender === sender)) {
			return {
				msgId,
				corrupted: true,
				chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
				reason: MessageContentFailure.NON_INTEGRITY_PARTS,
			};
		}
		for (let idx = 0; idx < parts; idx++) {
			if (!decodedChunks.find(d => d.body.partIdx === idx)) {
				return {
					msgId,
					corrupted: true,
					chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
					reason: MessageContentFailure.NOT_ALL_PARTS,
				};
			}
		}
		if (decodedChunks.length !== parts) {
			return {
				msgId,
				corrupted: true,
				chunks: decodedChunks.map(m => ({ createdAt: m.msg.created_at })),
				reason: MessageContentFailure.DOUBLED_PARTS,
			};
		}
		const sortedChunks = decodedChunks
			.sort((a, b) => {
				return a.body.partIdx - b.body.partIdx;
			})
			.map(m => m.body.content);
		const contentSize = sortedChunks.reduce((p, c) => p + c.length, 0);
		const buf = SmartBuffer.ofSize(contentSize);
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

	private formatPushMessage(message: IEverscaleMessage): IMessage {
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

	isAddressValid(address: string): boolean {
		if (address.length !== 66) {
			return false;
		} else if (!address.includes(':')) {
			return false;
		}

		const splitAddress = address.split(':');

		if (splitAddress[0] !== '0') {
			return false;
		}

		if (splitAddress[1].includes('_')) return false;

		const regExp = new RegExp('^[^\\W]+$');

		return regExp.test(splitAddress[1]);
	}

	// Query messages by interval sinceDate(excluded) - untilDate (excluded)
	private async queryMessagesList(
		mailerAddress: string,
		subject: ISourceSubject,
		limit?: number,
		filter?: {
			fromDate?: string;
			toDate?: string;
			fromMessage?: IEverscaleMessage;
			toMessage?: IEverscaleMessage;
		},
		nextPageAfterMessage?: IEverscaleMessage,
	): Promise<IEverscaleMessage[]> {
		const address = subject.address ? this.uint256ToAddress(subject.address, true, true) : null;

		const result = await this.gqlQueryMessages(
			`
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
		  `,
		);

		if (limit && result.length === limit) {
			return result;
		} else {
			if (result.length === 0) {
				return [];
			} else {
				const after = await this.queryMessagesList(
					mailerAddress,
					subject,
					limit ? limit - result.length : undefined,
					filter,
					result[result.length - 1],
				);
				return result.concat(after);
			}
		}
	}

	async extractNativePublicKeyFromAddress(addressStr: string): Promise<Uint8Array | null> {
		const nt = core.nekoton;
		await core.ensureNekotonLoaded();
		const address = new Address(addressStr);
		const boc = await this.ever.getFullContractState({ address });
		if (!boc.state) {
			return null;
		}
		try {
			const pk = nt.extractPublicKey(boc.state.boc);
			return pk ? SmartBuffer.ofHexString(pk).bytes : null;
		} catch (err) {
			return null;
		}
	}

	async decodeNativeKey(
		senderPublicKey: Uint8Array,
		recipientPublicKey: Uint8Array,
		key: Uint8Array,
	): Promise<Uint8Array> {
		try {
			const { encData, nonce } = unpackSymmetricalyEncryptedData(key);

			const decryptedText = await this.ever.decryptData({
				algorithm: 'ChaCha20Poly1305',
				data: new SmartBuffer(encData).toBase64String(),
				nonce: new SmartBuffer(nonce).toBase64String(),
				recipientPublicKey: new SmartBuffer(recipientPublicKey).toHexString(),
				sourcePublicKey: new SmartBuffer(senderPublicKey).toHexString(),
			});
			if (decryptedText) {
				return SmartBuffer.ofBase64String(decryptedText).bytes;
			} else {
				throw new Error('Error decrypting message text');
			}
		} catch (e) {
			throw e;
		}
	}

	async getExtraEncryptionStrategiesFromAddress(address: string): Promise<IExtraEncryptionStrateryEntry[]> {
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
		} else {
			return [];
		}
	}

	getSupportedExtraEncryptionStrategies(): string[] {
		return ['everscale-native'];
	}

	async prepareExtraEncryptionStrategyBulk(
		entries: IExtraEncryptionStrateryEntry[],
	): Promise<IExtraEncryptionStrateryBulk> {
		await core.ensureNekotonLoaded();
		const ephemeralSecret = generate_ephemeral();
		const ephemeralPublic = get_public_key(ephemeralSecret);
		return {
			addedPublicKey: {
				key: PublicKey.fromHexString(PublicKeyType.EVERSCALE_NATIVE, ephemeralPublic),
			},
			blockchain: 'everscale',
			type: 'everscale-native',
			data: {
				nativeEphemeralKeySecret: ephemeralSecret,
			},
		};
	}

	async executeExtraEncryptionStrategy(
		entries: IExtraEncryptionStrateryEntry[],
		bulk: IExtraEncryptionStrateryBulk,
		addedPublicKeyIndex: number | null,
		messageKey: Uint8Array,
	): Promise<MessageKey[]> {
		const nativeSenderPrivateKey = SmartBuffer.ofHexString(bulk.data.nativeEphemeralKeySecret);
		return entries.map(entry => {
			const recipientNativePublicKey = new SmartBuffer(entry.data.nativePublicKey);
			const nonce = new SmartBuffer(nacl.randomBytes(12));
			const encryptedKey = SmartBuffer.ofHexString(
				encrypt(
					nativeSenderPrivateKey.toHexString(),
					recipientNativePublicKey.toHexString(),
					new SmartBuffer(messageKey).toHexString(),
					nonce.toHexString(),
				),
			);
			const packedKey = packSymmetricalyEncryptedData(encryptedKey.bytes, nonce.bytes);
			return new MessageKey(addedPublicKeyIndex!, packedKey);
		});
	}

	addressToUint256(address: string): Uint256 {
		return hexToUint256(address.split(':')[1].toLowerCase());
	}

	uint256ToAddress(value: Uint256, withPrefix: boolean = true, nullPrefix: boolean = false): string {
		if (value.length !== 64) {
			throw new Error('Value must have 32-bytes');
		}
		return `${withPrefix ? (nullPrefix ? ':' : '0:') : ''}${value}`;
	}

	compareMessagesTime(a: IMessage, b: IMessage): number {
		if (a.createdAt === b.createdAt) {
			return 0;
		} else {
			return a.createdAt - b.createdAt;
		}
	}
}

export const everscaleBlockchainFactory: BlockchainControllerFactory = {
	create: (options?: any) => new EverscaleBlockchainController(options),
	blockchain: 'everscale',
};
