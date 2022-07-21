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

	async buildHash(pubkey: Uint8Array, uniqueId: number, time: number): Promise<string> {
		const args = {
			pubkey: publicKeyToBigIntString(pubkey),
			uniqueId,
			time,
		};
		// @ts-ignore
		const result: any = await this.contract.methods.buildHash(args).call();
		return BigInt(result._hash).toString(16);
	}

	async setFees(address: string, _contentPartFee: number, _recipientFee: number) {
		return await this.contract.methods
			.setFees({
				// @ts-ignore
				_contentPartFee: BigInt(_contentPartFee).toString(10),
				// @ts-ignore
				_recipientFee: BigInt(_recipientFee).toString(10),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '200000000',
				bounce: false,
			});
	}

	async transferOwnership(address: string, newOwner: string) {
		return await this.contract.methods
			.transferOwnership({
				// @ts-ignore
				newOwner,
			})
			.sendWithResult({
				from: new Address(address),
				amount: '200000000',
				bounce: false,
			});
	}

	async setBeneficiary(address: string, _beneficiary: string) {
		return await this.contract.methods
			.setBeneficiary({
				// @ts-ignore
				_beneficiary,
			})
			.sendWithResult({
				from: new Address(address),
				amount: '200000000',
				bounce: false,
			});
	}

	async addRecipients(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		initTime: number,
		recipients: string[],
		keys: Uint8Array[],
	) {
		// uint256 publicKey, uint32 uniqueId, uint32 initTime, address[] recipients, bytes[] keys
		return await this.contract.methods
			.addRecipients({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				initTime,
				// @ts-ignore
				recipients,
				// @ts-ignore
				keys: keys.map(k => new SmartBuffer(k).toBase64String()),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
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

	async sendBulkMail(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipients: string[],
		keys: Uint8Array[],
		content: Uint8Array,
	) {
		return await this.contract.methods
			.sendBulkMail({
				// @ts-ignore
				publicKey: publicKeyToBigIntString(publicKey),
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipients,
				// @ts-ignore
				keys: keys.map(k => new SmartBuffer(k).toBase64String()),
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
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
			name: 'setFees',
			inputs: [
				{ name: '_contentPartFee', type: 'uint128' },
				{ name: '_recipientFee', type: 'uint128' },
			],
			outputs: [],
		},
		{
			name: 'setBeneficiary',
			inputs: [{ name: '_beneficiary', type: 'address' }],
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
		{
			name: 'transferOwnership',
			inputs: [{ name: 'newOwner', type: 'address' }],
			outputs: [],
		},
		{
			name: 'terminate',
			inputs: [],
			outputs: [],
		},
		{
			name: 'owner',
			inputs: [],
			outputs: [{ name: 'owner', type: 'address' }],
		},
		{
			name: 'contentPartFee',
			inputs: [],
			outputs: [{ name: 'contentPartFee', type: 'uint128' }],
		},
		{
			name: 'recipientFee',
			inputs: [],
			outputs: [{ name: 'recipientFee', type: 'uint128' }],
		},
		{
			name: 'beneficiary',
			inputs: [],
			outputs: [{ name: 'beneficiary', type: 'address' }],
		},
	],
	'data': [
		{ key: 1, name: 'owner', type: 'address' },
		{ key: 2, name: 'beneficiary', type: 'address' },
	],
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
		{ name: 'owner', type: 'address' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
};
