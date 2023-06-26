/* eslint-disable @typescript-eslint/no-non-null-assertion */
import SmartBuffer from '@ylide/smart-buffer';
import { Address } from 'everscale-inpage-provider';
import {
	IMessage,
	IMessageContent,
	IMessageCorruptedContent,
	IExtraEncryptionStrateryBulk,
	IExtraEncryptionStrateryEntry,
	Uint256,
	ISourceSubject,
	IBlockchainSourceSubject,
	LowLevelMessagesSource,
	randomBytes,
} from '@ylide/sdk';
import {
	AbstractBlockchainController,
	unpackSymmetricalyEncryptedData,
	MessageKey,
	PublicKey,
	PublicKeyType,
	packSymmetricalyEncryptedData,
	BlockchainControllerFactory,
	BlockchainSourceType,
	AbstractNameService,
	DynamicEncryptionRouter,
} from '@ylide/sdk';
import {
	decodeTvmMsgId,
	everscaleAddressToUint256,
	EVERSCALE_LOCAL,
	EVERSCALE_MAINNET,
	isTVMAddressValid,
	ITVMMailerContractLink,
	ITVMMessage,
	ITVMRegistryContractLink,
	TVMMailerContractType,
	TVMRegistryContractType,
	VENOM_TESTNET,
} from '../misc';
import { encrypt, generate_ephemeral, get_public_key } from '../encrypt';
import { ExternalYlidePublicKey } from '@ylide/sdk';
import { EverscaleBlockchainReader } from './helpers/EverscaleBlockchainReader';
import { EverscaleMailerV7Wrapper } from '../contract-wrappers/EverscaleMailerV7Wrapper';
import { EverscaleMailerV6Wrapper } from '../contract-wrappers/EverscaleMailerV6Wrapper';
import { EverscaleRegistryV2Wrapper } from '../contract-wrappers/EverscaleRegistryV2Wrapper';
import { EverscaleMailerV5Wrapper } from '../contract-wrappers/EverscaleMailerV5Wrapper';
import { EverscaleRegistryV1Wrapper } from '../contract-wrappers/EverscaleRegistryV1Wrapper';
import { EverscaleMailerV5Source, EverscaleMailerV6Source, EverscaleMailerV7Source } from '../messages-sources';

export class EverscaleBlockchainController extends AbstractBlockchainController {
	readonly blockchainReader: EverscaleBlockchainReader;

	static readonly mailerWrappers: Record<
		TVMMailerContractType,
		typeof EverscaleMailerV5Wrapper | typeof EverscaleMailerV6Wrapper | typeof EverscaleMailerV7Wrapper
	> = {
		[TVMMailerContractType.TVMMailerV5]: EverscaleMailerV5Wrapper,
		[TVMMailerContractType.TVMMailerV6]: EverscaleMailerV6Wrapper,
		[TVMMailerContractType.TVMMailerV7]: EverscaleMailerV7Wrapper,
	};

	static readonly registryWrappers: Record<
		TVMRegistryContractType,
		typeof EverscaleRegistryV1Wrapper | typeof EverscaleRegistryV2Wrapper
	> = {
		[TVMRegistryContractType.TVMRegistryV1]: EverscaleRegistryV1Wrapper,
		[TVMRegistryContractType.TVMRegistryV2]: EverscaleRegistryV2Wrapper,
	};

