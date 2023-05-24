import type { IGenericAccount, IMessageContent, IMessageCorruptedContent, ISourceSubject, Uint256 } from '@ylide/sdk';
import { bigIntToUint256, BlockchainSourceType } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, ProviderRpcClient, Transaction } from 'everscale-inpage-provider';
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

export class EverscaleMailerV7Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V7_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V7_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		if (!from.publicKey) {
			throw new Error('Public key is null');
		}
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V7_ABI,
			{
				tvc: MAILER_V7_TVC_BASE64,
				workchain: 0,
				publicKey: from.publicKey.toHex(),
				initParams: {
					beneficiary: beneficiaryAddress,
					nonce: BigInt(`0x${randomHex(64)}`).toString(10),
				} as never,
			},
			{ _owner: from } as never,
			'1000000000',
		);

		return contractAddress.contract.address.toString();
	}

	decodeBroadcastMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V7_ABI), 'MailBroadcast');
		if (!data) {
			throw new Error('MailBroadcast format is not supported');
		}
		return {
			msgId: bigIntToUint256(data.data.msgId as string),
		};
	}

	decodePushMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V7_ABI), 'MailPush');
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
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V7_ABI), 'MailContent');
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
			msgId: encodeTvmMsgId(false, mailer.id, BigInt(message.created_lt)),
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
			msgId: encodeTvmMsgId(true, mailer.id, BigInt(message.created_lt)),
			createdAt: message.created_at,
			senderAddress: message.dst,
			recipientAddress: everscaleAddressToUint256(message.dst),
			blockchain: this.blockchainReader.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',

			key: new Uint8Array(0),

			$$meta: {
				id: message.id,
				created_lt: message.created_lt,
				src: message.src,
				dst: message.dst,

				internalMsgId: body.msgId,
			},
		};
	}

	async retrieveHistoryDesc(
		mailer: ITVMMailerContractLink,
		subject: ISourceSubject,
		fromMessage: ITVMMessage | null,
		includeFromMessage: boolean,
		toMessage: ITVMMessage | null,
		includeToMessage: boolean,
		limit?: number,
	): Promise<ITVMMessage[]> {
		return await this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const dst =
				subject.type === BlockchainSourceType.DIRECT
					? subject.recipient
						? uint256ToAddress(subject.recipient, true, true)
						: null
					: subject.feedId;

			const events = await EverscaleBlockchainReader.queryMessagesListDesc(
				gql,
				mailer.address,
				dst,
				fromMessage,
				includeFromMessage,
				toMessage,
				includeToMessage,
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

	async setOwner(
		mailer: ITVMMailerContractLink,
		from: string,
		owner: string,
	): Promise<{
		parentTransaction: Transaction;
		childTransaction: Transaction;
		output?: any;
	}> {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods.transferOwnership({ newOwner: new Address(owner) }).sendWithResult({
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
			const result: any = await contract.methods.buildHash(args).call();
			return bigIntToUint256(BigInt(result._hash).toString(10));
		});
	}

	async composeFeedId(mailer: ITVMMailerContractLink, feedId: Uint256, count: number): Promise<Uint256> {
		return await this.cache.contractOperation(mailer, async contract => {
			const result: any = await contract.methods.composeFeedId({ feedId, count }).call();
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
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.broadcastMail({
					feedId,
					uniqueId,
					content: new SmartBuffer(content).toBase64String(),
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
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.broadcastMailHeader({
					feedId,
					uniqueId,
					initTime,
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

	async getBroadcastPushEvent(mailer: ITVMMailerContractLink, lt: bigint): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const events = await EverscaleBlockchainReader.queryMessagesListDescRaw(
				gql,
				mailer.address,
				null,
				lt,
				true,
				lt,
				true,
				1,
			);
			if (events.length === 0) {
				return null;
			}
			const event = events[0];
			return this.formatBroadcastMessage(core, mailer, event);
		});
	}

	async getMailPushEvent(mailer: ITVMMailerContractLink, lt: bigint): Promise<ITVMMessage | null> {
		return this.cache.contractOperation(mailer, async (contract, ever, gql, core) => {
			const events = await EverscaleBlockchainReader.queryMessagesListDescRaw(
				gql,
				mailer.address,
				null,
				lt,
				true,
				lt,
				true,
				1,
			);
			if (events.length === 0) {
				return null;
			}
			const event = events[0];
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

export const MAILER_V7_ABI = {
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
			],
			outputs: [],
		},
		{
			name: 'broadcastMailHeader',
			inputs: [
				{ name: 'feedId', type: 'uint256' },
				{ name: 'uniqueId', type: 'uint32' },
				{ name: 'initTime', type: 'uint32' },
			],
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
	],
	'data': [
		{ key: 1, name: 'nonce', type: 'uint256' },
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
		{ name: 'nonce', type: 'uint256' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'broadcastFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
} as const;

const MAILER_V7_TVC_BASE64 =
	'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';
