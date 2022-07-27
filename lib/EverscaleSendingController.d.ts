import { AbstractWalletController, IGenericAccount, MessageContent, YlideUnencryptedKeyPair } from '@ylide/sdk';
import { EverscaleBlockchainController } from '.';
export declare class EverscaleWalletController extends AbstractWalletController {
	reader: EverscaleBlockchainController;
	constructor(props?: {
		address: string;
		abi: {
			'ABI version': number;
			'version': string;
			'header': string[];
			'functions': {
				name: string;
				inputs: {
					name: string;
					type: string;
				}[];
				outputs: {
					name: string;
					type: string;
				}[];
			}[];
			'data': never[];
			'events': {
				name: string;
				inputs: {
					name: string;
					type: string;
				}[];
				outputs: never[];
			}[];
			'fields': {
				name: string;
				type: string;
			}[];
		};
		dev: boolean;
	});
	static isWalletAvailable(): Promise<boolean>;
	static walletType(): string;
	static blockchainType(): string;
	deriveMessagingKeypair(magicString: string): Promise<Uint8Array>;
	getAuthenticatedAccount(): Promise<IGenericAccount | null>;
	attachPublicKey(publicKey: Uint8Array): Promise<void>;
	requestAuthentication(): Promise<null | IGenericAccount>;
	disconnectAccount(): Promise<void>;
	sendMessage(
		serviceCode: [number, number, number, number],
		keypair: YlideUnencryptedKeyPair,
		content: MessageContent,
		recipients: {
			address: string;
			publicKey: Uint8Array;
		}[],
	): Promise<string | null>;
}
