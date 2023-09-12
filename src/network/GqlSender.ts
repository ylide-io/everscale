import type * as nt from 'nekoton-wasm';
import { GqlSocketParams } from 'everscale-standalone-client';
import { GqlSocket } from 'everscale-standalone-client/client/ConnectionController/gql';
import { ILogService, ITVMInternalMessage } from '../misc';
import { getContractMessagesQuery } from './gqlQueries';

type Endpoint = ReturnType<(typeof GqlSocket)['expandAddress']>;

export class GqlSender {
	private readonly params: GqlSocketParams;
	private readonly latencyDetectionInterval: number;
	private readonly endpoints: Endpoint[];
	private nextLatencyDetectionTime = 0;
	private currentEndpoint?: Endpoint;
	private resolutionPromise?: Promise<Endpoint>;

	constructor(params: GqlSocketParams) {
		this.params = params;
		this.latencyDetectionInterval = params.latencyDetectionInterval || 60000;
		this.endpoints = params.endpoints.map(e => GqlSocket.expandAddress(e));
		if (this.endpoints.length === 1) {
			this.currentEndpoint = this.endpoints[0];
			this.nextLatencyDetectionTime = Number.MAX_VALUE;
		}
	}

	isLocal(): boolean {
		return !!this.params.local;
	}

	async send(data: string, options?: { log: ILogService }) {
		options?.log.log('GqlSender.send start');
		const timeout = 30_000;
		const now = Date.now();
		try {
			let endpoint: Endpoint;
			if (this.currentEndpoint != null && now < this.nextLatencyDetectionTime) {
				options?.log.log('Default route');
				// Default route
				endpoint = this.currentEndpoint;
			} else if (this.resolutionPromise != null) {
				options?.log.log('Already resolving');
				// Already resolving
				endpoint = await this.resolutionPromise;
				delete this.resolutionPromise;
				options?.log.log('End already resolving');
			} else {
				options?.log.log('Start resolving');
				delete this.currentEndpoint;
				// Start resolving (current endpoint is null, or it is time to refresh)
				this.resolutionPromise = this._selectQueryingEndpoint().then(_endpoint => {
					this.currentEndpoint = _endpoint;
					this.nextLatencyDetectionTime = Date.now() + this.latencyDetectionInterval;
					return _endpoint;
				});
				endpoint = await this.resolutionPromise;
				delete this.resolutionPromise;
				options?.log.log('End start resolving');
			}

			const abortController = new AbortController();

			let timer: any = setTimeout(() => {
				abortController.abort();
				timer = null;
			}, timeout);

			options?.log.log('Fetch start');
			return fetch(endpoint.url, {
				method: 'post',
				headers: {
					'Content-Type': 'application/json',
				},
				body: data,
				signal: abortController.signal,
			}).then(response => {
				if (timer) {
					clearTimeout(timer);
				}
				options?.log.log('Fetch end, json parse start');
				return response.json();
			});
		} catch (e: any) {
			throw e;
		}
	}

	private async _selectQueryingEndpoint(): Promise<Endpoint> {
		const maxLatency = this.params.maxLatency || 60000;
		const endpointCount = this.endpoints.length;

		for (let retryCount = 0; retryCount < 5; ++retryCount) {
			let handlers: { resolve: (endpoint: Endpoint) => void; reject: () => void };
			const promise = new Promise<Endpoint>((resolve, reject) => {
				handlers = {
					resolve: (endpoint: Endpoint) => resolve(endpoint),
					reject: () => reject(undefined),
				};
			});

			let checkedEndpoints = 0;
			let lastLatency: { endpoint: Endpoint; latency: number | undefined } | undefined;

			for (const endpoint of this.endpoints) {
				GqlSocket.checkLatency(endpoint)
					.then(latency => {
						++checkedEndpoints;

						if (latency !== undefined && latency <= maxLatency) {
							return handlers.resolve(endpoint);
						}

						if (
							lastLatency === undefined ||
							lastLatency.latency === undefined ||
							(latency !== undefined && latency < lastLatency.latency)
						) {
							lastLatency = { endpoint, latency };
						}

						if (checkedEndpoints >= endpointCount) {
							if (lastLatency?.latency !== undefined) {
								handlers.resolve(lastLatency.endpoint);
							} else {
								handlers.reject();
							}
						}
					})
					.catch(err => {
						// do nothing
					});
			}

			try {
				return await promise;
			} catch (e: any) {
				let resolveDelay: () => void;
				const delayPromise = new Promise<void>(resolve => {
					resolveDelay = () => resolve();
				});
				setTimeout(() => resolveDelay(), Math.min(100 * retryCount, 5000));
				await delayPromise;
			}
		}

		throw new Error('Not available endpoint found');
	}

	async queryContractMessages(
		dst: string | null,
		sorting: 'asc' | 'desc',
		cursor: { type: 'before'; cursor: string | null } | { type: 'after'; cursor: string | null },
		contractAddress: string,
		limit?: number,
		options?: { log: ILogService },
	): Promise<ITVMInternalMessage[]> {
		const query = getContractMessagesQuery(dst, cursor, contractAddress, limit);
		return await this.queryMessages(query, sorting, {}, options);
	}

	async queryMessage(query: string, variables: Record<string, any> = {}) {
		const data = await this.query(query, variables);
		if (!data || !data.data || !data.data.blockchain || !data.data.blockchain.message) {
			return null;
		}
		const m = data.data.blockchain.message;
		return {
			...m,
			id: m.id.startsWith('message/') ? m.id.split('message/')[1] : m.id,
			cursor: null,
		} as ITVMInternalMessage;
	}

	async queryMessages(
		query: string,
		sorting: 'asc' | 'desc',
		variables: Record<string, any> = {},
		options?: { log: ILogService },
	) {
		options?.log.log('GqlSender.queryMessages start');
		const data = await this.query(query, variables, options);
		options?.log.log('GqlSender.queryMessages end');
		if (
			!data ||
			!data.data ||
			!data.data.blockchain ||
			!data.data.blockchain.account ||
			!data.data.blockchain.account.messages ||
			!data.data.blockchain.account.messages.edges ||
			!Array.isArray(data.data.blockchain.account.messages.edges) ||
			!data.data.blockchain.account.messages.edges.length
		) {
			options?.log.log('GqlSender.queryMessages return []');
			return [];
		}
		const msgs = data.data.blockchain.account.messages.edges.map((e: any) => ({
			...e.node,
			id: e.node.id.startsWith('message/') ? e.node.id.split('message/')[1] : e.node.id,
			cursor: e.cursor,
		})) as ITVMInternalMessage[];
		if (sorting === 'desc') {
			msgs.sort((a, b) => {
				if (a.created_at === b.created_at) {
					return parseInt(b.created_lt, 16) - parseInt(a.created_lt, 16);
				} else {
					return b.created_at - a.created_at;
				}
			});
		}

		options?.log.log('GqlSender.queryMessages return msgs;');
		return msgs;
	}

	async query(query: string, variables: Record<string, any> = {}, options?: { log: ILogService }) {
		return this.send(
			JSON.stringify({
				query,
				variables,
			}),
			options,
		);
	}
}
