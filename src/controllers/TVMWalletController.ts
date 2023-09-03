/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
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
	YlideKeyVersion,
	ServiceCode,
	EncryptionPublicKey,
	AbstractFaucetService,
	SendingProcess,
	SendingProcessBuilder,
} from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';
import {
	ITVMMailerContractLink,
	ITVMRegistryContractLink,
	EVERSCALE_LOCAL,
	EVERSCALE_MAINNET,
	VENOM_TESTNET,
} from '../misc';
import { TVMWalletAccount } from '../misc/TVMWalletAccount';
import { TVMBlockchainController } from './TVMBlockchainController';
import { TVMBlockchainReader } from './helpers/TVMBlockchainReader';
import {
	TVMMailerV5Wrapper,
	TVMMailerV6Wrapper,
	TVMMailerV7Wrapper,
	TVMRegistryV1Wrapper,
	TVMRegistryV2Wrapper,
} from '../contract-wrappers';
import { TVMMailerV8Wrapper } from '../contract-wrappers/TVMMailerV8Wrapper';

export class TVMWalletController extends AbstractWalletController {
	private readonly _isVerbose: boolean;

	public readonly blockchainReader: TVMBlockchainReader;

	readonly currentMailer: {
		link: ITVMMailerContractLink;
		wrapper: TVMMailerV5Wrapper | TVMMailerV6Wrapper | TVMMailerV7Wrapper | TVMMailerV8Wrapper;
	};
	readonly currentBroadcaster: {
		link: ITVMMailerContractLink;
		wrapper: TVMMailerV5Wrapper | TVMMailerV6Wrapper | TVMMailerV7Wrapper | TVMMailerV8Wrapper;
	};
	readonly currentRegistry: {
		link: ITVMRegistryContractLink;
		wrapper: TVMRegistryV1Wrapper | TVMRegistryV2Wrapper;
	};

	readonly everscaleMainnetEndpoints = ['https://mainnet.evercloud.dev/695e40eeac6b4e3fa4a11666f6e0d6af/graphql'];
	readonly venomTestnetEndpoints = ['https://gql-testnet.venom.foundation/graphql'];

	private lastCurrentAccount: TVMWalletAccount | null = null;

	// on(event: WalletEvent.ACCOUNT_CHANGED, fn: (newAccount: TVMWalletAccount) => void, context?: any): this;
	// on(event: WalletEvent.BLOCKCHAIN_CHANGED, fn: (newBlockchain: string) => void, context?: any): this;
	// on(event: WalletEvent.LOGIN, fn: (newAccount: TVMWalletAccount) => void, context?: any): this;
	// on(event: WalletEvent.LOGOUT, fn: () => void, context?: any): this;

	constructor(
		private readonly options: {
			type?: 'everwallet' | 'venomwallet';
			dev?: boolean;
			endpoints?: string[];
			provider?: any;
			verbose?: boolean;
			onSwitchAccountRequest?: SwitchAccountCallback;
		} = {},
	) {
		super(options);

		this._isVerbose = options.verbose || false;

		if (typeof options.type === 'undefined') {
			throw new Error('You must provide network type for TVM controller');
		}

		this.onSwitchAccountRequest = options?.onSwitchAccountRequest || null;

		const endpoints =
			options?.endpoints ||
			(options?.dev
				? ['http://localhost/graphql']
				: options.type === 'everwallet'
				? [...this.everscaleMainnetEndpoints]
				: [...this.venomTestnetEndpoints]);

		const contracts = options?.dev
			? EVERSCALE_LOCAL
			: options.type === 'everwallet'
			? EVERSCALE_MAINNET
			: VENOM_TESTNET;

		this.blockchainReader = new TVMBlockchainReader(
			this.blockchainGroup(),
			options.type === 'everwallet' ? 'everscale' : 'venom-testnet',
			options.type === 'everwallet' ? 'everscale-mainnet' : 'venom-testnet',
			endpoints,
			this.options.provider
				? this.options.provider
				: options.type === 'everwallet'
				? window.__ever
				: (window as any).__venom,
			options.dev || false,
		);

		const currentMailerLink = contracts.mailerContracts.find(c => c.id === contracts.currentMailerId)!;
		const currentBroadcasterLink = contracts.broadcasterContracts.find(
			c => c.id === contracts.currentBroadcasterId,
		)!;
		const currentRegistryLink = contracts.registryContracts.find(c => c.id === contracts.currentRegistryId)!;

		this.currentMailer = {
			link: currentMailerLink,
			wrapper: new TVMBlockchainController.mailerWrappers[currentMailerLink.type](
				this.blockchainReader,
			) as TVMMailerV6Wrapper,
		};

		this.currentBroadcaster = {
			link: currentBroadcasterLink,
			wrapper: new TVMBlockchainController.mailerWrappers[currentBroadcasterLink.type](
				this.blockchainReader,
			) as TVMMailerV6Wrapper,
		};

		this.currentRegistry = {
			link: currentRegistryLink,
			wrapper: new TVMBlockchainController.registryWrappers[currentRegistryLink.type](
				this.blockchainReader,
			) as TVMRegistryV2Wrapper,
		};
	}

