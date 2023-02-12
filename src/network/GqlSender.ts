import type * as nt from 'nekoton-wasm';
import { GqlSocketParams } from 'everscale-standalone-client';
import { GqlSocket } from 'everscale-standalone-client/client/ConnectionController/gql';
import { ITVMInternalMessage } from '../misc';
import { getContractMessagesQuery } from './gqlQueries';

type Endpoint = ReturnType<typeof GqlSocket['expandAddress']>;

export class GqlSender implements nt.IGqlSender {
	private readonly params: GqlSocketParams;
	private readonly latencyDetectionInterval: number;
	private readonly endpoints: Endpoint[];
	private nextLatencyDetectionTime: number = 0;
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

	async send(data: string) {
		const now = Date.now();
		try {
			let endpoint: Endpoint;
			if (this.currentEndpoint != null && now < this.nextLatencyDetectionTime) {
				// Default route
				endpoint = this.currentEndpoint;
			} else if (this.resolutionPromise != null) {
				// Already resolving
				endpoint = await this.resolutionPromise;
				delete this.resolutionPromise;
			} else {
				delete this.currentEndpoint;
				// Start resolving (current endpoint is null, or it is time to refresh)
				this.resolutionPromise = this._selectQueryingEndpoint().then(_endpoint => {
					this.currentEndpoint = _endpoint;
					this.nextLatencyDetectionTime = Date.now() + this.latencyDetectionInterval;
					return _endpoint;
				});
				endpoint = await this.resolutionPromise;
				delete this.resolutionPromise;
			}

			return fetch(endpoint.url, {
				method: 'post',
				headers: {
					'Content-Type': 'application/json',
				},
				body: data,
			}).then(response => response.json());
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
				GqlSocket.checkLatency(endpoint).then(latency => {
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

	async queryContractMessages(dst: string, contractAddress: string, limit?: number): Promise<ITVMInternalMessage[]> {
		const query = getContractMessagesQuery(dst, contractAddress, limit);
		return await this.queryMessages(query);
	}

	async queryMessages(query: string, variables: Record<string, any> = {}) {
		const data = await this.query(query, variables);
		if (
			!data ||
			!data.data ||
			!data.data.messages ||
			!Array.isArray(data.data.messages) ||
			!data.data.messages.length
		) {
			return [];
		}
		return data.data.messages as ITVMInternalMessage[];
	}

	async query(query: string, variables: Record<string, any> = {}) {
		return this.send(
			JSON.stringify({
				query,
				variables,
			}),
		);
	}
}
