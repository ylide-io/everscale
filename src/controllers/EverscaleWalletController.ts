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
} from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { EverscaleBlockchainController } from '.';

export class EverscaleWalletController extends AbstractWalletController {
	constructor(
		public readonly blockchainController: EverscaleBlockchainController,
		options: {
			dev?: boolean;
			mailerContractAddress?: string;
			registryContractAddress?: string;
			endpoint?: string;
		} = {},
	) {
		super(blockchainController, options);
	}

	async signMagicString(magicString: string): Promise<Uint8Array> {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error(`Can't derive without auth`);
		}
		const result = await this.blockchainController.ever.signData({
			publicKey: me.publicKey!.toHex(),
			data: SmartBuffer.ofUTF8String(magicString).toBase64String(),
		});
		return sha256(SmartBuffer.ofHexString(result.signatureHex).bytes);
	}

	// account block
	async getAuthenticatedAccount(): Promise<IGenericAccount | null> {
		await this.blockchainController.ever.ensureInitialized();
		const providerState = await this.blockchainController.ever.getProviderState();
		if (providerState.permissions.accountInteraction) {
			return {
				blockchain: 'everscale',
				address: providerState.permissions.accountInteraction.address.toString(),
				publicKey: PublicKey.fromHexString(
					PublicKeyType.EVERSCALE_NATIVE,
					providerState.permissions.accountInteraction.publicKey,
				),
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
		await this.blockchainController.registryContract.attachPublicKey(me.address, publicKey);
	}

	async requestAuthentication(): Promise<null | IGenericAccount> {
		const { accountInteraction } = await this.blockchainController.ever.requestPermissions({
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

	async disconnectAccount(): Promise<void> {
		await this.blockchainController.ever.disconnect();
	}

	async publishMessage(
		me: IGenericAccount,
		contentData: Uint8Array,
		recipients: { address: Uint256; messageKey: MessageKey }[],
	): Promise<Uint256 | null> {
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);
		const chunks = MessageChunks.splitMessageChunks(contentData);
		if (chunks.length === 1 && recipients.length === 1) {
			const transaction = await this.blockchainController.mailerContract.sendSmallMail(
				me.address,
				uniqueId,
				recipients[0].address,
				recipients[0].messageKey.toBytes(),
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = this.blockchainController.mailerContract.decodeContentMessageBody(contentMsg.body!);
			return decodedEvent.msgId;
		} else if (chunks.length === 1 && recipients.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
			const transaction = await this.blockchainController.mailerContract.sendBulkMail(
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
			const decodedEvent = this.blockchainController.mailerContract.decodeContentMessageBody(contentMsg.body!);
			return decodedEvent.msgId;
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			const msgId = await this.blockchainController.mailerContract.buildHash(
				me.publicKey!.bytes,
				uniqueId,
				initTime,
			);
			for (let i = 0; i < chunks.length; i++) {
				await this.blockchainController.mailerContract.sendMultipartMailPart(
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
				await this.blockchainController.mailerContract.addRecipients(
					me.address,
					uniqueId,
					initTime,
					recs.map(r => r.address),
					recs.map(r => r.messageKey.toBytes()),
				);
			}
			return msgId;
		}
	}

	async decryptMessageKey(
		senderPublicKey: PublicKey,
		recipientAccount: IGenericAccount,
		encryptedKey: Uint8Array,
	): Promise<Uint8Array> {
		if (senderPublicKey.type !== PublicKeyType.EVERSCALE_NATIVE) {
			throw new Error('EverWallet can only decrypt native encryption of EverWallet');
		}
		const { encData, nonce } = unpackSymmetricalyEncryptedData(encryptedKey);
		const decryptionResultBase64 = await this.blockchainController.ever.decryptData({
			algorithm: 'ChaCha20Poly1305',
			sourcePublicKey: senderPublicKey.toHex(),
			recipientPublicKey: recipientAccount.publicKey!.toHex(),
			data: new SmartBuffer(encData).toBase64String(),
			nonce: new SmartBuffer(nonce).toBase64String(),
		});
		return SmartBuffer.ofBase64String(decryptionResultBase64).bytes;
	}
}

export const everscaleWalletFactory: WalletControllerFactory = {
	create: (options?: any) => new EverscaleWalletController(options),
	isWalletAvailable: () => new ProviderRpcClient().hasProvider(),
	blockchain: 'everscale',
	wallet: 'everwallet',
};
