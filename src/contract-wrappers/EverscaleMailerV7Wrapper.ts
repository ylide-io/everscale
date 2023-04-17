import type { IGenericAccount, IMessageContent, IMessageCorruptedContent, ISourceSubject, Uint256 } from '@ylide/sdk';
import { BlockchainSourceType, bigIntToUint256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, ProviderRpcClient, Transaction } from 'everscale-inpage-provider';
import { EverscaleBlockchainReader, NekotonCore } from '../controllers/helpers/EverscaleBlockchainReader';
import {
	ITVMInternalMessage,
	ITVMMailerContractLink,
	ITVMMessage,
	ITVMRecipientsMessageBody,
	encodeTvmMsgId,
	everscaleAddressToUint256,
	publicKeyToBigIntString,
	randomHex,
	uint256ToAddress,
} from '../misc';
import { ContractCache } from './ContractCache';
import { EverscaleDeployer } from './EverscaleDeployer';

export class EverscaleMailerV7Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V7_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V7_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V7_ABI,
			{
				tvc: MAILER_V7_TVC_BASE64,
				workchain: 0,
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				publicKey: from.publicKey!.toHex(),
				initParams: {
					beneficiary: beneficiaryAddress,
					nonce: BigInt(`0x${randomHex(64)}`).toString(10),
				} as never,
			},
			{} as never,
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
		return {
			sender: (data.data.sender as string).startsWith(':')
				? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				  `0${data.data.sender}`
				: (data.data.sender as string),
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

	decodeRecipientsMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V7_ABI), 'ContentRecipients');
		if (!data) {
			throw new Error('RecipientsMessage format is not supported');
		}
		return {
			sender: data.data.sender as string,
			msgId: bigIntToUint256(data.data.msgId as string),
			recipients: data.data.recipients as string[],
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
			// TODO!!!
			feedId: '0000000000000000000000000000000000000000000000000000000000000000' as Uint256,
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
					: subject.sender;

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
			// @ts-ignore
			return await contract.methods.owner().call();
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
			// @ts-ignore
			return await contract.methods.transferOwnership({ newOwner: owner }).sendWithResult({
				from: new Address(from),
				amount: '200000000',
				bounce: false,
			});
		});
	}

	async getBenificiary(mailer: ITVMMailerContractLink): Promise<string> {
		return await this.cache.contractOperation(mailer, async contract => {
			// @ts-ignore
			return await contract.methods.beneficiary().call();
		});
	}

	async setBenificiary(mailer: ITVMMailerContractLink, from: string, beneficiary: string) {
		return await this.cache.contractOperation(mailer, async contract => {
			// @ts-ignore
			return await contract.methods.setBenificiary({ _beneficiary: beneficiary }).sendWithResult({
				from: new Address(from),
				amount: '200000000',
				bounce: false,
			});
		});
	}

	async getFees(
		mailer: ITVMMailerContractLink,
	): Promise<{ contentPartFee: string; recipientFee: string; broadcastFee: string }> {
		//  broadcastFee: BigNumber
		return await this.cache.contractOperation(mailer, async contract => {
			// @ts-ignore
			const contentPartFee = await contract.methods.contentPartFee().call();
			// @ts-ignore
			const recipientFee = await contract.methods.recipientFee().call();
			// @ts-ignore
			const broadcastFee = await contract.functions.broadcastFee().call();

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
				// @ts-ignore
				.setFees({
					// @ts-ignore
					_contentPartFee: BigInt(fees.contentPartFee).toString(10),
					// @ts-ignore
					_recipientFee: BigInt(fees.recipientFee).toString(10),
					// @ts-ignore
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
			// @ts-ignore
			const result: any = await contract.methods.buildHash(args).call();
			return bigIntToUint256(BigInt(result._hash).toString(10));
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
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});

		// const contract = this.cache.getContract(mailer.address, signer);
		// const tx = await contract.sendSmallMail(uniqueId, `0x${recipient}`, key, content, { from });
		// const receipt = await tx.wait();
		// const logs = receipt.logs.map(l => ({
		// 	log: l,
		// 	logDescription: contract.interface.parseLog(l),
		// }));
		// const mailPushEvents = logs
		// 	.filter(l => l.logDescription.name === 'MailPush')
		// 	.map(l => this.mailPushLogToEvent(l));
		// const enriched = await this.blockchainReader.enrichEvents<MailPushEvent>(mailPushEvents);
		// const messages = enriched.map(e => this.processMailPushEvent(mailer, e));
		// return { tx, receipt, logs: logs.map(l => l.logDescription), mailPushEvents, messages };
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
				// @ts-ignore
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
		// uint256 publicKey, uint32 uniqueId, uint32 initTime, address[] recipients, bytes[] keys
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				// @ts-ignore
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
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendBroadcast(mailer: ITVMMailerContractLink, from: string, uniqueId: number, content: Uint8Array) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				// @ts-ignore
				.broadcastMail({
					// @ts-ignore
					uniqueId,
					// @ts-ignore
					content: new SmartBuffer(content).toBase64String(),
				})
				.sendWithResult({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}

	async sendBroadcastHeader(mailer: ITVMMailerContractLink, from: string, uniqueId: number, initTime: number) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				// @ts-ignore
				.broadcastMail({
					// @ts-ignore
					uniqueId,
					// @ts-ignore
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
				// @ts-ignore
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

	async retrieveMessageRecipients(
		mailer: ITVMMailerContractLink,
		message: ITVMMessage,
	): Promise<ITVMRecipientsMessageBody | null> {
		return this.blockchainReader.retrieveMessageRecipients(
			mailer.address,
			this.decodeRecipientsMessageBody.bind(this),
			message.msgId,
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
			name: 'immediatelyTerminate',
			inputs: [],
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
			name: 'terminated',
			inputs: [],
			outputs: [{ name: 'terminated', type: 'bool' }],
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
			name: 'ContentRecipients',
			inputs: [
				{ name: 'sender', type: 'address' },
				{ name: 'msgId', type: 'uint256' },
				{ name: 'recipients', type: 'address[]' },
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
		{ name: 'terminated', type: 'bool' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'broadcastFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
};

const MAILER_V7_TVC_BASE64 =
	'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';
