import { Contract } from 'everscale-inpage-provider';
import { EverscaleBlockchainController } from '../controllers';
export declare class RegistryContract {
    private readonly blockchainController;
    private readonly contractAddress;
    readonly contract: Contract<typeof REGISTRY_ABI>;
    constructor(blockchainController: EverscaleBlockchainController, contractAddress: string);
    private publicKeyToAddress;
    getAddressByPublicKey(publicKey: Uint8Array): Promise<string | null>;
    getPublicKeyByAddress(address: string): Promise<Uint8Array | null>;
    attachPublicKey(address: string, publicKey: Uint8Array): Promise<boolean>;
    attachAddress(address: string, publicKey: Uint8Array): Promise<boolean>;
    private decodePublicKeyToAddressMessageBody;
    private decodeAddressToPublicKeyMessageBody;
}
declare const REGISTRY_ABI: {
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
export {};
