import { bigIntToUint256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import core from 'everscale-standalone-client/core';
import { IEverscalePushMessageBody, IEverscaleBroadcastMessageBody, IEverscaleContentMessageBody } from '../misc';
import { MAILER_ABI } from './MailerContract';
import { REGISTRY_ABI } from './RegistryContract';

export function decodePushMessageBody(body: string): IEverscalePushMessageBody {
	const data = core.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailPush');
	if (!data) {
		throw new Error('PushMessage format is not supported');
	}
	return {
		sender: (data.data.sender as string).startsWith(':') ? `0${data.data.sender}` : (data.data.sender as string),
		msgId: bigIntToUint256(data.data.msgId as string),
		key: SmartBuffer.ofBase64String(data.data.key as string).bytes,
	};
}

export function decodeBroadcastMessageBody(body: string): IEverscaleBroadcastMessageBody {
	const data = core.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailPush');
	if (!data) {
		throw new Error('PushMessage format is not supported');
	}
	return {
		msgId: bigIntToUint256(data.data.msgId as string),
	};
}

export function decodeContentMessageBody(body: string): IEverscaleContentMessageBody {
	const data = core.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailContent');
	if (!data) {
		throw new Error('ContentMessage format is not supported');
	}
	return {
		sender: data.data.sender as string,
		msgId: bigIntToUint256(data.data.msgId as string),
		parts: Number(data.data.parts as string),
		partIdx: Number(data.data.partIdx as string),
		content: SmartBuffer.ofBase64String(data.data.content as string).bytes,
	};
}

export function decodeAddressToPublicKeyMessageBody(body: string): Uint8Array {
	const data = core.nekoton.decodeEvent(body, JSON.stringify(REGISTRY_ABI), 'AddressToPublicKey');
	if (!data) {
		throw new Error('AddressToPublicKeyMessage format is not supported');
	}
	return SmartBuffer.ofHexString(
		BigInt(data.data.publicKey as string)
			.toString(16)
			.padStart(64, '0'),
	).bytes;
}
