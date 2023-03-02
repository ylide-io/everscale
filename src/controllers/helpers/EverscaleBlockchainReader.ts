import { EverscaleStandaloneClient } from 'everscale-standalone-client';
import nekotonCore from 'everscale-standalone-client/core';
import { ProviderRpcClient } from 'everscale-inpage-provider';

import { initAsync } from '../../encrypt';
import { GqlSender } from '../../network';
import { convertMsgIdToAddress, ITVMContentMessageBody, ITVMInternalMessage, ITVMMessage } from '../../misc';
import { IMessageContent, IMessageCorruptedContent, MessageContentFailure } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';

initAsync();

export type NekotonCore = typeof nekotonCore['nekoton'];

export class EverscaleBlockchainReader {
	ever: ProviderRpcClient;
	gql: GqlSender;

	constructor(
		public readonly type: 'everscale-mainnet' | 'venom-testnet',
		public readonly endpoints: string[],
		public readonly provider: any,
		public readonly dev = false,
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
		await nekotonCore.ensureNekotonLoaded();
		for (const rpc of rpcs) {
			let doBreak = false;
			try {
				return await callback(rpc.ever, rpc.gql, nekotonCore.nekoton, () => (doBreak = true));
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
			// tslint:disable-next-line
			console.error(`${err.rpc || '[provider] error: '}`, err);
		}
		throw new Error('Was not able to execute in all of RPC providers');
	}

	static async queryMessagesListDescRaw(
		gql: GqlSender,
		contractAddress: string,
		dst: string | null,
		fromMessageLt: bigint | null,
		includeFromMessage: boolean,
		toMessageLt: bigint | null,
		includeToMessage: boolean,
		limit?: number,
		nextPageAfterMessage?: ITVMInternalMessage,
	): Promise<ITVMInternalMessage[]> {
		const createdLt: {
			gt?: BigInt;
			gte?: BigInt;
			lt?: BigInt;
			lte?: BigInt;
		} = {};

		if (fromMessageLt) {
			if (nextPageAfterMessage && nextPageAfterMessage.created_lt) {
				const nextPageAfterMessageLt = BigInt(nextPageAfterMessage.created_lt);
				if (nextPageAfterMessageLt < fromMessageLt) {
					createdLt.lt = nextPageAfterMessageLt;
				} else {
					if (includeFromMessage) {
						createdLt.lte = fromMessageLt;
					} else {
						createdLt.lt = fromMessageLt;
					}
				}
			} else {
				if (includeFromMessage) {
					createdLt.lte = fromMessageLt;
				} else {
					createdLt.lt = fromMessageLt;
				}
			}
		} else {
			if (nextPageAfterMessage && nextPageAfterMessage.created_lt) {
				createdLt.lt = BigInt(nextPageAfterMessage.created_lt);
			}
		}

		if (toMessageLt) {
			if (includeToMessage) {
				createdLt.gte = toMessageLt;
			} else {
				createdLt.gt = toMessageLt;
			}
		}

		const _lt =
			createdLt.gt !== undefined ||
			createdLt.gte !== undefined ||
			createdLt.lt !== undefined ||
			createdLt.lte !== undefined;

		const ltStatements = [
			createdLt.lt !== undefined ? `lt: "${'0x' + createdLt.lt.toString(16)}", ` : null,
			createdLt.lte !== undefined ? `lte: "${'0x' + createdLt.lte.toString(16)}", ` : null,
			createdLt.gt !== undefined ? `gt: "${'0x' + createdLt.gt.toString(16)}", ` : null,
			createdLt.gte !== undefined ? `gte: "${'0x' + createdLt.gte.toString(16)}", ` : null,
		].filter(t => t !== null) as string[];

		const result: ITVMInternalMessage[] = await gql.queryMessages(`
			query {
				messages(
					filter: {
						msg_type: { eq: 2 },
						${dst ? `dst: { eq: "${dst}" },` : ''}
						src: { eq: "${contractAddress}" },
						${ltStatements.length ? `created_lt: { ${ltStatements.join('')} }, ` : ''}
					}
					orderBy: [{path: "created_at", direction: DESC}]
					limit: ${Math.min(limit || 50, 50)}
				) {
					body
					id
					src
					created_at
					created_lt
					dst
				}
			}`);

		if (limit && result.length === limit) {
			return result;
		} else {
			if (result.length === 0) {
				return [];
			} else {
				const after = await this.queryMessagesListDescRaw(
					gql,
					contractAddress,
					dst,
					fromMessageLt,
					includeFromMessage,
					toMessageLt,
					includeToMessage,
					limit ? limit - result.length : undefined,
					result[result.length - 1],
				);
				return result.concat(after);
			}
		}
	}

	static async queryMessagesListDesc(
		gql: GqlSender,
		contractAddress: string,
		dst: string | null,
		fromMessage: ITVMMessage | null,
		includeFromMessage: boolean,
		toMessage: ITVMMessage | null,
		includeToMessage: boolean,
		limit?: number,
	): Promise<ITVMInternalMessage[]> {
		return this.queryMessagesListDescRaw(
			gql,
			contractAddress,
			dst,
			fromMessage ? BigInt(fromMessage.$$meta.created_lt) : null,
			includeFromMessage,
			toMessage ? BigInt(toMessage.$$meta.created_lt) : null,
			includeToMessage,
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
			const messages = await gql.queryContractMessages(fakeAddress, mailerAddress);
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
