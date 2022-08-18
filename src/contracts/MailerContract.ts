import { bigIntToUint256, Uint256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, Contract, ProviderRpcClient } from 'everscale-inpage-provider';
import { publicKeyToBigIntString, uint256ToAddress } from '../misc';

export class MailerContract {
	readonly contractAddress: string;
	readonly contract: Contract<typeof MAILER_ABI>;

	constructor(private readonly ever: ProviderRpcClient, contractAddress: string) {
		this.contractAddress = contractAddress;
		this.contract = new ever.Contract(MAILER_ABI, new Address(this.contractAddress));
	}

	async buildHash(pubkey: Uint8Array, uniqueId: number, time: number): Promise<Uint256> {
		const args = {
			pubkey: publicKeyToBigIntString(pubkey),
			uniqueId,
			time,
		};
		// @ts-ignore
		const result: any = await this.contract.methods.buildHash(args).call();
		return bigIntToUint256(BigInt(result._hash).toString(10));
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
		uniqueId: number,
		initTime: number,
		recipients: Uint256[],
		keys: Uint8Array[],
	) {
		// uint256 publicKey, uint32 uniqueId, uint32 initTime, address[] recipients, bytes[] keys
		return await this.contract.methods
			.addRecipients({
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				initTime,
				// @ts-ignore
				recipients: recipients.map(r => uint256ToAddress(r)),
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
		uniqueId: number,
		initTime: number,
		parts: number,
		partIdx: number,
		content: Uint8Array,
	) {
		return await this.contract.methods
			.sendMultipartMailPart({
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

	async broadcastMail(address: string, uniqueId: number, content: Uint8Array) {
		return await this.contract.methods
			// @ts-ignore
			.broadcastMail({
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				content: new SmartBuffer(content).toBase64String(),
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async broadcastMailHeader(address: string, uniqueId: number, initTime: number) {
		return await this.contract.methods
			// @ts-ignore
			.broadcastMail({
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				initTime,
			})
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
	}

	async sendSmallMail(address: string, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array) {
		return await this.contract.methods
			// @ts-ignore
			.sendSmallMail({
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipient: uint256ToAddress(recipient),
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
		uniqueId: number,
		recipients: Uint256[],
		keys: Uint8Array[],
		content: Uint8Array,
	) {
		return await this.contract.methods
			.sendBulkMail({
				// @ts-ignore
				uniqueId,
				// @ts-ignore
				recipients: recipients.map(r => uint256ToAddress(r)),
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
}

export const MAILER_ABI = {
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
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'recipients', type: 'address[]' },
				{ name: 'keys', type: 'bytes[]' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
		{
			name: 'broadcastMail',
			inputs: [
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'content', type: 'bytes' },
			],
			outputs: [],
		},
		{
			name: 'broadcastMailHeader',
			inputs: [
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
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
		{
			name: 'MailBroadcast',
			inputs: [{ name: 'msgId', type: 'uint256' }],
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
