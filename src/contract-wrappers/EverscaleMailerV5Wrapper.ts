import type { IGenericAccount, IMessageContent, IMessageCorruptedContent, ISourceSubject, Uint256 } from '@ylide/sdk';
import { BlockchainSourceType, bigIntToUint256 } from '@ylide/sdk';
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
	ITVMContentMessageBody,
	publicKeyToBigIntString,
} from '../misc';
import { ContractCache } from './ContractCache';
import { EverscaleDeployer } from './EverscaleDeployer';

export class EverscaleMailerV5Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V5_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V5_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V5_ABI,
			{
				tvc: MAILER_V5_TVC_BASE64,
				workchain: 0,
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				publicKey: from.publicKey!.toHex(),
				initParams: {
					beneficiary: beneficiaryAddress,
				} as never,
			},
			{} as never,
			'1000000000',
		);

		return contractAddress.contract.address.toString();
	}

	decodeBroadcastMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V5_ABI), 'MailBroadcast');
		if (!data) {
			throw new Error('MailBroadcast format is not supported');
		}
		return {
			msgId: bigIntToUint256(data.data.msgId as string),
		};
	}

	decodePushMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V5_ABI), 'MailPush');
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

	decodeContentMessageBody(core: NekotonCore, body: string): ITVMContentMessageBody {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V5_ABI), 'MailContent');
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
			// TODO!!!
			feedId: '0000000000000000000000000000000000000000000000000000000000000000' as Uint256,
			msgId: encodeTvmMsgId(true, mailer.id, message.id),
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

				cursor: message.cursor,
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
					: subject.sender;

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
				contentPartFee,
				recipientFee,
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

export const MAILER_V5_ABI = {
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
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
};

export const MAILER_V5_TVC_BASE64 =
	'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';
