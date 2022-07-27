import SmartBuffer from '@ylide/smart-buffer';
import { EverscaleStandaloneClient } from 'everscale-standalone-client';
import core from 'everscale-standalone-client/core';
import { Address, ProviderRpcClient } from 'everscale-inpage-provider';
import nacl from 'tweetnacl';
import {
	AbstractBlockchainController,
	IMessage,
	RetrievingMessagesOptions,
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
} from '@ylide/sdk';
import { DEV_MAILER_ADDRESS, DEV_REGISTRY_ADDRESS, MAILER_ADDRESS, REGISTRY_ADDRESS } from '../misc/constants';
import { MailerContract, RegistryContract } from '../contracts';
import { IEverscaleContentMessageBody, IEverscaleMessage } from '../misc';
import { getContractMessagesQuery } from '../misc';
import { GqlSender } from '../misc/GqlSender';
import initSync, { encrypt, generate_ephemeral, get_public_key } from '@ylide/everscale-encrypt';

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

	async getRecipientReadingRules(address: string): Promise<any> {
		return [];
	}

	async extractAddressFromPublicKey(publicKey: PublicKey): Promise<string | null> {
		return this.registryContract.getAddressByPublicKey(publicKey.bytes);
	}

	async extractPublicKeyFromAddress(address: string): Promise<PublicKey | null> {
		const rawKey = await this.registryContract.getPublicKeyByAddress(address);
		if (!rawKey) {
			return null;
		}
		return PublicKey.fromBytes(PublicKeyType.YLIDE, rawKey);
	}

	// message history block
	// Query messages by interval options.since (included) - options.to (excluded)
	async retrieveMessageHistoryByDates(
		recipientAddress: string,
		options?: RetrievingMessagesOptions,
	): Promise<IMessage[]> {
		await core.ensureNekotonLoaded();
		const sinceDate = options?.since?.getTime() ? options?.since?.getTime() - 1 : null;
		let untilDate = options?.to?.getTime() || null;

		const fullMessages: IMessage[] = [];

		while (true) {
			const messages = await this.queryMessagesList(recipientAddress, sinceDate, untilDate, {
				nextPageAfterMessage: options?.nextPageAfterMessage,
				messagesLimit: options?.messagesLimit,
			});

			if (!messages.length) break;

			let foundDuplicate = false;

			fullMessages.push(
				...(await Promise.all(
					messages.map(async m => {
						if (m.id === options?.firstMessageIdToStopSearching) {
							foundDuplicate = true;
						}
						const pushMessage = this.formatPushMessage(m);
						const content = await this.retrieveMessageContentByMsgId(pushMessage.msgId);
						if (content && !content.corrupted) {
							pushMessage.isContentLoaded = true;
							pushMessage.contentLink = content;
						}
						return pushMessage;
					}),
				)),
			);

			if (foundDuplicate) break;
			if (messages.length < this.MESSAGES_FETCH_LIMIT) break;

			untilDate = messages[0].created_at * 1000;
		}

		return fullMessages;
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
			recipientAddress: message.dst.startsWith(':') ? `0${message.dst}` : message.dst,
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
		recipientAddress: string,
		sinceDate: number | null,
		untilDate: number | null,
		options: {
			messagesLimit?: number;
			nextPageAfterMessage?: IMessage;
		},
	) {
		const receiverAddress = recipientAddress;
		if (!receiverAddress) throw new Error('No receiver address');
		const addressValue = receiverAddress.slice(1);

		const greaterThen = sinceDate !== null ? `gt: ${sinceDate / 1000}` : '';
		const lessThen = untilDate !== null ? `, lt: ${untilDate / 1000}` : '';

		const createdAtString = `{ ${greaterThen}${lessThen} }`;

		return await this.gqlQueryMessages(
			`
		query {
			messages(
			  filter: {
				msg_type: { eq: 2 },
				dst: { eq: "${addressValue}" },
				src: { eq: "${this.mailerContract.contractAddress}" },
				created_at: ${createdAtString}
				created_lt: { ${
					options?.nextPageAfterMessage?.blockchainMeta.created_lt
						? `lt: "${options.nextPageAfterMessage.blockchainMeta.created_lt}"`
						: ''
				} }
			  }
			  orderBy: [{path: "created_at", direction: DESC}]
			  limit: ${options?.messagesLimit || this.MESSAGES_FETCH_LIMIT}
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

	uint256ToAddress(value: Uint8Array, withPrefix: boolean = true): string {
		if (value.length !== 32) {
			throw new Error('Value must have 32-bytes');
		}
		return `${withPrefix ? '0:' : ''}${new SmartBuffer(value).toHexString()}`;
	}
}

export const everscaleBlockchainFactory: BlockchainControllerFactory = {
	create: (options?: any) => new EverscaleBlockchainController(options),
	blockchain: 'everscale',
};
