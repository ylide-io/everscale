import { AbstractSendingController, IGenericAccount, MessageContent, YlideUnencryptedKeyPair } from '@ylide/sdk';
import { EverscaleReadingController } from '.';
export declare class EverscaleSendingController extends AbstractSendingController {
    reader: EverscaleReadingController;
    constructor(props?: {
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
    sendMessage(serviceCode: [number, number, number, number], keypair: YlideUnencryptedKeyPair, content: MessageContent, recipients: {
        address: string;
        publicKey: Uint8Array;
    }[]): Promise<string | null>;
}
