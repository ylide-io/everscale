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
import {
	BROADCASTER_ADDRESS,
	DEV_BROADCASTER_ADDRESS,
	DEV_MAILER_ADDRESS,
	DEV_REGISTRY_ADDRESS,
	MAILER_ADDRESS,
	REGISTRY_ADDRESS,
} from '../misc/constants';
import { IEverscaleContentMessageBody, IEverscaleMessage, uint256ToAddress } from '../misc';
import { getContractMessagesQuery } from '../misc';
import { GqlSender } from '../misc/GqlSender';
import { initAsync, encrypt, generate_ephemeral, get_public_key } from '../encrypt';
import moment from 'moment';
import {
	decodeAddressToPublicKeyMessageBody,
	decodeBroadcastMessageBody,
	decodeContentMessageBody,
	decodePushMessageBody,
} from '../contracts/contractUtils';

export class EverscaleBlockchainController extends AbstractBlockchainController {
	ever: ProviderRpcClient;
	gql: GqlSender;

	readonly everscaleEncryptCore = initAsync();

	readonly MESSAGES_FETCH_LIMIT = 50;

	readonly mailerContractAddress: string;
	readonly broadcasterContractAddress: string;
	readonly registryContractAddress: string;

	private readonly mainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];

	constructor(
		options: {
			dev?: boolean;
			mailerContractAddress?: string;
			broadcasterContractAddress?: string;
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
			forceUseFallback: true,
			fallback: () =>
				EverscaleStandaloneClient.create({
					connection: options.dev
						? 'local'
						: {
								id: 1,
								group: 'mainnet',
								type: 'graphql',
								data: {
									local: false,
									endpoints: this.mainnetEndpoints,
								},
						  },
				}),
		});

		this.mailerContractAddress =
			options.mailerContractAddress || (options.dev ? DEV_MAILER_ADDRESS : MAILER_ADDRESS);
		this.broadcasterContractAddress =
			options.broadcasterContractAddress || (options.dev ? DEV_BROADCASTER_ADDRESS : BROADCASTER_ADDRESS);
		this.registryContractAddress =
			options.registryContractAddress || (options.dev ? DEV_REGISTRY_ADDRESS : REGISTRY_ADDRESS);
	}

	getDefaultMailerAddress() {
		return this.mailerContractAddress;
	}

	async getRecipientReadingRules(address: Uint256): Promise<any> {
		return [];
	}

	private async getPublicKeyByAddress(address: string): Promise<Uint8Array | null> {
		await core.ensureNekotonLoaded();
		const messages = await this.gqlQueryMessages(getContractMessagesQuery(address, this.registryContractAddress));
		if (messages.length) {
			return decodeAddressToPublicKeyMessageBody(messages[0].body);
		} else {
			return null;
		}
	}

	async extractPublicKeyFromAddress(address: string): Promise<PublicKey | null> {
		const rawKey = await this.getPublicKeyByAddress(':' + address.split(':')[1]);
		if (!rawKey) {
			return null;
		}
		return PublicKey.fromBytes(PublicKeyType.YLIDE, rawKey);
	}

	private async _retrieveMessageHistoryByTime(
		contractAddress: string,
		subject: ISourceSubject,
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		await core.ensureNekotonLoaded();
		if (!contractAddress) {
			contractAddress = this.getDefaultMailerAddress();
		}
		const events = await this.queryMessagesList(contractAddress, subject, limit, {
			fromDate: fromTimestamp,
			toDate: toTimestamp,
		});
		const result = events.map(m =>
			subject.type === BlockchainSourceSubjectType.RECIPIENT
				? this.formatPushMessage(m)
				: this.formatBroadcastMessage(subject.address!, m),
		);
		return result.filter(
			r =>
				(!fromTimestamp || r.blockchainMeta.block.timestamp > fromTimestamp) &&
				(!toTimestamp || r.blockchainMeta.block.timestamp <= toTimestamp),
		);
	}

	private async _retrieveMessageHistoryByBounds(
		contractAddress: string,
		subject: ISourceSubject,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		await core.ensureNekotonLoaded();
		const events = await this.queryMessagesList(contractAddress, subject, limit, {
			fromMessage: fromMessage?.blockchainMeta,
			toMessage: toMessage?.blockchainMeta,
		});
		const result = events.map(m =>
			subject.type === BlockchainSourceSubjectType.RECIPIENT
				? this.formatPushMessage(m)
				: this.formatBroadcastMessage(subject.address!, m),
		);
		const topBound = toMessage ? result.findIndex(r => r.msgId === toMessage.msgId) : -1;
		const bottomBound = fromMessage ? result.findIndex(r => r.msgId === fromMessage.msgId) : -1;
		return result.slice(bottomBound === -1 ? 0 : bottomBound + 1, topBound === -1 ? undefined : topBound);
	}

	async retrieveMessageHistoryByTime(
		recipient: Uint256 | null,
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		const mailerAddress = this.getDefaultMailerAddress();
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
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		const mailerAddress = this.getDefaultMailerAddress();
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
		fromTimestamp?: number,
		toTimestamp?: number,
		limit?: number,
	): Promise<IMessage[]> {
		const broadcasterAddress = this.broadcasterContractAddress;
		return this._retrieveMessageHistoryByTime(
			broadcasterAddress,
			{ type: BlockchainSourceSubjectType.AUTHOR, address: sender },
			fromTimestamp,
			toTimestamp,
			limit,
		);
	}

	async retrieveBroadcastHistoryByBounds(
		sender: Uint256 | null,
		fromMessage?: IMessage,
		toMessage?: IMessage,
		limit?: number,
	): Promise<IMessage[]> {
		const broadcasterAddress = this.broadcasterContractAddress;
		return this._retrieveMessageHistoryByBounds(
			broadcasterAddress,
			{ type: BlockchainSourceSubjectType.AUTHOR, address: sender },
			fromMessage,
			toMessage,
			limit,
		);
	}

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
		if (result.senderAddress.split(':')[1] !== msg.senderAddress.split(':')[1]) {
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
		let messages = await this.gqlQueryMessages(
			getContractMessagesQuery(fakeAddress, this.mailerContractAddress),
			{},
		);
		if (!messages.length) {
			messages = await this.gqlQueryMessages(
				getContractMessagesQuery(fakeAddress, this.broadcasterContractAddress),
				{},
			);
		}
		if (!messages.length) {
			return null;
		}
		let decodedChunks: { msg: IEverscaleMessage; body: IEverscaleContentMessageBody }[];
		try {
			decodedChunks = messages.map((m: IEverscaleMessage) => ({
				msg: m,
				body: decodeContentMessageBody(m.body),
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
		const body = decodePushMessageBody(message.body);

		return {
			isBroadcast: false,
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

	private formatBroadcastMessage(sender: Uint256, message: IEverscaleMessage): IMessage {
		const body = decodeBroadcastMessageBody(message.body);

		return {
			isBroadcast: true,

			msgId: body.msgId,
			createdAt: message.created_at,
			senderAddress: message.dst,
			recipientAddress: this.addressToUint256(message.dst.startsWith(':') ? `0${message.dst}` : message.dst),
			blockchain: 'everscale',

			key: new Uint8Array(),

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
		contractAddress: string,
		subject: ISourceSubject,
		limit?: number,
		filter?: {
			fromDate?: number;
			toDate?: number;
			fromMessage?: IEverscaleMessage;
			toMessage?: IEverscaleMessage;
		},
		nextPageAfterMessage?: IEverscaleMessage,
	): Promise<IEverscaleMessage[]> {
		const address = subject.address ? uint256ToAddress(subject.address, true, true) : null;

		const createdAt: {
			gt?: number;
			lt?: number;
		} = {};

		const createdLt: {
			gt?: BigInt;
			lt?: BigInt;
		} = {};

		if (nextPageAfterMessage && nextPageAfterMessage.created_lt) {
			createdLt.lt = BigInt(nextPageAfterMessage.created_lt);
		}
		if (filter?.fromMessage) {
			createdLt.gt = BigInt(filter.fromMessage.created_lt);
		}
		if (filter?.toMessage) {
			const v = BigInt(filter.toMessage.created_lt);
			if (createdLt.lt === undefined || v < createdLt.lt) {
				createdLt.lt = v;
			}
		}
		if (filter?.fromDate !== undefined) {
			createdAt.gt = filter?.fromDate;
		}
		if (filter?.toDate !== undefined) {
			createdAt.lt = filter?.toDate;
		}
		// ${filter?.fromMessage ? `, created_lt: { gt: "${filter.fromMessage.created_lt}" }` : ``}
		// ${filter?.toMessage ? `, created_lt: { lt: "${filter.toMessage.created_lt}" }` : ``}
		// created_lt: { ${nextPageAfterMessage?.created_lt ? `lt: "${nextPageAfterMessage.created_lt}"` : ''} }
		// ${filter?.fromDate ? `, created_at: { gt: ${filter.fromDate} }` : ``}
		// ${filter?.toDate ? `, created_at: { lt: ${filter.toDate} }` : ``}

		const _at = createdAt.gt !== undefined || createdAt.lt !== undefined;
		const _lt = createdLt.gt !== undefined || createdLt.lt !== undefined;
		let result: IEverscaleMessage[];
		if (subject.type === BlockchainSourceSubjectType.RECIPIENT) {
			result = await this.gqlQueryMessages(
				`
				query {
					messages(
					filter: {
						msg_type: { eq: 2 },
						${address ? `dst: { eq: "${address}" },` : ''}
						src: { eq: "${contractAddress}" },
						${
							_at
								? `created_at: { ${
										createdAt.lt !== undefined
											? `lt: "${moment.unix(createdAt.lt).utc().toISOString()}", `
											: ''
								  } ${
										createdAt.gt !== undefined
											? `gt: "${moment.unix(createdAt.gt).utc().toISOString()}", `
											: ''
								  } }, `
								: ''
						}
						${
							_lt
								? `created_lt: { ${
										createdLt.lt !== undefined ? `lt: "${'0x' + createdLt.lt.toString(16)}", ` : ''
								  } ${
										createdLt.gt !== undefined ? `gt: "${'0x' + createdLt.gt.toString(16)}", ` : ''
								  } }, `
								: ''
						}
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
		} else {
			result = await this.gqlQueryMessages(
				`
					query {
						messages(
						filter: {
							msg_type: { eq: 2 },
							${address ? `dst: { eq: "${address}" },` : ''}
							src: { eq: "${contractAddress}" },
							${
								_at
									? `created_at: { ${
											createdAt.lt !== undefined
												? `lt: "${moment.unix(createdAt.lt).utc().toISOString()}", `
												: ''
									  } ${
											createdAt.gt !== undefined
												? `gt: "${moment.unix(createdAt.gt).utc().toISOString()}", `
												: ''
									  } }, `
									: ''
							}
							${
								_lt
									? `created_lt: { ${
											createdLt.lt !== undefined
												? `lt: "${'0x' + createdLt.lt.toString(16)}", `
												: ''
									  } ${
											createdLt.gt !== undefined
												? `gt: "${'0x' + createdLt.gt.toString(16)}", `
												: ''
									  } }, `
									: ''
							}
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
		}

		if (limit && result.length === limit) {
			return result;
		} else {
			if (result.length === 0) {
				return [];
			} else {
				const after = await this.queryMessagesList(
					contractAddress,
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
					address,
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
	blockchainGroup: 'everscale',
};
