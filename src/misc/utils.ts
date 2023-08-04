import { hexToUint256, Uint256 } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';

export const publicKeyToBigIntString = (publicKey: Uint8Array) => {
	return BigInt('0x' + new SmartBuffer(publicKey).toHexString()).toString();
};

export const uint256ToAddress = (value: Uint256, withPrefix = true, nullPrefix = false): string => {
	if (value.length !== 64) {
		throw new Error('Value must have 32-bytes');
	}
	return `${withPrefix ? (nullPrefix ? ':' : '0:') : ''}${value}`;
};

export const everscaleAddressToUint256 = (address: string): Uint256 => {
	return hexToUint256(address.substring(address.length - 64, address.length).toLowerCase());
};

export const convertMsgIdToAddress = (msgId: string) => {
	return `:${msgId}`;
};

export const isTVMAddressValid = (address: string) => {
	if (address.length !== 66) {
		return false;
	} else if (!address.includes(':')) {
		return false;
	}

	const splitAddress = address.split(':');

	if (splitAddress[0] !== '0') {
		return false;
	}

	if (splitAddress[1].includes('_')) return false;

	const regExp = new RegExp('^[^\\W]+$');

	return regExp.test(splitAddress[1]);
};

export const randomHex = (length = 64) => {
	return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};
