import { ProviderRpcClient } from 'everscale-inpage-provider';

import {
	IGenericAccount,
	AbstractWalletController,
	PublicKey,
	PublicKeyType,
	MessageKey,
	MessageChunks,
	WalletControllerFactory,
	sha256,
	unpackSymmetricalyEncryptedData,
	Uint256,
	hexToUint256,
	WalletEvent,
	YlideError,
	YlideErrorType,
	SwitchAccountCallback,
	YlidePublicKeyVersion,
	ServiceCode,
	SendMailResult,
} from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { EverscaleMailerV6Wrapper } from '../contract-wrappers/EverscaleMailerV6Wrapper';
import { EverscaleRegistryV2Wrapper } from '../contract-wrappers/EverscaleRegistryV2Wrapper';
import {
	ITVMMailerContractLink,
	ITVMRegistryContractLink,
	EVERSCALE_LOCAL,
	EVERSCALE_MAINNET,
	VENOM_TESTNET,
} from '../misc';
import { EverscaleBlockchainController } from './EverscaleBlockchainController';
import { EverscaleBlockchainReader } from './helpers/EverscaleBlockchainReader';
import { EverscaleMailerV5Wrapper, EverscaleRegistryV1Wrapper } from '../contract-wrappers';

export class EverscaleWalletController extends AbstractWalletController {
	public readonly blockchainReader: EverscaleBlockchainReader;

