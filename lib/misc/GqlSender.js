"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GqlSender = void 0;
const gql_1 = require("everscale-standalone-client/client/ConnectionController/gql");
class GqlSender {
    params;
    latencyDetectionInterval;
    endpoints;
    nextLatencyDetectionTime = 0;
    currentEndpoint;
    resolutionPromise;
    constructor(params) {
        this.params = params;
        this.latencyDetectionInterval = params.latencyDetectionInterval || 60000;
        this.endpoints = params.endpoints.map(gql_1.GqlSocket.expandAddress);
        if (this.endpoints.length === 1) {
            this.currentEndpoint = this.endpoints[0];
            this.nextLatencyDetectionTime = Number.MAX_VALUE;
        }
    }
    isLocal() {
        return this.params.local;
    }
    async send(data) {
        const now = Date.now();
        try {
            let endpoint;
            if (this.currentEndpoint != null && now < this.nextLatencyDetectionTime) {
                // Default route
                endpoint = this.currentEndpoint;
            }
            else if (this.resolutionPromise != null) {
                // Already resolving
                endpoint = await this.resolutionPromise;
                delete this.resolutionPromise;
            }
            else {
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
            return fetch(endpoint, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: data,
            }).then(response => response.json());
        }
        catch (e) {
            throw e;
        }
    }
    async _selectQueryingEndpoint() {
        const maxLatency = this.params.maxLatency || 60000;
        const endpointCount = this.endpoints.length;
        for (let retryCount = 0; retryCount < 5; ++retryCount) {
            let handlers;
            const promise = new Promise((resolve, reject) => {
                handlers = {
                    resolve: (endpoint) => resolve(endpoint),
                    reject: () => reject(undefined),
                };
            });
            let checkedEndpoints = 0;
            let lastLatency;
            for (const endpoint of this.endpoints) {
                gql_1.GqlSocket.checkLatency(endpoint).then(latency => {
                    ++checkedEndpoints;
                    if (latency !== undefined && latency <= maxLatency) {
                        return handlers.resolve(endpoint);
                    }
                    if (lastLatency === undefined ||
                        lastLatency.latency === undefined ||
                        (latency !== undefined && latency < lastLatency.latency)) {
                        lastLatency = { endpoint, latency };
                    }
                    if (checkedEndpoints >= endpointCount) {
                        if (lastLatency?.latency !== undefined) {
                            handlers.resolve(lastLatency.endpoint);
                        }
                        else {
                            handlers.reject();
                        }
                    }
                });
            }
            try {
                return await promise;
            }
            catch (e) {
                let resolveDelay;
                const delayPromise = new Promise(resolve => {
                    resolveDelay = () => resolve();
                });
                setTimeout(() => resolveDelay(), Math.min(100 * retryCount, 5000));
                await delayPromise;
            }
        }
        throw new Error('Not available endpoint found');
    }
}
exports.GqlSender = GqlSender;
//# sourceMappingURL=GqlSender.js.map