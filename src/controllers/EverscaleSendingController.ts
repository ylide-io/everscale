import { ProviderRpcClient } from 'everscale-inpage-provider';

import {
	AbstractSendingController,
	IGenericAccount,
	MessageContent,
	YlideUnencryptedKeyPair,
	MessageContainer,
	MessageChunks,
	sha256,
	packSymmetricalyEncryptedData,
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

	async publishMessage(
		me: IGenericAccount,
		publicKey: Uint8Array,
		chunks: Uint8Array[],
		recipientKeys: { address: string; key: Uint8Array }[],
	) {
		const uniqueId = Math.floor(Math.random() * 4 * 10 ** 9);

		if (chunks.length === 1 && recipientKeys.length === 1) {
			const transaction = await this.reader.mailerContract.sendSmallMail(
				me.address,
				publicKey,
				uniqueId,
				recipientKeys[0].address,
				recipientKeys[0].key,
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = this.reader.mailerContract.decodeContentMessageBody(contentMsg.body!);
			return decodedEvent.msgId;
		} else if (chunks.length === 1 && recipientKeys.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70)) {
			const transaction = await this.reader.mailerContract.sendBulkMail(
				me.address,
				publicKey,
				uniqueId,
				recipientKeys.map(r => r.address),
				recipientKeys.map(r => r.key),
				chunks[0],
			);

			const om = transaction.childTransaction.outMessages;
			const contentMsg = om.length ? om[0] : null;
			if (!contentMsg || !contentMsg.body) {
				throw new Error('Content event was not found');
			}
			const decodedEvent = this.reader.mailerContract.decodeContentMessageBody(contentMsg.body!);
			return decodedEvent.msgId;
		} else {
			const initTime = Math.floor(Date.now() / 1000);
			const msgId = await this.reader.mailerContract.buildHash(publicKey, uniqueId, initTime);
			for (let i = 0; i < chunks.length; i++) {
				await this.reader.mailerContract.sendMultipartMailPart(
					me.address,
					publicKey,
					uniqueId,
					initTime,
					chunks.length,
					i,
					chunks[i],
				);
			}
			for (let i = 0; i < recipientKeys.length; i += 210) {
				const recs = recipientKeys.slice(i, i + 210);
				await this.reader.mailerContract.addRecipients(
					me.address,
					publicKey,
					uniqueId,
					initTime,
					recs.map(r => r.address),
					recs.map(r => r.key),
				);
			}
			return msgId;
		}
	}

	// message send block
	async sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: { address: string; publicKey: Uint8Array }[],
	): Promise<string> {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error('Not authorized');
		}
		const { content: encryptedContent, key } = MessageContainer.encodeContent(content);
		const chunks = MessageChunks.packContentInChunks(serviceCode, keypair.publicKey, encryptedContent, 10 * 1024);

		const recipientKeys = recipients.map(rec => {
			return { address: rec.address, key: keypair.encrypt(key, rec.publicKey) };
		});

		return this.publishMessage(me, keypair.publicKey, chunks, recipientKeys);
	}

	// message send block
	async sendNativeMessage(
		serviceCode: [number, number, number, number],
		encryptedContent: Uint8Array,
		key: Uint8Array,
		recipients: { address: string; publicKey: string }[],
	): Promise<string | null> {
		const me = await this.getAuthenticatedAccount();
		if (!me) {
			throw new Error('Not authorized');
		}

		const nativePublicKey = SmartBuffer.ofHexString(me.publicKey).bytes;
		const chunks = MessageChunks.packContentInChunks(
			serviceCode,
			nativePublicKey,
			encryptedContent,
			15 * 1024,
			true,
		);

		const encryptedKeys = await this.reader.ever.encryptData({
			publicKey: me.publicKey,
			recipientPublicKeys: recipients.map(r => r.publicKey),
			algorithm: 'ChaCha20Poly1305',
			data: new SmartBuffer(key).toBase64String(),
		});

		const recipientKeys = recipients.map((rec, idx) => {
			const kkey = encryptedKeys[idx];
			return {
				address: rec.address,
				key: packSymmetricalyEncryptedData(
					SmartBuffer.ofBase64String(kkey.data).bytes,
					SmartBuffer.ofBase64String(kkey.nonce).bytes,
				),
			};
		});

		return this.publishMessage(me, nativePublicKey, chunks, recipientKeys);
	}
}
