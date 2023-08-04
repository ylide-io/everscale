import type {
	RemotePublicKey,
	ILooseSourceSubject,
	IMessageContent,
	IMessageCorruptedContent,
	Uint256,
} from '@ylide/sdk';
import { bigIntToUint256, BlockchainSourceType } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';
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
	ITVMContentMessageBody,
	TVMWalletAccount,
} from '../misc';
import { ContractCache } from './ContractCache';
import { EverscaleDeployer } from './EverscaleDeployer';

export class EverscaleMailerV6Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V6_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V6_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: TVMWalletAccount, beneficiaryAddress: string): Promise<string> {
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V6_ABI,
			{
				tvc: MAILER_V6_TVC_BASE64,
				workchain: 0,
				publicKey: from.$$meta.publicKeyHex,
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
				? // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				  `0${data.data.sender}`
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
				await EverscaleBlockchainReader.queryMessagesList(
					gql,
					'asc',
					mailer.address,
					null,
					fromMessage,
					null,
					limit,
				)
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
					: subject.sender;

			const events = await EverscaleBlockchainReader.queryMessagesList(
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
		{ name: 'terminated', type: 'bool' },
		{ name: 'nonce', type: 'uint256' },
		{ name: 'contentPartFee', type: 'uint128' },
		{ name: 'recipientFee', type: 'uint128' },
		{ name: 'broadcastFee', type: 'uint128' },
		{ name: 'beneficiary', type: 'address' },
	],
};

const MAILER_V6_TVC_BASE64 =
	'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';
