import {
	bigIntToUint256,
	BlockchainSourceType,
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	ISourceSubject,
	MessageContentFailure,
	Uint256,
} from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, Transaction } from 'everscale-inpage-provider';
import { EverscaleBlockchainReader, NekotonCore } from '../controllers/helpers/EverscaleBlockchainReader';
import {
	everscaleAddressToUint256,
	ITVMMessage,
	ITVMMailerContractLink,
	uint256ToAddress,
	ITVMInternalMessage,
	encodeTvmMsgId,
	publicKeyToBigIntString,
} from '../misc';
import { ContractCache } from './ContractCache';

export class EverscaleMailerV6Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V6_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V6_ABI, blockchainReader);
	}

	decodeBroadcastMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V6_ABI), 'MailBroadcast');
		if (!data) {
			throw new Error('MailBroadcast format is not supported');
		}
		return {
			msgId: bigIntToUint256(data.data.msgId as string),
		};
	}

	decodePushMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V6_ABI), 'MailPush');
		if (!data) {
			throw new Error('MailPush format is not supported');
		}
		return {
			sender: (data.data.sender as string).startsWith(':')
				? `0${data.data.sender}`
				: (data.data.sender as string),
			msgId: bigIntToUint256(data.data.msgId as string),
			key: SmartBuffer.ofBase64String(data.data.key as string).bytes,
		};
	}

	decodeContentMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V6_ABI), 'MailContent');
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
			msgId: encodeTvmMsgId(false, mailer.id, BigInt(message.created_lt)),
			createdAt: message.created_at,
			senderAddress: body.sender,
			recipientAddress: everscaleAddressToUint256(message.dst),
			blockchain: 'everscale',

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
			msgId: encodeTvmMsgId(true, mailer.id, BigInt(message.created_lt)),
			createdAt: message.created_at,
			senderAddress: message.dst,
			recipientAddress: everscaleAddressToUint256(message.dst),
			blockchain: 'everscale',

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

	async getFees(mailer: ITVMMailerContractLink): Promise<{ contentPartFee: string; recipientFee: string }> {
		//  broadcastFee: BigNumber
		return await this.cache.contractOperation(mailer, async contract => {
			// @ts-ignore
			const contentPartFee = await contract.methods.contentPartFee().call();
			// @ts-ignore
			const recipientFee = await contract.methods.recipientFee().call();
			// const [broadcastFee] = await contract.functions.broadcastFee();

			return {
				contentPartFee: contentPartFee,
				recipientFee: recipientFee,
				// broadcastFee: broadcastFee.div(BigNumber.from('1000000000000000000')),
			};
		});
	}

	async setFees(
		mailer: ITVMMailerContractLink,
		from: string,
		fees: { contentPartFee: number; recipientFee: number },
		//  broadcastFee: BigNumber
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				// @ts-ignore
				.setFees({
					// @ts-ignore
					_contentPartFee: BigInt(fees.contentPartFee).toString(10),
					// @ts-ignore
					_recipientFee: BigInt(fees.recipientFee).toString(10),
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
}

export const MAILER_V6_ABI = {
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
	'data': [{ key: 1, name: 'beneficiary', type: 'address' }],
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
		{ name: 'terminated', type: 'bool' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'broadcastFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
};