	private verboseLog(...args: any[]) {
		if (this._isVerbose) {
			console.log('[Y-SDK]', ...args);
		}
	}

	private verboseLogTick(...args: any[]) {
		if (this._isVerbose) {
			console.log('[Y-EVER-SDK]', ...args);
			const timer = setTimeout(() => {
				console.log('[Y-EVER-SDK]', '...still working...', ...args);
			}, 5000);
			return () => clearTimeout(timer);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			return () => {};
		}
	}

	blockchainGroup(): string {
		return this.options.type === 'everwallet' ? 'everscale' : 'venom-testnet';
	}

	wallet(): string {
		return this.options.type === 'everwallet' ? 'everwallet' : 'venomwallet';
	}

	isMultipleAccountsSupported() {
		return false;
	}

	async init(): Promise<void> {
		let last = Date.now();
		const tick = (t: string) => {
			const now = Date.now();
			console.log(t, `${now - last} ms`);
			last = now;
		};
		const doneAuthAccount = this.verboseLogTick('getAuthenticatedAccount');
		await this.getAuthenticatedAccount();
		doneAuthAccount();
		tick('getAuthenticatedAccount');

		const doneLogoutSubscription = this.verboseLogTick('logoutSubscription');
		const logoutSubscription = await this.blockchainReader.ever.subscribe('loggedOut');
		doneLogoutSubscription();
		tick('logoutSubscription');
		logoutSubscription.on('data', () => this.emit(WalletEvent.LOGOUT));

		const doneNetworkSubscription = this.verboseLogTick('networkSubscription');
		const networkSubscription = await this.blockchainReader.ever.subscribe('networkChanged');
		doneNetworkSubscription();
		tick('networkSubscription');
		networkSubscription.on('data', data => {
			// tslint:disable-next-line
			console.log('networkSubscription data: ', data);
		});

		const donePermissionsChanged = this.verboseLogTick('permissionsChangedSubscription');
		const permissionsSubscription = await this.blockchainReader.ever.subscribe('permissionsChanged');
		donePermissionsChanged();
		tick('permissionsSubscription');
		permissionsSubscription.on('data', data => {
			const oldAccount = this.lastCurrentAccount;
			if (data.permissions.accountInteraction) {
				this.lastCurrentAccount = new TVMWalletAccount(
					this.blockchainGroup(),
					this.wallet(),
					data.permissions.accountInteraction.address.toString(),
					{ publicKeyHex: data.permissions.accountInteraction.publicKey },
				);
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

	private async ensureAccount(needAccount: TVMWalletAccount) {
		let me = await this.getAuthenticatedAccount();
		if (!me || me.address !== needAccount.address) {
			await this.switchAccountRequest(me, needAccount);
			me = await this.getAuthenticatedAccount();
		}
		if (!me || me.address !== needAccount.address) {
			throw new YlideError(YlideErrorType.ACCOUNT_UNREACHABLE, 'Wrong account selected in wallet', {
				currentAccount: me,
				needAccount,
			});
		}

		return me;
	}

	addressToUint256(address: string): Uint256 {
		return hexToUint256(address.split(':')[1].toLowerCase());
	}

	async signString(
		account: TVMWalletAccount,
		message: string,
	): Promise<{
		message: string;
		signature: string;
		dataHash: string;
	}> {
		const me = await this.ensureAccount(account);
		const signature = await this.blockchainReader.ever.signData({
			publicKey: me.$$meta.publicKeyHex,
			data: SmartBuffer.ofUTF8String(message).toBase64String(),
		});
		return { message, signature: signature.signature, dataHash: signature.dataHash };
	}

	async signMagicString(account: TVMWalletAccount, magicString: string): Promise<Uint8Array> {
		const me = await this.ensureAccount(account);
		const result = await this.blockchainReader.ever.signData({
			publicKey: me.$$meta.publicKeyHex,
			data: SmartBuffer.ofUTF8String(magicString).toBase64String(),
		});
		// @ts-ignore
		return sha256(SmartBuffer.ofHexString(result.signatureHex || result.signature_hex).bytes);
	}

	// account block
	async getAuthenticatedAccount(): Promise<TVMWalletAccount | null> {
		let last = Date.now();
		const tick = (t: string) => {
			const now = Date.now();
			console.log(t, `${now - last} ms`);
			last = now;
		};
		await this.blockchainReader.ever.ensureInitialized();
		tick('ensureInitialized');
		const providerState = await this.blockchainReader.ever.getProviderState();
		tick('getProviderState');
		if (providerState.permissions.accountInteraction) {
			this.lastCurrentAccount = new TVMWalletAccount(
				this.blockchainGroup(),
				this.wallet(),
				providerState.permissions.accountInteraction.address.toString(),
				{ publicKeyHex: providerState.permissions.accountInteraction.publicKey },
			);
			return this.lastCurrentAccount;
		} else {
			this.lastCurrentAccount = null;
			return null;
		}
	}

	async getCurrentBlockchain(): Promise<string> {
		return this.options.type === 'everwallet' ? 'everscale' : 'venom-testnet';
	}

	async attachPublicKey(
		me: TVMWalletAccount,
		publicKey: Uint8Array,
		keyVersion: YlideKeyVersion = YlideKeyVersion.KEY_V2,
		registrar: number = ServiceCode.SDK,
		options?: any,
	) {
		await this.ensureAccount(me);
		await this.currentRegistry.wrapper.attachPublicKey(
			this.currentRegistry.link,
			me.address,
			new PublicKey(PublicKeyType.YLIDE, keyVersion, publicKey),
			registrar,
		);
	}

	async requestAuthentication(): Promise<null | TVMWalletAccount> {
		const acc = await this.getAuthenticatedAccount();
		if (acc) {
			await this.disconnectAccount(acc);
		}
		const { accountInteraction } = await this.blockchainReader.ever.requestPermissions({
			permissions: ['basic', 'accountInteraction'],
		});
		if (accountInteraction) {
			return new TVMWalletAccount(this.blockchainGroup(), this.wallet(), accountInteraction.address.toString(), {
				publicKeyHex: accountInteraction.publicKey,
			});
		} else {
			throw new Error('Not authenticated');
		}
	}

	async disconnectAccount(account: TVMWalletAccount): Promise<void> {
		await this.ensureAccount(account);
		await this.blockchainReader.ever.disconnect();
	}

	async sendMail(
		me: TVMWalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
	): Promise<SendingProcess> {
		me = await this.ensureAccount(me);
		if (feedId !== '0000000000000000000000000000000000000000000000000000000000000000') {
			throw new Error('Non-main feeds are not supported for everscale for now.');
		}
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
		const chunks = MessageChunks.splitMessageChunks(contentData);

		const builder = new SendingProcessBuilder<{
			type: 'transaction';
			subtype: 'push' | 'content' | 'both';
			tx: any;
		}>();

		if (chunks.length === 1 && recipients.length === 1) {
			builder.chain(
				'transaction',
				'both',
				{
					wrapper: this.currentMailer.wrapper,
					link: this.currentMailer.link,
					from: me.address,
					uniqueId,
					to: recipients[0].address,
					messageKey: recipients[0].messageKey.toBytes(),
					content: chunks[0],
				},
				async data => {
					return data.wrapper.sendSmallMail(
						data.link,
						data.from,
						data.uniqueId,
						data.to,
						data.messageKey,
						data.content,
					);
				},
				async tx => {
					return { type: 'transaction', subtype: 'both', tx };
				},
			);
			// await this.currentMailer.wrapper.sendSmallMail(
			// 	this.currentMailer.link,
			// 	me.address,
			// 	uniqueId,
			// 	recipients[0].address,
			// 	recipients[0].messageKey.toBytes(),
			// 	chunks[0],
			// );

			// const om = transaction.childTransaction.outMessages;
			// const contentMsg = om.length ? om[0] : null;
			// if (!contentMsg || !contentMsg.body) {
			// 	throw new Error('Content event was not found');
			// }
			// const decodedEvent = await this.blockchainReader.operation(async (ever, gql, core) => this.currentMailer.wrapper.decodeContentMessageBody(core, contentMsg.body!));

			// tslint:disable-next-line
			console.log('Push events decoding is not implemented yet.');
			// return { pushes: [] };
		} else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
			builder.chain(
				'transaction',
				'both',
				{
					wrapper: this.currentMailer.wrapper,
					link: this.currentMailer.link,
					from: me.address,
					uniqueId,
					recipientAddresses: recipients.map(r => r.address),
					recipientMessageKeys: recipients.map(r => r.messageKey.toBytes()),
					content: chunks[0],
				},
				async data => {
					return data.wrapper.sendBulkMail(
						data.link,
						data.from,
						data.uniqueId,
						data.recipientAddresses,
						data.recipientMessageKeys,
						data.content,
					);
				},
				async tx => {
					return { type: 'transaction', subtype: 'both', tx };
				},
			);
			// await this.currentMailer.wrapper.sendBulkMail(
			// 	this.currentMailer.link,
			// 	me.address,
			// 	uniqueId,
			// 	recipients.map(r => r.address),
			// 	recipients.map(r => r.messageKey.toBytes()),
			// 	chunks[0],
			// );

			// tslint:disable-next-line
			console.log('Push events decoding is not implemented yet.');
			// return { pushes: [] };
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			for (let i = 0; i < chunks.length; i++) {
				builder.chain(
					'transaction',
					'content',
					{
						wrapper: this.currentMailer.wrapper,
						link: this.currentMailer.link,
						from: me.address,
						uniqueId,
						initTime,
						totalChunks: chunks.length,
						chunkIndex: i,
						content: chunks[i],
					},
					async data => {
						return data.wrapper.sendMessageContentPart(
							data.link,
							data.from,
							data.uniqueId,
							data.initTime,
							data.totalChunks,
							data.chunkIndex,
							data.content,
						);
					},
					async tx => {
						return { type: 'transaction', subtype: 'content', tx };
					},
				);
				// await this.currentMailer.wrapper.sendMessageContentPart(
				// 	this.currentMailer.link,
				// 	me.address,
				// 	uniqueId,
				// 	initTime,
				// 	chunks.length,
				// 	i,
				// 	chunks[i],
				// );
			}
			for (let i = 0; i < recipients.length; i += 210) {
				const recs = recipients.slice(i, i + 210);
				builder.chain(
					'transaction',
					'push',
					{
						wrapper: this.currentMailer.wrapper,
						link: this.currentMailer.link,
						from: me.address,
						uniqueId,
						initTime,
						recipientAddresses: recs.map(r => r.address),
						recipientMessageKeys: recs.map(r => r.messageKey.toBytes()),
					},
					async data => {
						return data.wrapper.addRecipients(
							data.link,
							data.from,
							data.uniqueId,
							data.initTime,
							data.recipientAddresses,
							data.recipientMessageKeys,
						);
					},
					async tx => {
						return { type: 'transaction', subtype: 'push', tx };
					},
				);
				// await this.currentMailer.wrapper.addRecipients(
				// 	this.currentMailer.link,
				// 	me.address,
				// 	uniqueId,
				// 	initTime,
				// 	recs.map(r => r.address),
				// 	recs.map(r => r.messageKey.toBytes()),
				// );
			}

			// tslint:disable-next-line
			console.log('Push events decoding is not implemented yet.');
			// return { pushes: [] };
		}

		const sendingProcess = builder.compile(
			results => {
				const txs = results.filter(result => result.type === 'transaction') as {
					type: 'transaction';
					subtype: 'push' | 'content' | 'both';
					tx: any;
				}[];

				// const om = transaction.childTransaction.outMessages;
				return txs.map(result => ({ type: result.subtype, hash: '' }));
			},
			async results => {
				return { contentId: '', pushes: [] };
			},
		);

		return sendingProcess;
	}

	async sendBroadcast(
		me: TVMWalletAccount,
		feedId: Uint256,
		contentData: Uint8Array,
		options?: { extraPayment: number | string },
	): Promise<SendingProcess> {
		await this.ensureAccount(me);
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
		const extraPayment = options && options.extraPayment ? Number(options.extraPayment) * 1000000000 : 0;
		const chunks = MessageChunks.splitMessageChunks(contentData);

		const builder = new SendingProcessBuilder<{
			type: 'transaction';
			subtype: 'push' | 'content' | 'both';
			tx: any;
		}>();

		if (chunks.length === 1) {
			builder.chain(
				'transaction',
				'both',
				{
					wrapper: this.currentBroadcaster.wrapper,
					link: this.currentBroadcaster.link,
					from: me.address,
					uniqueId,
					content: chunks[0],
					feedId,
					extraPayment,
				},
				async data => {
					return data.wrapper.sendBroadcast(
						data.link,
						data.from,
						data.uniqueId,
						data.content,
						data.feedId,
						data.extraPayment,
					);
				},
				async tx => {
					return { type: 'transaction', subtype: 'both', tx };
				},
			);
			// const transaction = await this.currentBroadcaster.wrapper.sendBroadcast(
			// 	this.currentBroadcaster.link,
			// 	me.address,
			// 	uniqueId,
			// 	chunks[0],
			// 	feedId,
			// 	extraPayment,
			// );

			// const om = transaction.childTransaction.outMessages;
			// const contentMsg = om.length ? om[0] : null;
			// if (!contentMsg || !contentMsg.body) {
			// 	throw new Error('Content event was not found');
			// }
			// const decodedEvent = 'yappy' as any; // decodeContentMessageBody(contentMsg.body!);
			// return decodedEvent.msgId;
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			const msgId = await this.currentBroadcaster.wrapper.buildHash(
				this.currentBroadcaster.link,
				SmartBuffer.ofHexString(me.$$meta.publicKeyHex).bytes,
				uniqueId,
				initTime,
			);
			for (let i = 0; i < chunks.length; i++) {
				builder.chain(
					'transaction',
					'content',
					{
						wrapper: this.currentBroadcaster.wrapper,
						link: this.currentBroadcaster.link,
						from: me.address,
						uniqueId,
						initTime,
						totalChunks: chunks.length,
						chunkIndex: i,
						content: chunks[i],
					},
					async data => {
						return data.wrapper.sendMessageContentPart(
							data.link,
							data.from,
							data.uniqueId,
							data.initTime,
							data.totalChunks,
							data.chunkIndex,
							data.content,
						);
					},
					async tx => {
						return { type: 'transaction', subtype: 'content', tx };
					},
				);
				// await this.currentBroadcaster.wrapper.sendMessageContentPart(
				// 	this.currentBroadcaster.link,
				// 	me.address,
				// 	uniqueId,
				// 	initTime,
				// 	chunks.length,
				// 	i,
				// 	chunks[i],
				// );
			}

			builder.chain(
				'transaction',
				'push',
				{
					wrapper: this.currentBroadcaster.wrapper,
					link: this.currentBroadcaster.link,
					from: me.address,
					uniqueId,
					initTime,
					feedId,
					extraPayment,
				},
				async data => {
					return data.wrapper.sendBroadcastHeader(
						data.link,
						data.from,
						data.uniqueId,
						data.initTime,
						data.feedId,
						data.extraPayment,
					);
				},
				async tx => {
					return { type: 'transaction', subtype: 'push', tx };
				},
			);
			// await this.currentBroadcaster.wrapper.sendBroadcastHeader(
			// 	this.currentBroadcaster.link,
			// 	me.address,
			// 	uniqueId,
			// 	initTime,
			// 	feedId,
			// 	extraPayment,
			// );
			// // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			// return msgId as any;
		}

		const sendingProcess = builder.compile(
			results => {
				const txs = results.filter(result => result.type === 'transaction') as {
					type: 'transaction';
					subtype: 'push' | 'content' | 'both';
					tx: any;
				}[];

				// const om = transaction.childTransaction.outMessages;
				return txs.map(result => ({ type: result.subtype, hash: '' }));
			},
			async results => {
				return { contentId: '', pushes: [] };
			},
		);

		return sendingProcess;
	}

	async decryptMessageKey(
		recipientAccount: TVMWalletAccount,
		senderPublicKey: EncryptionPublicKey,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array> {
		if (senderPublicKey.type !== PublicKeyType.EVERSCALE_NATIVE) {
			throw new Error('EverWallet can only decrypt native encryption of EverWallet');
		}
		const { encData, nonce } = unpackSymmetricalyEncryptedData(encryptedKey);
		const decryptionResultBase64 = await this.blockchainReader.ever.decryptData({
			algorithm: 'ChaCha20Poly1305',
			sourcePublicKey: new SmartBuffer(senderPublicKey.keyBytes).toHexString(),
			recipientPublicKey: recipientAccount.$$meta.publicKeyHex,
			data: new SmartBuffer(encData).toBase64String(),
			nonce: new SmartBuffer(nonce).toBase64String(),
		});
		return SmartBuffer.ofBase64String(decryptionResultBase64).bytes;
	}

	isFaucetAvailable(): boolean {
		return false;
	}

	getFaucet(options?: any): Promise<AbstractFaucetService> {
		throw new Error('TVM faucet is not available.');
	}

	// Deployments:

	async deployMailerV5(me: TVMWalletAccount, beneficiaryAddress: string): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await TVMMailerV5Wrapper.deploy(this.blockchainReader.ever, fullMe, beneficiaryAddress);
	}

	async deployMailerV6(me: TVMWalletAccount, beneficiaryAddress: string): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await TVMMailerV6Wrapper.deploy(this.blockchainReader.ever, fullMe, beneficiaryAddress);
	}

	async deployRegistryV1(me: TVMWalletAccount): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await TVMRegistryV1Wrapper.deploy(this.blockchainReader.ever, fullMe);
	}

	async deployRegistryV2(me: TVMWalletAccount): Promise<string> {
		const fullMe = await this.ensureAccount(me);
		return await TVMRegistryV2Wrapper.deploy(this.blockchainReader.ever, fullMe);
	}
}

export const everscaleWalletFactory: WalletControllerFactory = {
	create: async (options?: any) => new TVMWalletController(Object.assign({ type: 'everwallet' }, options || {})),
	isWalletAvailable: async () => !!window.__ever,
	blockchainGroup: 'everscale',
	wallet: 'everwallet',
};

export const everscaleProxyWalletFactory: WalletControllerFactory = {
	create: async (options?: any) =>
		new TVMWalletController(
			Object.assign(
				{ type: 'everwallet' },
				options || {
					provider: options.provider ? options.provider : (window as any).__everProxy,
				},
			),
		),
	isWalletAvailable: async () => !!(window as any).__everProxy,
	blockchainGroup: 'everscale',
	wallet: 'everwallet-proxy',
};

export const venomWalletFactory: WalletControllerFactory = {
	create: async (options?: any) => new TVMWalletController(Object.assign({ type: 'venomwallet' }, options || {})),
	isWalletAvailable: async () => !!(window as any).__venom,
	blockchainGroup: 'venom-testnet',
	wallet: 'venomwallet',
};
