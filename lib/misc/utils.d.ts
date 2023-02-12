import { Uint256 } from '@ylide/sdk';
export declare function publicKeyToBigIntString(publicKey: Uint8Array): string;
export declare function uint256ToAddress(value: Uint256, withPrefix?: boolean, nullPrefix?: boolean): string;
export declare function everscaleAddressToUint256(address: string): Uint256;
export declare function convertMsgIdToAddress(msgId: string): string;
export declare function isTVMAddressValid(address: string): boolean;
