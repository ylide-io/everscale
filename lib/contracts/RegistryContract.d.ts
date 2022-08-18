import { Contract, ProviderRpcClient } from 'everscale-inpage-provider';
export declare class RegistryContract {
    private readonly ever;
    readonly contractAddress: string;
    readonly contract: Contract<typeof REGISTRY_ABI>;
    constructor(ever: ProviderRpcClient, contractAddress: string);
    attachPublicKey(address: string, publicKey: Uint8Array): Promise<boolean>;
}
export declare const REGISTRY_ABI: {
    'ABI version': number;
    version: string;
    header: string[];
    functions: {
        name: string;
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: never[];
    }[];
    data: never[];
    events: {
        name: string;
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: never[];
    }[];
    fields: {
        name: string;
        type: string;
    }[];
};
