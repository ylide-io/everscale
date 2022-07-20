import SmartBuffer from '@ylide/smart-buffer';
import { EverscaleStandaloneClient } from 'everscale-standalone-client';
import core from 'everscale-standalone-client/core';
import { ProviderRpcClient } from 'everscale-inpage-provider';

import {
	AbstractReadingController,
	IMessage,
	RetrievingMessagesOptions,
	IGenericAccount,
	IMessageContent,
	IMessageCorruptedContent,
	MessageContentFailure,
} from '@ylide/sdk';
import { DEV_MAILER_ADDRESS, DEV_REGISTRY_ADDRESS, MAILER_ADDRESS, REGISTRY_ADDRESS } from '../misc/constants';
import { MailerContract, RegistryContract } from '../contracts';
import { IEverscaleContentMessageBody, IEverscaleMessage } from '../misc';
import { getContractMessagesQuery } from '../misc';

export class EverscaleReadingController extends AbstractReadingController {
	ever: ProviderRpcClient;
	gqlAddress: string;

	readonly MESSAGES_FETCH_LIMIT = 50;

	readonly mailerContract: MailerContract;
	readonly registryContract: RegistryContract;

	constructor(
		options: {
			dev?: boolean;
			mailerContractAddress?: string;
			registryContractAddress?: string;
			endpoint?: string;
		} = {},
	) {
		super(options);

		if (options.endpoint) {
			this.gqlAddress = options.endpoint;
		} else if (options.dev) {
			this.gqlAddress = 'http://localhost/graphql';
		} else {
			this.gqlAddress = 'https://gra02.main.everos.dev/graphql';
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

	static blockchainType(): string {
		return 'everscale';
	}

	async getRecipientReadingRules(address: string): Promise<any> {
		return [];
	}

	async extractAddressFromPublicKey(publicKey: Uint8Array): Promise<string | null> {
		return this.registryContract.getAddressByPublicKey(publicKey);
	}

	async extractPublicKeyFromAddress(address: string): Promise<Uint8Array | null> {
		return this.registryContract.getPublicKeyByAddress(address);
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
		const response = await fetch(this.gqlAddress, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				query,
				variables,
			}),
		});
		return await response.json();
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

	async decodeMailText(
		senderAddress: string,
		recipient: IGenericAccount,
		data: string,
		nonce: string,
	): Promise<string> {
		try {
			const senderPublicKey = await this.extractPublicKeyFromAddress(senderAddress);
			if (!senderPublicKey) {
				throw new Error('Error decrypting message text: no sender public key found');
			}
			const decryptedText = await this.ever.decryptData({
				algorithm: 'ChaCha20Poly1305',
				data,
				nonce,
				recipientPublicKey: recipient.publicKey,
				sourcePublicKey: new SmartBuffer(senderPublicKey).toHexString(),
			});
			if (decryptedText) {
				return Buffer.from(decryptedText, 'base64').toString('utf8');
			} else {
				throw new Error('Error decrypting message text');
			}
		} catch (e) {
			throw e;
		}
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
}
