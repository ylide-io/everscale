import type * as nt from 'nekoton-wasm';
import { GqlSocketParams } from 'everscale-standalone-client';
export declare class GqlSender implements nt.IGqlSender {
    private readonly params;
    private readonly latencyDetectionInterval;
    private readonly endpoints;
    private nextLatencyDetectionTime;
    private currentEndpoint?;
    private resolutionPromise?;
    constructor(params: GqlSocketParams);
    isLocal(): boolean;
    send(data: string): Promise<any>;
    private _selectQueryingEndpoint;
}
