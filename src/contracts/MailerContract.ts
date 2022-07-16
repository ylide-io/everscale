import SmartBuffer from '@ylide/smart-buffer';
import { Address, Contract } from 'everscale-inpage-provider';
import core from 'everscale-standalone-client/core';
import { EverscaleReadingController } from '../controllers/EverscaleReadingController';
import { IEverscaleContentMessageBody, IEverscalePushMessageBody, publicKeyToBigIntString } from '../misc';

export class MailerContract {
	readonly contractAddress: string;
	readonly contract: Contract<typeof MAILER_ABI>;

	constructor(private readonly reader: EverscaleReadingController, contractAddress: string) {
		this.contractAddress = contractAddress;
		this.contract = new reader.ever.Contract(MAILER_ABI, new Address(this.contractAddress));
	}

	async getMsgId(publicKey: Uint8Array, uniqueId: number) {
		const { msgId, initTime } = await this.contract.methods
			// @ts-ignore
			.getMsgId({ publicKey: publicKeyToBigIntString(publicKey), uniqueId })
			.call();
		return {
			msgId,
			initTime,
		};
	}

	async sendMultipartMailPart(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		initTime: number,
		parts: number,
		partIdx: number,
		content: Uint8Array,
	) {
		return await this.contract.methods
			.sendMultipartMailPart({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				initTime,
				// @ts-ignore
				parts,
				// @ts-ignore
				partIdx,
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient,
				// @ts-ignore
				key: new SmartBuffer(key).toBase64String(),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail0(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail0({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient,
				// @ts-ignore
				key: new SmartBuffer(key).toBase64String(),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail1(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail1({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient,
				// @ts-ignore
				key: new SmartBuffer(key).toBase64String(),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail2(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail2({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient,
				// @ts-ignore
				key: new SmartBuffer(key).toBase64String(),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail4(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail4({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient,
				// @ts-ignore
				key: new SmartBuffer(key).toBase64String(),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendBulkMail(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipients: string,
		keys: Uint8Array[],
		content: Uint8Array,
	) {
		return await this.contract.methods
			// @ts-ignore
			.sendBulkMail({ publicKey, uniqueId, recipients, keys, content })
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	decodePushMessageBody(body: string): IEverscalePushMessageBody {
		const data = core.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailPush');
		if (!data) {
			throw new Error('PushMessage format is not supported');
		}
		return {
			sender: (data.data.sender as string).startsWith(':')
				? `0${data.data.sender}`
				: (data.data.sender as string),
			msgId: BigInt(data.data.msgId as string)
				.toString(16)
				.padStart(64, '0'),
			key: SmartBuffer.ofBase64String(data.data.key as string).bytes,
		};
	}

	decodeContentMessageBody(body: string): IEverscaleContentMessageBody {
		const data = core.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailContent');
		if (!data) {
			throw new Error('ContentMessage format is not supported');
		}
		return {
			sender: data.data.sender as string,
			msgId: BigInt(data.data.msgId as string)
				.toString(16)
				.padStart(64, '0'),
			parts: Number(data.data.parts as string),
			partIdx: Number(data.data.partIdx as string),
			content: SmartBuffer.ofBase64String(data.data.content as string).bytes,
		};
	}
}

const MAILER_ABI = {
	'ABI version': 2,
	'version': '2.2',
	'header': ['pubkey', 'time', 'expire'],
	'functions': [
		{
			name: 'constructor',
			inputs: [],
			outputs: [],
		},
		{
			name: 'buildHash',
			inputs: [
				{ name: 'pubkey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'time', type: 'uint32' },
			],
			outputs: [{ name: '_hash', type: 'uint256' }],
		},
		{
			name: 'getMsgId',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
			],
			outputs: [{ name: 'msgId', type: 'uint256' }],
		},
		{
			name: 'sendMultipartMailPart',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
				{ name: 'parts', type: 'uint16' },
				{ name: 'partIdx', type: 'uint16' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
		{
			name: 'addRecipients',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
				{ name: 'recipients', type: 'address[]' },
				{ name: 'keys', type: 'bytes[]' },
			],
			outputs: [],
		},
		{
			name: 'sendSmallMail',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'recipient', type: 'address' },
				{ name: 'key', type: 'bytes' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
		{
			name: 'sendBulkMail',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'recipients', type: 'address[]' },
				{ name: 'keys', type: 'bytes[]' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
	],
	'data': [],
	'events': [
		{
			name: 'MailPush',
			inputs: [
				{ name: 'sender', type: 'address' },
				{ name: 'msgId', type: 'uint256' },
				{ name: 'key', type: 'bytes' },
			],
			outputs: [],
		},
		{
			name: 'MailContent',
			inputs: [
				{ name: 'sender', type: 'address' },
				{ name: 'msgId', type: 'uint256' },
				{ name: 'parts', type: 'uint16' },
				{ name: 'partIdx', type: 'uint16' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
	],
	'fields': [
		{ name: '_pubkey', type: 'uint256' },
		{ name: '_timestamp', type: 'uint64' },
		{ name: '_constructorFlag', type: 'bool' },
	],
};
