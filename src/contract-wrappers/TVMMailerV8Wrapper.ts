import type {
	RemotePublicKey,
	ILooseSourceSubject,
	IMessageContent,
	IMessageCorruptedContent,
	Uint256,
} from '@ylide/sdk';
import { bigIntToUint256, BlockchainSourceType } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';
import { Address, ProviderRpcClient } from 'everscale-inpage-provider';
import { TVMBlockchainReader, NekotonCore } from '../controllers/helpers/TVMBlockchainReader';
import {
	everscaleAddressToUint256,
	ITVMMessage,
	ITVMMailerContractLink,
	uint256ToAddress,
	ITVMInternalMessage,
	encodeTvmMsgId,
	publicKeyToBigIntString,
	randomHex,
	ITVMContentMessageBody,
	TVMWalletAccount,
} from '../misc';
import { ContractCache } from './ContractCache';
import { TVMDeployer } from './TVMDeployer';

export class TVMMailerV8Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V8_ABI>;

	constructor(public readonly blockchainReader: TVMBlockchainReader) {
		this.cache = new ContractCache(MAILER_V8_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: TVMWalletAccount, beneficiaryAddress: string): Promise<string> {
		const contractAddress = await TVMDeployer.deployContract(
			ever,
			from,
			MAILER_V8_ABI,
			{
				tvc: MAILER_V8_TVC_BASE64,
				workchain: 0,
				publicKey: from.$$meta.publicKeyHex,
				initParams: {
					nonce: BigInt(`0x${randomHex(64)}`).toString(10),
					beneficiary: new Address(beneficiaryAddress),
					extraTreasury: new Address(beneficiaryAddress),
				},
			},
			{ _owner: new Address(from.address) },
			'1000000000',
		);

		return contractAddress.contract.address.toString();
	}

	decodeBroadcastMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V8_ABI), 'MailBroadcast');
		if (!data) {
			throw new Error('MailBroadcast format is not supported');
		}
		const address = data.data.sender?.toString() || '';
		return {
			sender: address.startsWith(':') ? `0${address}` : address,
			msgId: bigIntToUint256(data.data.msgId as string),
			extraPayment: Number(data.data.extraPayment as string),
		};
	}

	decodePushMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V8_ABI), 'MailPush');
		if (!data) {
			throw new Error('MailPush format is not supported');
		}
		const address = data.data.sender?.toString() || '';
		return {
			sender: address.startsWith(':') ? `0${address}` : address,
			msgId: bigIntToUint256(data.data.msgId as string),
			key: SmartBuffer.ofBase64String(data.data.key as string).bytes,
		};
	}

	decodeContentMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V8_ABI), 'MailContent');
		if (!data) {
			throw new Error('MailContent format is not supported');
		}
		return {
			sender: data.data.sender as string,
			msgId: bigIntToUint256(data.data.msgId as string),
			parts: Number(data.data.parts as string),
			partIdx: Number(data.data.partIdx as string),
			content: SmartBuffer.ofBase64String(data.data.content as string).bytes,
		};
	}

	formatMailMessage(core: NekotonCore, mailer: ITVMMailerContractLink, message: ITVMInternalMessage): ITVMMessage {
		const body = this.decodePushMessageBody(core, message.body);

		return {
			isBroadcast: false,
			feedId: '0000000000000000000000000000000000000000000000000000000000000000' as Uint256,
			msgId: encodeTvmMsgId(false, mailer.id, message.id),
			createdAt: message.created_at,
			senderAddress: body.sender,
			recipientAddress: everscaleAddressToUint256(message.dst),
			blockchain: this.blockchainReader.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',

			key: body.key,

			$$meta: {
				id: message.id,
				created_lt: message.created_lt,
				src: message.src,
				dst: message.dst,

				internalMsgId: body.msgId,

				cursor: message.cursor,
			},
		};
	}

	formatBroadcastMessage(
		core: NekotonCore,
		mailer: ITVMMailerContractLink,
		message: ITVMInternalMessage,
	): ITVMMessage {
		const body = this.decodeBroadcastMessageBody(core, message.body);

		return {
			isBroadcast: true,
			feedId: (message.dst.startsWith('0:')
				? message.dst.replace('0:', '')
				: message.dst.startsWith(':')
				? message.dst.replace(':', '')
				: message.dst) as Uint256,
			msgId: encodeTvmMsgId(true, mailer.id, message.id),
			createdAt: message.created_at,
			senderAddress: body.sender,
			recipientAddress: everscaleAddressToUint256(message.dst),
			blockchain: this.blockchainReader.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',

			key: new Uint8Array(0),

			$$meta: {
				id: message.id,
				created_lt: message.created_lt,
				src: message.src,
				dst: message.dst,

				internalMsgId: body.msgId,

				cursor: message.cursor,
				extraPayment: body.extraPayment,
			},
		};
	}

	parseEvent(
		core: NekotonCore,
		mailer: ITVMMailerContractLink,
		message: ITVMInternalMessage,
	):
		| { type: 'message'; msg: ITVMMessage; raw: ITVMInternalMessage }
		| { type: 'content'; content: ITVMContentMessageBody; raw: ITVMInternalMessage }
		| { type: 'none'; raw: ITVMInternalMessage } {
		try {
			const msg = this.formatBroadcastMessage(core, mailer, message);
			return {
				type: 'message',
				msg,
				raw: message,
			};
		} catch (err) {
			// nothing
		}
		try {
			const msg = this.formatMailMessage(core, mailer, message);
			return {
				type: 'message',
				msg,
				raw: message,
			};
		} catch (err) {
			// nothing
		}
		try {
			const content = this.decodeContentMessageBody(core, message.body);
			return {
				type: 'content',
				content,
				raw: message,
			};
		} catch (err) {
			// nothing
		}
		return {
			type: 'none',
			raw: message,
		};
	}

	async retrieveHistoryAscRaw(
		mailer: ITVMMailerContractLink,
		fromMessage: ITVMInternalMessage | null,
		limit?: number,
	): Promise<
		(
			| { type: 'message'; msg: ITVMMessage; raw: ITVMInternalMessage }
			| { type: 'content'; content: ITVMContentMessageBody; raw: ITVMInternalMessage }
			| { type: 'key'; key: RemotePublicKey; raw: ITVMInternalMessage }
			| { type: 'none'; raw: ITVMInternalMessage }
		)[]
	> {
		return await this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			return (
				await TVMBlockchainReader.queryMessagesList(gql, 'asc', mailer.address, null, fromMessage, null, limit)
			).map(m => this.parseEvent(core, mailer, m));
		});
	}

	async retrieveHistoryDesc(
		mailer: ITVMMailerContractLink,
		subject: ILooseSourceSubject,
		fromMessage: ITVMMessage | null,
		toMessage: ITVMMessage | null,
		limit?: number,
	): Promise<ITVMMessage[]> {
		return await this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const dst =
				subject.type === BlockchainSourceType.DIRECT
					? subject.recipient
						? uint256ToAddress(subject.recipient, true, true)
						: null
					: subject.feedId
					? uint256ToAddress(subject.feedId, true, true)
					: null;

			const events = await TVMBlockchainReader.queryMessagesList(
				gql,
				'desc',
				mailer.address,
				dst,
				fromMessage ? fromMessage.$$meta : null,
				toMessage ? toMessage.$$meta : null,
				limit,
			);

			const result = events.map(m =>
				subject.type === BlockchainSourceType.DIRECT
					? this.formatMailMessage(core, mailer, m)
					: this.formatBroadcastMessage(core, mailer, m),
			);

			return result;
		});
	}

	async getOwner(mailer: ITVMMailerContractLink): Promise<string> {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.owner()
				.call()
				.then(r => r.owner.toString());
		});
	}

	async setOwner(mailer: ITVMMailerContractLink, from: string, owner: string) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods.transferOwnership({ newOwner: new Address(owner) }).send({
				from: new Address(from),
				amount: '200000000',
				bounce: false,
			});
		});
	}

	async getExtraTreasury(mailer: ITVMMailerContractLink): Promise<string> {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.extraTreasury()
				.call()
				.then(r => r.extraTreasury.toString());
		});
	}

	async setExtraTreasury(mailer: ITVMMailerContractLink, from: string, newExtraTreasury: string) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods.setExtraTreasury({ _extraTreasury: new Address(newExtraTreasury) }).send({
				from: new Address(from),
				amount: '200000000',
				bounce: false,
			});
		});
	}

	async getBeneficiary(mailer: ITVMMailerContractLink): Promise<string> {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.beneficiary()
				.call()
				.then(r => r.beneficiary.toString());
		});
	}

	async setBeneficiary(mailer: ITVMMailerContractLink, from: string, beneficiary: string) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods.setBeneficiary({ _beneficiary: new Address(beneficiary) }).send({
				from: new Address(from),
				amount: '200000000',
				bounce: false,
			});
		});
	}

	async getFees(
		mailer: ITVMMailerContractLink,
	): Promise<{ contentPartFee: string; recipientFee: string; broadcastFee: string }> {
		return await this.cache.contractOperation(mailer, async contract => {
			const [{ contentPartFee }, { recipientFee }, { broadcastFee }] = await Promise.all([
				contract.methods.contentPartFee().call(),
				contract.methods.recipientFee().call(),
				contract.methods.broadcastFee().call(),
			]);
			return {
				contentPartFee,
				recipientFee,
				broadcastFee,
			};
		});
	}

	async setFees(
		mailer: ITVMMailerContractLink,
		from: string,
		fees: { contentPartFee: number; recipientFee: number; broadcastFee: number },
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.setFees({
					_contentPartFee: BigInt(fees.contentPartFee).toString(10),

					_recipientFee: BigInt(fees.recipientFee).toString(10),

					_broadcastFee: BigInt(fees.broadcastFee).toString(10),
				})
				.send({
					from: new Address(from),
					amount: '200000000',
					bounce: false,
				});
		});
	}

	async buildHash(
		mailer: ITVMMailerContractLink,
		pubkey: Uint8Array,
		uniqueId: number,
		time: number,
	): Promise<Uint256> {
		const args = {
			pubkey: publicKeyToBigIntString(pubkey),
			uniqueId,
			time,
		};
		return await this.cache.contractOperation(mailer, async contract => {
			const result = await contract.methods.buildHash(args).call();
			return bigIntToUint256(BigInt(result._hash).toString(10));
		});
	}

	async composeFeedId(mailer: ITVMMailerContractLink, feedId: Uint256, count: number): Promise<Uint256> {
		return await this.cache.contractOperation(mailer, async contract => {
			const result = await contract.methods.composeFeedId({ feedId: `0x${feedId}`, count }).call();
			return bigIntToUint256(BigInt(result._feedId).toString(10));
		});
	}

	async sendSmallMail(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		recipient: Uint256,
		key: Uint8Array,
		content: Uint8Array,
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.sendSmallMail({
					uniqueId,
					recipient: new Address(uint256ToAddress(recipient)),
					key: new SmartBuffer(key).toBase64String(),
					content: new SmartBuffer(content).toBase64String(),
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendBulkMail(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		recipients: Uint256[],
		keys: Uint8Array[],
		content: Uint8Array,
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.sendBulkMail({
					uniqueId,
					recipients: recipients.map(r => new Address(uint256ToAddress(r))),
					keys: keys.map(k => new SmartBuffer(k).toBase64String()),
					content: new SmartBuffer(content).toBase64String(),
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async addRecipients(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		initTime: number,
		recipients: Uint256[],
		keys: Uint8Array[],
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.addRecipients({
					uniqueId,
					initTime,
					recipients: recipients.map(r => new Address(uint256ToAddress(r))),
					keys: keys.map(k => new SmartBuffer(k).toBase64String()),
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendBroadcast(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		content: Uint8Array,
		feedId: Uint256,
		extraPayment: number,
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.broadcastMail({
					feedId: `0x${feedId}`,
					uniqueId,
					content: new SmartBuffer(content).toBase64String(),
					extraPayment: extraPayment * 1000000000,
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendBroadcastHeader(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		initTime: number,
		feedId: Uint256,
		extraPayment: number,
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.broadcastMailHeader({
					feedId: `0x${feedId}`,
					uniqueId,
					initTime,
					extraPayment: extraPayment * 1000000000,
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendMessageContentPart(
		mailer: ITVMMailerContractLink,
		from: string,
		uniqueId: number,
		initTime: number,
		parts: number,
		partIdx: number,
		content: Uint8Array,
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.sendMultipartMailPart({
					uniqueId,
					initTime,
					parts,
					partIdx,
					content: new SmartBuffer(content).toBase64String(),
				})
				.send({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async getBroadcastPushEvent(mailer: ITVMMailerContractLink, id: string): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const event = await TVMBlockchainReader.getMessage(gql, id);
			if (!event) {
				return null;
			}
			return this.formatBroadcastMessage(core, mailer, event);
		});
	}

	async getMailPushEvent(mailer: ITVMMailerContractLink, id: string): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const event = await TVMBlockchainReader.getMessage(gql, id);
			if (!event) {
				return null;
			}
			return this.formatMailMessage(core, mailer, event);
		});
	}

	async retrieveMessageContent(
		mailer: ITVMMailerContractLink,
		message: ITVMMessage,
	): Promise<IMessageContent | IMessageCorruptedContent | null> {
		return this.blockchainReader.retrieveAndVerifyMessageContent(
			mailer.address,
			this.decodeContentMessageBody.bind(this),
			message,
		);
	}
}

export const MAILER_V8_ABI = {
	'ABI version': 2,
	'version': '2.2',
	'header': ['pubkey', 'time', 'expire'],
	'functions': [
		{
			name: 'constructor',
			inputs: [{ name: '_owner', type: 'address' }],
			outputs: [],
		},
		{
			name: 'setFees',
			inputs: [
				{ name: '_contentPartFee', type: 'uint128' },
				{ name: '_recipientFee', type: 'uint128' },
				{ name: '_broadcastFee', type: 'uint128' },
			],
			outputs: [],
		},
		{
			name: 'setBeneficiary',
			inputs: [{ name: '_beneficiary', type: 'address' }],
			outputs: [],
		},
		{
			name: 'setExtraTreasury',
			inputs: [{ name: '_extraTreasury', type: 'address' }],
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
			name: 'composeFeedId',
			inputs: [
				{ name: 'feedId', type: 'uint256' },
				{ name: 'count', type: 'uint32' },
			],
			outputs: [{ name: '_feedId', type: 'uint256' }],
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
				{ name: 'feedId', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'content', type: 'bytes' },
				{ name: 'extraPayment', type: 'uint128' },
			],
			outputs: [],
		},
		{
			name: 'broadcastMailHeader',
			inputs: [
				{ name: 'feedId', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
				{ name: 'extraPayment', type: 'uint128' },
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
			name: 'nonce',
			inputs: [],
			outputs: [{ name: 'nonce', type: 'uint256' }],
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
			name: 'broadcastFee',
			inputs: [],
			outputs: [{ name: 'broadcastFee', type: 'uint128' }],
		},
		{
			name: 'beneficiary',
			inputs: [],
			outputs: [{ name: 'beneficiary', type: 'address' }],
		},
		{
			name: 'extraTreasury',
			inputs: [],
			outputs: [{ name: 'extraTreasury', type: 'address' }],
		},
	],
	'data': [
		{ key: 1, name: 'nonce', type: 'uint256' },
		{ key: 2, name: 'beneficiary', type: 'address' },
		{ key: 3, name: 'extraTreasury', type: 'address' },
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
			inputs: [
				{ name: 'sender', type: 'address' },
				{ name: 'msgId', type: 'uint256' },
				{ name: 'extraPayment', type: 'uint128' },
			],
			outputs: [],
		},
	],
	'fields': [
		{ name: '_pubkey', type: 'uint256' },
		{ name: '_timestamp', type: 'uint64' },
		{ name: '_constructorFlag', type: 'bool' },
		{ name: 'owner', type: 'address' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'broadcastFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
		{ name: 'extraTreasury', type: 'address' },
	],
} as const;

const MAILER_V8_TVC_BASE64 =
	'te6ccgECUAEADMMAAgE0AwEBAcACAEPQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBCSK7VMg4wMgwP/jAiDA/uMC8gtNBQRPA8LtRNDXScMB+GaJ+Gkh2zzTAAGOHIMI1xgg+QEB0wABlNP/AwGTAvhC4iD4ZfkQ8qiV0wAB8nri0z8B+EMhufK0IPgjgQPoqIIIG3dAoLnytPhj0x8B+CO88rnTHwHbPPI8RiEGA1LtRNDXScMB+GYi0NMD+kAw+GmpOADcIccA4wIh1w0f8rwh4wMB2zzyPExMBgIoIIIQY5TP/LvjAiCCEHZdSRW74wIWBwIoIIIQcezXh7vjAiCCEHZdSRW74wILCAIoIIIQclUCnLrjAiCCEHZdSRW64wIKCQFQMNHbPPhOIY4cjQRwAAAAAAAAAAAAAAAAPZdSRWDIzst/yXD7AN7yAEsBTjDR2zz4UCGOG40EcAAAAAAAAAAAAAAAADyVQKcgyM7OyXD7AN7yAEsEUCCCEGojJcq64wIgghBtvplzuuMCIIIQb0O/6rrjAiCCEHHs14e64wITDw4MAzYw+Eby4Ez4Qm7jACGT1NHQ3vpA0ds8MNs88gBLDUkAFvhJ+ErHBfLgZPhwAnIw+Eby4Ewhk9TR0N7T/9Mf0ds8IY4cI9DTAfpAMDHIz4cgzoIQ70O/6s8Lgcv/yXD7AJEw4uMA8gAnNgNKMPhG8uBM+EJu4wDTH9Mf9ARZbwIB0x/0BFlvAgHU0ds84wDyAEsQNgOoghJUC+QAcPsC+EUgbpIwcN5VA9s82zwggwcgyM+FgMsIAc8BydBYcHEk+ElVBMjPhyDOcc8LYVVAyM+RSUGhcs7L/8sPyw/Mzclw+wBwlVMDbxC5MTkRAfyOSlMDbxGAIPQO8rL6Qm8T1wv/gwcgyM+FgMsIAc8BydBTE28RgCD0D/KyI/hJVQLIz4cgznHPC2FVIMjPkSJpWX7Oy//Mzclw+wCk6F8D+Ez4TSJvEKigwgCOHfhM+E0ibxCooLV/+E/Iz4UIzgH6AoBrz0DJcPsA3jD4ScgSABrPhQjOgG/PQMmDBvsAAzYw+Eby4Ez4Qm7jANMf0x/TD9MP1NHbPOMA8gBLFDYE/oISVAvkAHD7Ats8JL7y4GfbPCShtR+BAli78uBo+EUgbpIwcN5VE9s8IIMHIMjPhYDLCAHPAcnQAV4h+ElVBMjPhyDOcc8LYVVAyM+RSUGhcs7L/8sPyw/Mzclw+wD4TMIAjhT4TPhPyM+FCM4B+gKAa89AyXD7AN74ScjPhQgxMTkVABTOgG/PQMmDBvsABFAgghARljqEu+MCIIIQKaunBrvjAiCCEEdWVNy74wIgghBjlM/8u+MCNCofFwRQIIIQW/RAzrrjAiCCEF8Lz9664wIgghBhDoZZuuMCIIIQY5TP/LrjAhwbGhgCdjD4RvLgTCGT1NHQ3tP/0x/TH9HbPCGOHCPQ0wH6QDAxyM+HIM6CEOOUz/zPC4HL/8lw+wCRMOLjAPIAGTYBBNs8OQFOMNHbPPhPIY4bjQRwAAAAAAAAAAAAAAAAOEOhlmDIzs7JcPsA3vIASwFOMNHbPPhKIY4bjQRwAAAAAAAAAAAAAAAAN8Lz96DIzs7JcPsA3vIASwNAMPhG8uBM+EJu4wAhk9TR0N7T/9Mf0x/Tf9HbPOMA8gBLHTYD/oISVAvkAHD7AvhFIG6SMHDeWts8WHHbPCJY+ElVAoMHIMjPhYDLCAHPAcnQyM+HIM5xzwthVSDIz5CAwhWqzsv/y3/NyXD7APhOwgCOFPhO+E/Iz4UIzgH6AoBrz0DJcPsA3iDCAI4TIPhQyM+FCM4B+gKAa89AyXD7AN4w+Ek5Jx4AHMjPhQjOgG/PQMmDBvsABFAgghAstim5uuMCIIIQN7GPUrrjAiCCEESw5bO64wIgghBHVlTcuuMCKSgkIAJcMPhCbuMA+EbycyGT1NHQ3vpA0fhq+ELy4GX4RSBukjBw3vhCuvLgZvgA2zzyACFJAhbtRNDXScIBjoDjDSJLA5xw7UTQ9AWJcSKAQPQOb5GT1wv/3nBfIHImgED0Do6A33MngED0Do6A3/hw+G/4bvht+Gz4a/hqgED0DvK91wv/+GJw+GNw+Gxw+G1w+G5GIyMBAolGAz4w+Eby4Ez4Qm7jACGT1NHQ3tP/0x/U03/R2zzjAPIASyU2BP6CElQL5ABw+wL4RSBukjBw3lUC2zzbPFUCcds8VQJwcST4SSaDByDIz4WAywgBzwHJ0MjPhyDOcc8LYVVAyM+RSUGhcs7L/8sPyw/Mzclw+wAiWPhJVQKDByDIz4WAywgBzwHJ0MjPhyDOcc8LYVUgyM+QgMIVqs7L/8t/zclwMTknJgCi+wD4TPhOoLV/wgCOGfhM+E6gtX/4T8jPhQjOAfoCgGvPQMlw+wDeIMIAjhMg+FDIz4UIzgH6AoBrz0DJcPsA3jD4ScjPhQjOgG/PQMmDBvsAAR4ByMv/yQHIyx/J2zzQ+QI6AnYw+Eby4Ewhk9TR0N7T/9Mf0x/R2zwhjhwj0NMB+kAwMcjPhyDOghC3sY9SzwuBy//JcPsAkTDi4wDyADk2AVAw0ds8+EshjhyNBHAAAAAAAAAAAAAAAAArLYpuYMjOy//JcPsA3vIASwRQIIIQF8nysrrjAiCCEBh4jzi64wIgghApZd9MuuMCIIIQKaunBrrjAjIuLCsBUDDR2zz4TSGOHI0EcAAAAAAAAAAAAAAAACpq6cGgyM7Lf8lw+wDe8gBLAyYw+Eby4Ez4Qm7jANHbPDDbPPIASy1JADT4SfhKxwXy4GT4SsjPhQjOgG/PQMmBAKD7AANCMPhG8uBM+EJu4wAhldMf1NHQktMf4vpA1NTR2zzjAPIASy82A/6CElQL5ABw+wL4RSBukjBw3lUD2zzbPCCDByDIz4WAywgBzwHJ0FUD+kJvE9cL/4MHIMjPhYDLCAHPAcnQVQJwcSX4SVUFyM+HIM5xzwthVUDIz5FJQaFyzsv/yw/LD8zNyXD7AFn4SVUCyM+HIM5xzwthVSDIz5EiaVl+zsv/MTkwAHbMzclw+wD4TPhNoLV/wgCOGfhM+E2gtX/4T8jPhQjOAfoCgGvPQMlw+wDe+EnIz4UIzoBvz0DJgwb7AABGaKb7YJFwjhpopv1g0NMD+kD6QPoA9AT6APoA0z/XCx9sgeIDNjD4RvLgTPhCbuMAIZPU0dDe+kDR2zww2zzyAEszSQAW+En4SscF8uBk+G8EUCCCEAYPZk264wIgghALAzeVuuMCIIIQDgTSnrrjAiCCEBGWOoS64wJIR0Q1A3Iw+Eby4Ez4Qm7jACGf0x/TH9Mf9ARZbwIB1NHQnNMf0x/TH/QEWW8CAeLTH/QEWW8CAdHbPOMA8gBLNzYAKO1E0NP/0z8x+ENYyMv/yz/Oye1UAuaCElQL5ABw+wL4RSBukjBw3lUS2zxwlVMDbxC5jkpTA28RgCD0DvKy+kJvE9cL/4MHIMjPhYDLCAHPAcnQUxNvEYAg9A/ysiP4SVUCyM+HIM5xzwthVSDIz5EiaVl+zsv/zM3JcPsApOhfA/hNIW8QqMIAOTgAXI4a+E0hbxCotX/4T8jPhQjOAfoCgGvPQMlw+wDeMPhJyM+FCM6Ab89AyYMG+wACLFjIy//JWMjLH8nbPAHIyx/J2zzQ+QI6OgQsAds8WNBfMts8MzOUIHHXRo6A6DDbPEE/PjsBGJYhb4jAALOOgOjJMTwBDCHbPDPPET0AHG+Nb41ZIG+Ikm+MkTDiARDVMV8y2zwzMz8BOCHPNab5IddLIJYjcCLXMTTeMCG7joDfUxLObDFAARpc1xgzI84zXds8NMgzQwEebwAB0JUg10rDAI6A6MjOQgES1QHIzlIg2zwyQwA4URBviJ5vjSBviIQHoZRvjG8A35JvAOJYb4xvjAM2MPhG8uBM+EJu4wAhk9TR0N76QNHbPDDbPPIAS0VJASb4SfhKxwXy4GQgiccFkyD4at8wRgBDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAFQMNHbPPhMIY4cjQRwAAAAAAAAAAAAAAAAIsDN5WDIzst/yXD7AN7yAEsDPjD4RvLgTPhCbuMAIZPU0dDe03/Tf9N/0ds8MNs88gBLSkkAYvhQ+E/4TvhN+Ez4S/hK+EP4QsjL/8s/z4POVVDIy//Lf8t/y39ZyM4ByM7Nzc3J7VQAIvhJ+ErHBfLgZFj4bAH4bfhuAGjtRNDT/9M/0wAx+kDU0dDT/9N/03/Tf9TR0PpA1NHQ+kDR+HD4b/hu+G34bPhr+Gr4Y/hiAAr4RvLgTAIK9KQg9KFPTgAUc29sIDAuNjIuMAAA';
