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

export class EverscaleMailerV7Wrapper {
	private readonly cache: ContractCache<typeof MAILER_V7_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(MAILER_V7_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: TVMWalletAccount, beneficiaryAddress: string): Promise<string> {
		const contractAddress = await EverscaleDeployer.deployContract(
			ever,
			from,
			MAILER_V7_ABI,
			{
				tvc: MAILER_V7_TVC_BASE64,
				workchain: 0,
				publicKey: from.$$meta.publicKeyHex,
				initParams: {
					beneficiary: new Address(beneficiaryAddress),
					nonce: BigInt(`0x${randomHex(64)}`).toString(10),
				},
			},
			{ _owner: new Address(from.address) },
			'1000000000',
		);

		return contractAddress.contract.address.toString();
	}

	decodeBroadcastMessageBody(core: NekotonCore, body: string) {
		const data = core.decodeEvent(body, JSON.stringify(MAILER_V7_ABI), 'MailBroadcast');
		if (!data) {
			throw new Error('MailBroadcast format is not supported');
		}
		const address = data.data.sender?.toString() || '';
		return {
			sender: address.startsWith(':') ? `0${address}` : address,
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
					: subject.feedId
					? uint256ToAddress(subject.feedId, true, true)
					: null;

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
	) {
		return await this.cache.contractOperation(mailer, async contract => {
			return await contract.methods
				.broadcastMail({
					feedId: `0x${feedId}`,
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
					feedId: `0x${feedId}`,
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

export const MAILER_V7_ABI = {
	'ABI version': 2,
	'version': '2.3',
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
	],
} as const;

const MAILER_V7_TVC_BASE64 =
	'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';
