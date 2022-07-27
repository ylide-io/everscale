import { IGenericAccount, AbstractWalletController, PublicKey, MessageKey, WalletControllerFactory } from '@ylide/sdk';
import { EverscaleBlockchainController } from '.';
export declare class EverscaleWalletController extends AbstractWalletController {
    readonly blockchainController: EverscaleBlockchainController;
    constructor(blockchainController: EverscaleBlockchainController, options?: {
        dev?: boolean;
        mailerContractAddress?: string;
        registryContractAddress?: string;
        endpoint?: string;
    });
    signMagicString(magicString: string): Promise<Uint8Array>;
    getAuthenticatedAccount(): Promise<IGenericAccount | null>;
    attachPublicKey(publicKey: Uint8Array): Promise<void>;
    requestAuthentication(): Promise<null | IGenericAccount>;
    disconnectAccount(): Promise<void>;
    publishMessage(me: IGenericAccount, contentData: Uint8Array, recipients: {
        address: string;
        messageKey: MessageKey;
    }[]): Promise<string | null>;
    decryptMessageKey(senderPublicKey: PublicKey, recipientAccount: IGenericAccount, encryptedKey: Uint8Array): Promise<Uint8Array>;
}
export declare const everscaleWalletFactory: WalletControllerFactory;
