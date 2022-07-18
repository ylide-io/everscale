import { ProviderRpcClient } from 'everscale-inpage-provider';

import {
	AbstractSendingController,
	IGenericAccount,
	MessageContent,
	YlideUnencryptedKeyPair,
	MessageContainer,
	MessageChunks,
	sha256,
} from '@ylide/sdk';
import { EverscaleReadingController } from '.';
import SmartBuffer from '@ylide/smart-buffer';

export class EverscaleSendingController extends AbstractSendingController {
	reader: EverscaleReadingController;

	constructor(
		options: {
			dev?: boolean;
			mailerContractAddress?: string;
			registryContractAddress?: string;
			endpoint?: string;
		} = {},
	) {
		super(options);

		this.reader = new EverscaleReadingController(options);
	}

	// wallet block
	static isWalletAvailable(): Promise<boolean> {
		return new ProviderRpcClient().hasProvider();
	}

	static walletType(): string {
		return 'everwallet';
	}

	static blockchainType(): string {
		return 'everscale';
	}

	async deriveMessagingKeypair(magicString: string): Promise<Uint8Array> {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error(`Can't derive without auth`);
		}
		const result = await this.reader.ever.signData({
			publicKey: me.publicKey,
			data: SmartBuffer.ofUTF8String(magicString).toBase64String(),
		});
		const signatureBytes = SmartBuffer.ofHexString(result.signatureHex).bytes;
		return sha256(signatureBytes);
	}

	// account block
	async getAuthenticatedAccount(): Promise<IGenericAccount | null> {
		await this.reader.ever.ensureInitialized();
		const providerState = await this.reader.ever.getProviderState();
		if (providerState.permissions.accountInteraction) {
			return {
				address: providerState.permissions.accountInteraction.address.toString(),
				publicKey: providerState.permissions.accountInteraction.publicKey,
			};
		} else {
			return null;
		}
	}

	async attachPublicKey(publicKey: Uint8Array) {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error('Not authorized');
		}
		await this.reader.registryContract.attachPublicKey(me.address, publicKey);
	}

	async requestAuthentication(): Promise<null | IGenericAccount> {
		const { accountInteraction } = await this.reader.ever.requestPermissions({
			permissions: ['basic', 'accountInteraction'],
		});
		if (accountInteraction) {
			return {
				address: accountInteraction.address.toString(),
				publicKey: accountInteraction.publicKey,
			};
		} else {
			throw new Error('Not authenticated');
		}
	}

	async disconnectAccount(): Promise<void> {
		await this.reader.ever.disconnect();
	}

	// message send block
	async sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: { address: string; publicKey: Uint8Array }[],
	): Promise<string | null> {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error('Not authorized');
		}
		const { content: encryptedContent, key } = MessageContainer.encodeContent(content);
		const chunks = MessageChunks.packContentInChunks(serviceCode, keypair.publicKey, encryptedContent);

		const recipientKeys = recipients.map(rec => {
			return { address: rec.address, key: keypair.encrypt(key, rec.publicKey) };
		});

		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);

		// const msgId = await this.reader.mailerContract.getMsgId(keypair.publicKey, uniqueId);

		if (chunks.length === 1 && recipientKeys.length === 1) {
			const transaction = await this.reader.mailerContract.sendSmallMail(
				me.address,
				keypair.publicKey,
				uniqueId,
				recipientKeys[0].address,
				recipientKeys[0].key,
				chunks[0],
			);
		} else {
			throw new Error('Multisending is not supported for now');
		}

		// if (transaction && transaction.childTransaction) {
		// 	const ct = transaction.childTransaction;
		// 	if (ct.outMessages && ct.outMessages[0]) {
		// 		const o = ct.outMessages[0];
		// 		if (o.value === '0' && o.src._address === this.contract!.address.toString()) {
		// 			return o.hash;
		// 		}
		// 	}
		// }
		return null;
	}
}
