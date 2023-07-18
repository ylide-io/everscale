import type { IGenericAccount, IMessageContent, IMessageCorruptedContent, ISourceSubject, Uint256 } from '@ylide/sdk';
import { bigIntToUint256, BlockchainSourceType } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, ProviderRpcClient } from 'everscale-inpage-provider';
import { EverscaleBlockchainReader, NekotonCore } from '../controllers/helpers/EverscaleBlockchainReader';
import {
	everscaleAddressToUint256,
	ITVMMessage,
	ITVMMailerContractLink,
	uint256ToAddress,
	ITVMInternalMessage,
	encodeTvmMsgId,
	publicKeyToBigIntString,
	randomHex,
} from '../misc';
import { ContractCache } from './ContractCache';
import { EverscaleDeployer } from './EverscaleDeployer';

export class EverscaleMailerV8Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V8_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V8_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		if (!from.publicKey) {
			throw new Error('Public key is null');
		}
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V8_ABI,
			{
				tvc: MAILER_V8_TVC_BASE64,
				workchain: 0,
				publicKey: from.publicKey.toHex(),
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
			feedId: message.dst as Uint256,
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

	async retrieveHistoryDesc(
		mailer: ITVMMailerContractLink,
		subject: ISourceSubject,
		fromMessage: ITVMMessage | null,
		// includeFromMessage: boolean,
		toMessage: ITVMMessage | null,
		// includeToMessage: boolean,
		limit?: number,
	): Promise<ITVMMessage[]> {
		return await this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const dst =
				subject.type === BlockchainSourceType.DIRECT
					? subject.recipient
						? uint256ToAddress(subject.recipient, true, true)
						: null
					: uint256ToAddress(subject.feedId, true, true);

			const events = await EverscaleBlockchainReader.queryMessagesListDesc(
				gql,
				mailer.address,
				dst,
				fromMessage,
				// includeFromMessage,
				toMessage,
				// includeToMessage,
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
			return await contract.methods.transferOwnership({ newOwner: new Address(owner) }).sendWithResult({
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
			return await contract.methods
				.setExtraTreasury({ _extraTreasury: new Address(newExtraTreasury) })
				.sendWithResult({
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
			return await contract.methods.setBeneficiary({ _beneficiary: new Address(beneficiary) }).sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
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
				.sendWithResult({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async getBroadcastPushEvent(mailer: ITVMMailerContractLink, id: string): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const event = await EverscaleBlockchainReader.getMessage(gql, id);
			if (!event) {
				return null;
			}
			return this.formatBroadcastMessage(core, mailer, event);
		});
	}

	async getMailPushEvent(mailer: ITVMMailerContractLink, id: string): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const event = await EverscaleBlockchainReader.getMessage(gql, id);
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
	'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';
