import { EverscaleStandaloneClient } from 'everscale-standalone-client';
import nekotonCore from 'everscale-standalone-client/core';
import { ProviderRpcClient } from 'everscale-inpage-provider';

import { initAsync } from '../../encrypt';
import { GqlSender } from '../../network';
import {
	convertMsgIdToAddress,
	ITVMContentMessageBody,
	ITVMInternalMessage,
	ITVMInternalMessageBase,
	ITVMMessage,
} from '../../misc';
import { IMessageContent, IMessageCorruptedContent, MessageContentFailure } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';

initAsync().catch(err => {
	console.error('Failed to init Everscale encryption library');
	throw err;
});

export type NekotonCore = (typeof nekotonCore)['nekoton'];

export class EverscaleBlockchainReader {
	ever: ProviderRpcClient;
	gql: GqlSender;

	constructor(
		public readonly type: 'everscale-mainnet' | 'venom-testnet',
		public readonly endpoints: string[],
		public readonly provider: any,
		public readonly dev = false,
		public readonly core: typeof nekotonCore = nekotonCore,
	) {
		this.ever = new ProviderRpcClient({
			forceUseFallback: true,
			fallback: provider
				? async () => provider
				: async () => {
						try {
							return await EverscaleStandaloneClient.create({
								connection: dev
									? 'local'
									: {
											id: 1,
											group: 'mainnet',
											type: 'graphql',
											data: {
												local: false,
												endpoints,
											},
									  },
							});
						} catch (err) {
							throw err;
						}
				  },
		});

		this.gql = new GqlSender({
			endpoints,
			local: false,
		});
	}

	async operation<T>(
		callback: (ever: ProviderRpcClient, gql: GqlSender, core: NekotonCore, stopTrying: () => void) => Promise<T>,
	): Promise<T> {
		let lastError;
		const rpcs = [{ ever: this.ever, gql: this.gql }];
		const errors: { rpc: any; err: any }[] = [];
		await this.core.ensureNekotonLoaded();
		for (const rpc of rpcs) {
			let doBreak = false;
			try {
				return await callback(rpc.ever, rpc.gql, this.core.nekoton, () => (doBreak = true));
			} catch (err: any) {
				lastError = err;
				errors.push({ rpc, err });
				if (doBreak) {
					break;
				} else {
					continue;
				}
			}
		}
		for (const err of errors) {
			// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
			console.error(`${err.rpc || '[provider] error: '}`, err);
		}
		throw new Error('Was not able to execute in all of RPC providers');
	}

	// static async queryMessageListRaw(
	// 	gql: GqlSender,
	// 	contractAddress: string,
	// 	dst: string | null,
	// 	fromMessage: ITVMInternalMessageBase | null,
	// 	includeFromMessage: boolean,
	// 	toMessage: ITVMInternalMessageBase | null,
	// 	includeToMessage: boolean,
	// 	limit?: number,
	// ): Promise<ITVMInternalMessage[]> {
	// 	const result = await this._queryMessageListRaw(
	// 		gql,
	// 		contractAddress,
	// 		dst,
	// 		fromMessage,
	// 		// includeFromMessage,
	// 		toMessage,
	// 		// includeToMessage,
	// 		limit,
	// 	);
	// 	if (includeFromMessage) {
	// 		result.unshift(fromMessage as ITVMInternalMessage);
	// 	}
	// 	if (includeToMessage) {
	// 		result.push(toMessage as ITVMInternalMessage);
	// 	}
	// }

	static async getMessage(gql: GqlSender, id: string) {
		const result = await gql.queryMessage(`
		query {
			blockchain {
				message(hash: "${id}") {
					body
					msg_type
					id
					src
					created_at
					created_lt
					dst
				}
			}
		}
		`);
		return result;
	}

