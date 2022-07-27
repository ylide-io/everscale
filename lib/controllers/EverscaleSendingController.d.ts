import { AbstractWalletController, IGenericAccount, MessageContent, YlideUnencryptedKeyPair } from '@ylide/sdk';
import { EverscaleBlockchainController } from '.';
export declare class EverscaleWalletController extends AbstractWalletController {
	reader: EverscaleBlockchainController;
	constructor(options?: {
		dev?: boolean;
		mailerContractAddress?: string;
		registryContractAddress?: string;
		endpoint?: string;
	});
	static isWalletAvailable(): Promise<boolean>;
	static walletType(): string;
	static blockchainType(): string;
	deriveMessagingKeypair(magicString: string): Promise<Uint8Array>;
	getAuthenticatedAccount(): Promise<IGenericAccount | null>;
	attachPublicKey(publicKey: Uint8Array): Promise<void>;
	requestAuthentication(): Promise<null | IGenericAccount>;
	disconnectAccount(): Promise<void>;
	publishMessage(
		me: IGenericAccount,
		publicKey: Uint8Array,
		chunks: Uint8Array[],
		recipientKeys: {
			address: string;
			key: Uint8Array;
		}[],
	): Promise<string>;
	sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: {
			address: string;
			publicKey: Uint8Array;
		}[],
	): Promise<string>;
	sendNativeMessage(
		serviceCode: [number, number, number, number],
		encryptedContent: Uint8Array,
		key: Uint8Array,
		recipients: {
			address: string;
			publicKey: string;
		}[],
	): Promise<string | null>;
}
