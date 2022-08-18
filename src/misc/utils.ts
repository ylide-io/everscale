import { Uint256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';

export function publicKeyToBigIntString(publicKey: Uint8Array) {
	return BigInt('0x' + new SmartBuffer(publicKey).toHexString()).toString();
}

export function uint256ToAddress(value: Uint256, withPrefix: boolean = true, nullPrefix: boolean = false): string {
	if (value.length !== 64) {
		throw new Error('Value must have 32-bytes');
	}
	return `${withPrefix ? (nullPrefix ? ':' : '0:') : ''}${value}`;
}