	static async queryMessagesListRaw(
		gql: GqlSender,
		sorting: 'asc' | 'desc',
		contractAddress: string,
		dst: string | null,
		fromMessage: ITVMInternalMessageBase | null,
		toMessage: ITVMInternalMessageBase | null,
		limit?: number,
		nextPageAfterMessage?: ITVMInternalMessage,
	): Promise<ITVMInternalMessage[]> {
		let fromCursor: string | null = null;

		if (fromMessage && !fromMessage.cursor) {
			throw new Error('fromMessage.cursor is not defined');
		}
		if (toMessage && !toMessage.cursor) {
			throw new Error('toMessage.cursor is not defined');
		}

		if (fromMessage) {
			if (
				nextPageAfterMessage &&
				nextPageAfterMessage.created_lt &&
				((sorting === 'desc' && BigInt(nextPageAfterMessage.created_lt) < BigInt(fromMessage.created_lt)) ||
					(sorting === 'asc' && BigInt(nextPageAfterMessage.created_lt) > BigInt(fromMessage.created_lt)))
			) {
				fromCursor = nextPageAfterMessage.cursor;
			} else {
				fromCursor = fromMessage.cursor;
			}
		} else {
			if (nextPageAfterMessage && nextPageAfterMessage.created_lt) {
				fromCursor = nextPageAfterMessage.cursor;
			}
		}

		const result: ITVMInternalMessage[] = await gql.queryMessages(
			`
			query {
				blockchain {
					account(address:"${contractAddress}") {
						messages(
							msg_type: [ExtOut],
							${dst ? `counterparties: ["${dst}"]` : ''}
							${fromCursor ? `${sorting === 'desc' ? 'before' : 'after'}: "${fromCursor}"` : ''}
							${sorting === 'desc' ? 'last' : 'first'}: ${Math.min(limit || 50, 50)}
						) {
							edges {
								node {
									body
									msg_type
									id
									src
									created_at
									created_lt
									dst
								}
								cursor
							}
						}
					}
				}
			}
			`,
			sorting,
		);

		let end = false;
		const findTo = toMessage ? result.findIndex(x => x.id === toMessage.id) : -1;
		if (findTo !== -1) {
			result.splice(findTo);
			end = true;
		}

		if (end || (limit && result.length === limit)) {
			return result;
		} else {
			if (result.length === 0) {
				return [];
			} else {
				const after = await this.queryMessagesListRaw(
					gql,
					sorting,
					contractAddress,
					dst,
					fromMessage,
					toMessage,
					limit ? limit - result.length : undefined,
					result[result.length - 1],
				);
				return result.concat(after);
			}
		}
	}

	static async queryMessagesList(
		gql: GqlSender,
		sorting: 'asc' | 'desc',
		contractAddress: string,
		dst: string | null,
		fromMessage: ITVMInternalMessageBase | null,
		toMessage: ITVMInternalMessageBase | null,
		limit?: number,
	): Promise<ITVMInternalMessage[]> {
		return this.queryMessagesListRaw(
			gql,
			sorting,
			contractAddress,
			dst,
			fromMessage || null,
			toMessage || null,
			limit,
		);
	}

	async retrieveAndVerifyMessageContent(
		mailerAddress: string,
		decoder: (core: NekotonCore, body: string) => ITVMContentMessageBody,
		msg: ITVMMessage,
	): Promise<IMessageContent | IMessageCorruptedContent | null> {
		const result = await this.retrieveMessageContentByInternalMsgId(
			mailerAddress,
			decoder,
			msg.$$meta.internalMsgId,
		);
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

	async retrieveMessageContentByInternalMsgId(
		mailerAddress: string,
		decoder: (core: NekotonCore, body: string) => ITVMContentMessageBody,
		msgId: string,
	): Promise<IMessageContent | IMessageCorruptedContent | null> {
		return await this.operation(async (ever, gql, core) => {
			const fakeAddress = convertMsgIdToAddress(msgId);
			const messages = await gql.queryContractMessages(
				fakeAddress,
				'desc',
				{ type: 'before', cursor: null },
				mailerAddress,
			);
			if (!messages.length) {
				return null;
			}
			let decodedChunks: { msg: ITVMInternalMessage; body: ITVMContentMessageBody }[];
			try {
				decodedChunks = messages.map((m: ITVMInternalMessage) => ({
					msg: m,
					body: decoder(core, m.body),
				}));
			} catch (err) {
				return {
					msgId,
					corrupted: true,
					chunks: messages.map((m: ITVMInternalMessage) => ({ createdAt: m.created_at })),
					reason: MessageContentFailure.NON_DECRYPTABLE,
				};
			}
			const parts = decodedChunks[0].body.parts;
			const sender = decodedChunks[0].body.sender;
			if (
				!decodedChunks.every(t => t.body.parts === parts) ||
				!decodedChunks.every(t => t.body.sender === sender)
			) {
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
				storage: this.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',
				createdAt: Math.min(...decodedChunks.map(d => d.msg.created_at)),
				senderAddress: sender,
				parts,
				content: buf.bytes,
			};
		});
	}
}