	readonly mailers: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV5Wrapper | EverscaleMailerV6Wrapper | EverscaleMailerV7Wrapper;
	}[] = [];
	readonly broadcasters: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV5Wrapper | EverscaleMailerV6Wrapper | EverscaleMailerV7Wrapper;
	}[] = [];
	readonly registries: {
		link: ITVMRegistryContractLink;
		wrapper: EverscaleRegistryV1Wrapper | EverscaleRegistryV2Wrapper;
	}[] = [];

	readonly currentMailer: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV7Wrapper;
	};
	readonly currentBroadcaster: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV7Wrapper;
	};
	readonly currentRegistry: { link: ITVMRegistryContractLink; wrapper: EverscaleRegistryV2Wrapper };

	readonly MESSAGES_FETCH_LIMIT = 50;

	readonly everscaleMainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];
	readonly venomTestnetEndpoints = ['https://gql-testnet.venom.foundation/graphql'];

	constructor(
		private readonly options: {
			type?: 'everscale-mainnet' | 'venom-testnet';
			dev?: boolean;
			endpoints?: string[];
			provider?: any;
			nekotonCore?: any;
		} = {},
	) {
		super();

		if (typeof options.type === 'undefined') {
			throw new Error('You must provide network type for Everscale controller');
		}

		const endpoints =
			options?.endpoints ||
			(options?.dev
				? ['http://localhost/graphql']
				: options.type === 'everscale-mainnet'
				? [...this.everscaleMainnetEndpoints]
				: [...this.venomTestnetEndpoints]);

		const contracts = options?.dev
			? EVERSCALE_LOCAL
			: options.type === 'everscale-mainnet'
			? EVERSCALE_MAINNET
			: VENOM_TESTNET;

		this.blockchainReader = new EverscaleBlockchainReader(
			options.type,
			endpoints,
			this.options.provider ? this.options.provider : null,
			options.dev || false,
			options.nekotonCore || undefined,
		);

		this.mailers = contracts.mailerContracts.map(link => ({
			link,
			wrapper: new EverscaleBlockchainController.mailerWrappers[link.type](this.blockchainReader),
		}));

		this.broadcasters = contracts.broadcasterContracts.map(link => ({
			link,
			wrapper: new EverscaleBlockchainController.mailerWrappers[link.type](this.blockchainReader),
		}));

		this.registries = contracts.registryContracts.map(link => ({
			link,
			wrapper: new EverscaleBlockchainController.registryWrappers[link.type](this.blockchainReader),
		}));

		const currentMailerLink = contracts.mailerContracts.find(c => c.id === contracts.currentMailerId)!;
		const currentBroadcasterLink = contracts.broadcasterContracts.find(
			c => c.id === contracts.currentBroadcasterId,
		)!;
		const currentRegistryLink = contracts.registryContracts.find(c => c.id === contracts.currentRegistryId)!;

		this.currentMailer = {
			link: currentMailerLink,
			wrapper: new EverscaleBlockchainController.mailerWrappers[currentMailerLink.type](
				this.blockchainReader,
			) as EverscaleMailerV7Wrapper,
		};

		this.currentBroadcaster = {
			link: currentBroadcasterLink,
			wrapper: new EverscaleBlockchainController.mailerWrappers[currentBroadcasterLink.type](
				this.blockchainReader,
			) as EverscaleMailerV7Wrapper,
		};

		this.currentRegistry = {
			link: currentRegistryLink,
			wrapper: new EverscaleBlockchainController.registryWrappers[currentRegistryLink.type](
				this.blockchainReader,
			) as EverscaleRegistryV2Wrapper,
		};
	}

	blockchainGroup(): string {
		return this.options.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet';
	}

	blockchain(): string {
		return this.options.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet';
	}

	isReadingBySenderAvailable(): boolean {
		return false;
	}

	defaultNameService(): AbstractNameService | null {
		return null;
	}

	async init(): Promise<void> {
		// np
	}

	async getComposedFeedIdDeprecated(feedId: Uint256, count: number) {
		return this.currentMailer.wrapper.composeFeedId(this.currentMailer.link, `0x${feedId}`, count);
	}

	async getComposedFeedId(feedId: Uint256, count: number) {
		return this.currentMailer.wrapper.composeFeedId(this.currentMailer.link, feedId, count);
	}

	async getBalance(address: string) {
		const stringValue = await this.blockchainReader.ever.getBalance(new Address(address));
		return {
			original: stringValue,
			numeric: Number(stringValue),
			// eslint-disable-next-line id-denylist
			string: stringValue,
			e18: stringValue,
		};
	}

	async getRecipientReadingRules(address: Uint256): Promise<any> {
		return [];
	}

	async extractPublicKeyFromAddress(address: string): Promise<ExternalYlidePublicKey | null> {
		const raw = await Promise.all(this.registries.map(reg => reg.wrapper.getPublicKeyByAddress(reg.link, address)));
		const active = raw.filter(r => r !== null) as ExternalYlidePublicKey[];
		active.sort((a, b) => b.timestamp - a.timestamp);
		return active.length ? active[0] : null;
	}

	async extractPublicKeysHistoryByAddress(address: string): Promise<ExternalYlidePublicKey[]> {
		const raw = (
			await Promise.all(this.registries.map(reg => reg.wrapper.getPublicKeysHistoryForAddress(reg.link, address)))
		).flat();
		raw.sort((a, b) => b.timestamp - a.timestamp);
		return raw;
	}

	isValidMsgId(msgId: string): boolean {
		try {
			const parsed = decodeTvmMsgId(msgId);
			return (
				(parsed.isBroadcast
					? this.broadcasters.find(b => b.link.id === parsed.contractId)
					: this.mailers.find(m => m.link.id === parsed.contractId)) !== undefined
			);
		} catch (err) {
			return false;
		}
	}

	async getMessageByMsgId(msgId: string): Promise<ITVMMessage | null> {
		const parsed = decodeTvmMsgId(msgId);
		const mailer = parsed.isBroadcast
			? this.broadcasters.find(b => b.link.id === parsed.contractId)
			: this.mailers.find(m => m.link.id === parsed.contractId);

		if (!mailer) {
			throw new Error(`Unknown contract ${parsed.contractId}`);
		}

		if (parsed.isBroadcast) {
			return await mailer.wrapper.getBroadcastPushEvent(mailer.link, parsed.id);
		} else {
			return await mailer.wrapper.getMailPushEvent(mailer.link, parsed.id);
		}
	}

	getBlockchainSourceSubjects(subject: ISourceSubject): IBlockchainSourceSubject[] {
		if (subject.type === BlockchainSourceType.BROADCAST) {
			return this.broadcasters.map(m => ({
				...subject,
				blockchain: this.blockchain(),
				id: `tvm-${this.blockchain()}-broadcaster-${String(m.link.id)}`,
			}));
		} else {
			return this.mailers.map(m => ({
				...subject,
				blockchain: this.blockchain(),
				id: `tvm-${this.blockchain()}-mailer-${String(m.link.id)}`,
			}));
		}
	}

	ininiateMessagesSource(subject: IBlockchainSourceSubject): LowLevelMessagesSource {
		let mailer;
		if (subject.type === BlockchainSourceType.BROADCAST) {
			mailer = this.broadcasters.find(
				m => `tvm-${this.blockchain()}-broadcaster-${String(m.link.id)}` === subject.id,
			);
		} else {
			mailer = this.mailers.find(m => `tvm-${this.blockchain()}-mailer-${String(m.link.id)}` === subject.id);
		}
		if (!mailer) {
			throw new Error('Unknown subject');
		}

		if (subject.type === BlockchainSourceType.DIRECT && subject.sender) {
			throw new Error('Sender is not supported for direct messages request in TVM');
		}

		if (mailer.wrapper instanceof EverscaleMailerV6Wrapper) {
			return new EverscaleMailerV6Source(this, mailer.link, mailer.wrapper, subject);
		} else if (mailer.wrapper instanceof EverscaleMailerV7Wrapper) {
			return new EverscaleMailerV7Source(this, mailer.link, mailer.wrapper, subject);
		} else {
			return new EverscaleMailerV5Source(this, mailer.link, mailer.wrapper, subject);
		}
	}

	async retrieveMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null> {
		const decodedMsgId = decodeTvmMsgId(msg.msgId);
		const mailer = (decodedMsgId.isBroadcast ? this.broadcasters : this.mailers).find(
			m => m.link.id === decodedMsgId.contractId,
		);
		if (!mailer) {
			throw new Error('This message does not belongs to this blockchain controller');
		}
		return mailer.wrapper.retrieveMessageContent(mailer.link, msg);
	}

	isAddressValid(address: string): boolean {
		return isTVMAddressValid(address);
	}

	// Query messages by interval sinceDate(excluded) - untilDate (excluded)

	async extractNativePublicKeyFromAddress(addressStr: string): Promise<Uint8Array | null> {
		return await this.blockchainReader.operation(async (ever, gql, core) => {
			const address = new Address(addressStr);
			const boc = await ever.getFullContractState({ address });
			if (!boc.state) {
				return null;
			}
			try {
				const pk = core.extractPublicKey(boc.state.boc);
				return pk ? SmartBuffer.ofHexString(pk).bytes : null;
			} catch (err) {
				return null;
			}
		});
	}

	async decodeNativeKey(
		senderPublicKey: Uint8Array,
		recipientPublicKey: Uint8Array,
		key: Uint8Array,
	): Promise<Uint8Array> {
		return await this.blockchainReader.operation(async (ever, gql, core) => {
			try {
				const { encData, nonce } = unpackSymmetricalyEncryptedData(key);

				const decryptedText = await ever.decryptData({
					algorithm: 'ChaCha20Poly1305',
					data: new SmartBuffer(encData).toBase64String(),
					nonce: new SmartBuffer(nonce).toBase64String(),
					recipientPublicKey: new SmartBuffer(recipientPublicKey).toHexString(),
					sourcePublicKey: new SmartBuffer(senderPublicKey).toHexString(),
				});
				if (decryptedText) {
					return SmartBuffer.ofBase64String(decryptedText).bytes;
				} else {
					throw new Error('Error decrypting message text');
				}
			} catch (e) {
				throw e;
			}
		});
	}

	async getExtraEncryptionStrategiesFromAddress(address: string): Promise<IExtraEncryptionStrateryEntry[]> {
		const native = await this.extractNativePublicKeyFromAddress(address);
		if (native) {
			return [
				{
					ylide: false,
					blockchain: this.options.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',
					address,
					type: this.options.type === 'everscale-mainnet' ? 'everscale-native' : 'venom-native',
					data: {
						nativePublicKey: native,
					},
				},
			];
		} else {
			return [];
		}
	}

	getSupportedExtraEncryptionStrategies(): string[] {
		return [this.options.type === 'everscale-mainnet' ? 'everscale-native' : 'venom-native'];
	}

	async prepareExtraEncryptionStrategyBulk(
		entries: IExtraEncryptionStrateryEntry[],
	): Promise<IExtraEncryptionStrateryBulk> {
		return await this.blockchainReader.operation(async (ever, gql, core) => {
			const ephemeralSecret = generate_ephemeral();
			const ephemeralPublic = get_public_key(ephemeralSecret);
			return {
				addedPublicKey: {
					key: PublicKey.fromHexString(PublicKeyType.EVERSCALE_NATIVE, ephemeralPublic),
				},
				blockchain: this.options.type === 'everscale-mainnet' ? 'everscale' : 'venom-testnet',
				type: this.options.type === 'everscale-mainnet' ? 'everscale-native' : 'venom-native',
				data: {
					nativeEphemeralKeySecret: ephemeralSecret,
				},
			};
		});
	}

	async executeExtraEncryptionStrategy(
		entries: IExtraEncryptionStrateryEntry[],
		bulk: IExtraEncryptionStrateryBulk,
		addedPublicKeyIndex: number | null,
		messageKey: Uint8Array,
	): Promise<MessageKey[]> {
		const nativeSenderPrivateKey = SmartBuffer.ofHexString(bulk.data.nativeEphemeralKeySecret);
		return entries.map(entry => {
			const recipientNativePublicKey = new SmartBuffer(entry.data.nativePublicKey);
			const nonce = new SmartBuffer(randomBytes(12));
			const encryptedKey = SmartBuffer.ofHexString(
				encrypt(
					nativeSenderPrivateKey.toHexString(),
					recipientNativePublicKey.toHexString(),
					new SmartBuffer(messageKey).toHexString(),
					nonce.toHexString(),
				),
			);
			const packedKey = packSymmetricalyEncryptedData(encryptedKey.bytes, nonce.bytes);
			return new MessageKey(
				addedPublicKeyIndex!,
				DynamicEncryptionRouter.getPublicKeySignature(bulk.addedPublicKey!.key),
				packedKey,
			);
		});
	}

	addressToUint256(address: string): Uint256 {
		return everscaleAddressToUint256(address);
	}

	compareMessagesTime(a: IMessage, b: IMessage): number {
		return a.createdAt - b.createdAt;
	}
}

export const everscaleBlockchainFactory: BlockchainControllerFactory = {
	create: async (options?: any) =>
		new EverscaleBlockchainController(Object.assign({ type: 'everscale-mainnet' }, options || {})),
	blockchain: 'everscale',
	blockchainGroup: 'everscale',
};

export const venomBlockchainFactory: BlockchainControllerFactory = {
	create: async (options?: any) =>
		new EverscaleBlockchainController(Object.assign({ type: 'venom-testnet' }, options || {})),
	blockchain: 'venom-testnet',
	blockchainGroup: 'venom-testnet',
};