	readonly currentMailer: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV6Wrapper;
	};
	readonly currentBroadcaster: {
		link: ITVMMailerContractLink;
		wrapper: EverscaleMailerV6Wrapper;
	};
	readonly currentRegistry: { link: ITVMRegistryContractLink; wrapper: EverscaleRegistryV2Wrapper };

	readonly everscaleMainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];
	readonly venomTestnetEndpoints = ['https://gql-testnet.venom.foundation/graphql'];

	private lastCurrentAccount: IGenericAccount | null = null;

	// on(event: WalletEvent.ACCOUNT_CHANGED, fn: (newAccount: IGenericAccount) => void, context?: any): this;
	// on(event: WalletEvent.BLOCKCHAIN_CHANGED, fn: (newBlockchain: string) => void, context?: any): this;
	// on(event: WalletEvent.LOGIN, fn: (newAccount: IGenericAccount) => void, context?: any): this;
	// on(event: WalletEvent.LOGOUT, fn: () => void, context?: any): this;

	constructor(
		private readonly options: {
			type?: 'everwallet' | 'venomwallet';
			dev?: boolean;
			endpoints?: string[];
			onSwitchAccountRequest?: SwitchAccountCallback;
		} = {},
	) {
		super(options);

		if (typeof options.type === 'undefined') {
			throw new Error('You must provide network type for Everscale controller');
		}

		this.onSwitchAccountRequest = options?.onSwitchAccountRequest || null;

		const endpoints =
			options?.endpoints ||
			(options?.dev
				? ['http://localhost/graphql']
				: options.type === 'everwallet'
				? this.everscaleMainnetEndpoints
				: this.venomTestnetEndpoints);

		const contracts = options?.dev
			? EVERSCALE_LOCAL
			: options.type === 'everwallet'
			? EVERSCALE_MAINNET
			: VENOM_TESTNET;

		this.blockchainReader = new EverscaleBlockchainReader(true, endpoints, options.dev || false);

		const currentMailerLink = contracts.mailerContracts.find(c => c.id === contracts.currentMailerId)!;
		const currentBroadcasterLink = contracts.broadcasterContracts.find(
			c => c.id === contracts.currentBroadcasterId,
		)!;
		const currentRegistryLink = contracts.registryContracts.find(c => c.id === contracts.currentRegistryId)!;

		this.currentMailer = {
			link: currentMailerLink,
			wrapper: new EverscaleBlockchainController.mailerWrappers[currentMailerLink.type](
				this.blockchainReader,
			) as EverscaleMailerV6Wrapper,
		};

		this.currentBroadcaster = {
			link: currentBroadcasterLink,
			wrapper: new EverscaleBlockchainController.mailerWrappers[currentBroadcasterLink.type](
				this.blockchainReader,
			) as EverscaleMailerV6Wrapper,
		};

		this.currentRegistry = {
			link: currentRegistryLink,
			wrapper: new EverscaleBlockchainController.registryWrappers[currentRegistryLink.type](
				this.blockchainReader,
			) as EverscaleRegistryV2Wrapper,
		};
	}

	blockchainGroup(): string {
		return 'everscale';
	}

	wallet(): string {
		return this.options.type === 'everwallet' ? 'everwallet' : 'venomwallet';
	}

	isMultipleAccountsSupported() {
		return false;
	}

	async init(): Promise<void> {
		await this.getAuthenticatedAccount();

		const logoutSubscription = await this.blockchainReader.ever.subscribe('loggedOut');
		logoutSubscription.on('data', () => this.emit(WalletEvent.LOGOUT));

		const networkSubscription = await this.blockchainReader.ever.subscribe('networkChanged');
		networkSubscription.on('data', data => {
			// tslint:disable-next-line
			console.log('networkSubscription data: ', data);
		});

		const permissionsSubscription = await this.blockchainReader.ever.subscribe('permissionsChanged');
		permissionsSubscription.on('data', data => {
			const oldAccount = this.lastCurrentAccount;
			if (data.permissions.accountInteraction) {
				this.lastCurrentAccount = {
					blockchain: 'everscale',
					address: data.permissions.accountInteraction.address.toString(),
					publicKey: PublicKey.fromHexString(
						PublicKeyType.EVERSCALE_NATIVE,
						data.permissions.accountInteraction.publicKey,
					),
				};
				if (oldAccount) {
					this.emit(WalletEvent.ACCOUNT_CHANGED, this.lastCurrentAccount);
				} else {
					this.emit(WalletEvent.LOGIN, this.lastCurrentAccount);
				}
			} else {
				if (oldAccount) {
					this.emit(WalletEvent.LOGOUT);
				}
			}
		});
	}

	private async ensureAccount(needAccount: IGenericAccount) {
		let me = await this.getAuthenticatedAccount();
		if (!me || me.address !== needAccount.address) {
			await this.switchAccountRequest(me, needAccount);
			me = await this.getAuthenticatedAccount();
		}
		if (!me || me.address !== needAccount.address) {
			throw new YlideError(YlideErrorType.ACCOUNT_UNREACHABLE, { currentAccount: me, needAccount });
		}

		return me;
	}

	addressToUint256(address: string): Uint256 {
		return hexToUint256(address.split(':')[1].toLowerCase());
	}

	async requestYlidePrivateKey(me: IGenericAccount): Promise<Uint8Array | null> {
		throw new Error('Method not available.');
	}

	async signMagicString(account: IGenericAccount, magicString: string): Promise<Uint8Array> {
		await this.ensureAccount(account);
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error(`Can't derive without auth`);
		}
		const result = await this.blockchainReader.ever.signData({
			publicKey: me.publicKey!.toHex(),
			data: SmartBuffer.ofUTF8String(magicString).toBase64String(),
		});
		// @ts-ignore
		return sha256(SmartBuffer.ofHexString(result.signatureHex || result.signature_hex).bytes);
	}

	// account block
	async getAuthenticatedAccount(): Promise<IGenericAccount | null> {
		await this.blockchainReader.ever.ensureInitialized();
		const providerState = await this.blockchainReader.ever.getProviderState();
		if (providerState.permissions.accountInteraction) {
			this.lastCurrentAccount = {
				blockchain: 'everscale',
				address: providerState.permissions.accountInteraction.address.toString(),
				publicKey: PublicKey.fromHexString(
					PublicKeyType.EVERSCALE_NATIVE,
					providerState.permissions.accountInteraction.publicKey,
				),
			};
			return this.lastCurrentAccount;
		} else {
			this.lastCurrentAccount = null;
			return null;
		}
	}

	async getCurrentBlockchain(): Promise<string> {
		return 'everscale';
	}

	async attachPublicKey(
		me: IGenericAccount,
		publicKey: Uint8Array,
		keyVersion: YlidePublicKeyVersion = YlidePublicKeyVersion.KEY_V2,
		registrar: number = ServiceCode.SDK,
		options?: any,
	) {
		await this.ensureAccount(me);
		await this.currentRegistry.wrapper.attachPublicKey(this.currentRegistry.link, me.address, {
			keyVersion,
			publicKey: PublicKey.fromBytes(PublicKeyType.YLIDE, publicKey),
			timestamp: Math.floor(Date.now() / 1000),
			registrar,
		});
	}

	async requestAuthentication(): Promise<null | IGenericAccount> {
		const acc = await this.getAuthenticatedAccount();
		if (acc) {
			await this.disconnectAccount(acc);
		}
		const { accountInteraction } = await this.blockchainReader.ever.requestPermissions({
			permissions: ['basic', 'accountInteraction'],
		});
		if (accountInteraction) {
			return {
				blockchain: 'everscale',
				address: accountInteraction.address.toString(),
				publicKey: PublicKey.fromHexString(PublicKeyType.EVERSCALE_NATIVE, accountInteraction.publicKey),
			};
		} else {
			throw new Error('Not authenticated');
		}
	}

	async disconnectAccount(account: IGenericAccount): Promise<void> {
		await this.ensureAccount(account);
		await this.blockchainReader.ever.disconnect();
	}

	async sendMail(
		me: IGenericAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
	): Promise<SendMailResult> {
		await this.ensureAccount(me);
		if (feedId !== '0000000000000000000000000000000000000000000000000000000000000000') {
			throw new Error('Non-main feeds are not supported for everscale for now.');
		}
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
		const chunks = MessageChunks.splitMessageChunks(contentData);
		if (chunks.length === 1 && recipients.length === 1) {
			const transaction = await this.currentMailer.wrapper.sendSmallMail(
				this.currentMailer.link,
				me.address,
				uniqueId,
				recipients[0].address,
				recipients[0].messageKey.toBytes(),
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			console.log('om: ', om);
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = 'yappy' as any;
			return decodedEvent.msgId;
		} else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
			const transaction = await this.currentMailer.wrapper.sendBulkMail(
				this.currentMailer.link,
				me.address,
				uniqueId,
				recipients.map(r => r.address),
				recipients.map(r => r.messageKey.toBytes()),
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = 'yappy' as any;
			return decodedEvent.msgId;
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			const msgId = await this.currentMailer.wrapper.buildHash(
				this.currentMailer.link,
				me.publicKey!.bytes,
				uniqueId,
				initTime,
			);
			for (let i = 0; i < chunks.length; i++) {
				await this.currentMailer.wrapper.sendMessageContentPart(
					this.currentMailer.link,
					me.address,
					uniqueId,
					initTime,
					chunks.length,
					i,
					chunks[i],
				);
			}
			for (let i = 0; i < recipients.length; i += 210) {
				const recs = recipients.slice(i, i + 210);
				await this.currentMailer.wrapper.addRecipients(
					this.currentMailer.link,
					me.address,
					uniqueId,
					initTime,
					recs.map(r => r.address),
					recs.map(r => r.messageKey.toBytes()),
				);
			}
			return msgId as any;
		}
	}

	async sendBroadcast(me: IGenericAccount, feedId: Uint256, contentData: Uint8Array): Promise<SendMailResult> {
		await this.ensureAccount(me);
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
		const chunks = MessageChunks.splitMessageChunks(contentData);
		if (chunks.length === 1) {
			const transaction = await this.currentBroadcaster.wrapper.sendBroadcast(
				this.currentBroadcaster.link,
				me.address,
				uniqueId,
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = 'yappy' as any; // decodeContentMessageBody(contentMsg.body!);
			return decodedEvent.msgId;
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			const msgId = await this.currentBroadcaster.wrapper.buildHash(
				this.currentBroadcaster.link,
				me.publicKey!.bytes,
				uniqueId,
				initTime,
			);
			for (let i = 0; i < chunks.length; i++) {
				await this.currentBroadcaster.wrapper.sendMessageContentPart(
					this.currentBroadcaster.link,
					me.address,
					uniqueId,
					initTime,
					chunks.length,
					i,
					chunks[i],
				);
			}

			await this.currentBroadcaster.wrapper.sendBroadcastHeader(
				this.currentBroadcaster.link,
				me.address,
				uniqueId,
				initTime,
			);
			return msgId as any;
		}
	}

	async decryptMessageKey(
		recipientAccount: IGenericAccount,
		senderPublicKey: PublicKey,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array> {
		if (senderPublicKey.type !== PublicKeyType.EVERSCALE_NATIVE) {
			throw new Error('EverWallet can only decrypt native encryption of EverWallet');
		}
		const { encData, nonce } = unpackSymmetricalyEncryptedData(encryptedKey);
		const decryptionResultBase64 = await this.blockchainReader.ever.decryptData({
			algorithm: 'ChaCha20Poly1305',
			sourcePublicKey: senderPublicKey.toHex(),
			recipientPublicKey: recipientAccount.publicKey!.toHex(),
			data: new SmartBuffer(encData).toBase64String(),
			nonce: new SmartBuffer(nonce).toBase64String(),
		});
		return SmartBuffer.ofBase64String(decryptionResultBase64).bytes;
	}

	// Deployments:

	async deployMailerV5(me: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await EverscaleMailerV5Wrapper.deploy(this.blockchainReader.ever, fullMe, beneficiaryAddress);
	}

	async deployMailerV6(me: IGenericAccount, beneficiaryAddress: string): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await EverscaleMailerV6Wrapper.deploy(this.blockchainReader.ever, fullMe, beneficiaryAddress);
	}

	async deployRegistryV1(me: IGenericAccount): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await EverscaleRegistryV1Wrapper.deploy(this.blockchainReader.ever, fullMe);
	}

	async deployRegistryV2(me: IGenericAccount): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await EverscaleRegistryV2Wrapper.deploy(this.blockchainReader.ever, fullMe);
	}
}

export const everscaleWalletFactory: WalletControllerFactory = {
	create: async (options?: any) =>
		new EverscaleWalletController(Object.assign({ type: 'everwallet' }, options || {})),
	isWalletAvailable: () =>
		new ProviderRpcClient({ fallback: async () => window.__ever!, forceUseFallback: true }).hasProvider(),
	blockchainGroup: 'everscale',
	wallet: 'everwallet',
};

export const venomWalletFactory: WalletControllerFactory = {
	create: async (options?: any) =>
		new EverscaleWalletController(Object.assign({ type: 'venomwallet' }, options || {})),
	isWalletAvailable: () =>
		new ProviderRpcClient({ fallback: async () => (window as any).__venom, forceUseFallback: true }).hasProvider(),
	blockchainGroup: 'everscale',
	wallet: 'venomwallet',
};
