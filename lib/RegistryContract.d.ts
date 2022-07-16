import { Contract } from 'everscale-inpage-provider';
import { CONTRACT_ABI } from './EverscaleContract';
import { EverscaleReadingController } from './EverscaleReadingController';
export declare class RegistryContract {
    readonly contract: Contract<typeof CONTRACT_ABI>;
    constructor(reader: EverscaleReadingController, isDev: boolean);
    getAddressByPublicKey(publicKey: Uint8Array): Promise<string | null>;
    getPublicKeyByAddress(address: string): Promise<Uint8Array | null>;
    attachPublicKey(address: string, publicKey: Uint8Array): Promise<boolean>;
    attachAddress(address: string, publicKey: Uint8Array): Promise<boolean>;
}
