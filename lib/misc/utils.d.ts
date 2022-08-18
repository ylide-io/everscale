import { Uint256 } from '@ylide/sdk';
export declare function publicKeyToBigIntString(publicKey: Uint8Array): string;
export declare function uint256ToAddress(value: Uint256, withPrefix?: boolean, nullPrefix?: boolean): string;
