import { ProviderRpcClient } from 'everscale-inpage-provider';
import { IGenericAccount, AbstractWalletController, PublicKey, MessageKey, WalletControllerFactory, Uint256 } from '@ylide/sdk';
import { MailerContract, RegistryContract } from '../contracts';
export declare class EverscaleWalletController extends AbstractWalletController {
    ever: ProviderRpcClient;
    readonly mailerContract: MailerContract;
    readonly registryContract: RegistryContract;
    constructor(options?: {
        dev?: boolean;
        mailerContractAddress?: string;
        registryContractAddress?: string;
        endpoint?: string;
    });
    addressToUint256(address: string): Uint256;
    requestYlidePrivateKey(me: IGenericAccount): Promise<Uint8Array | null>;
    signMagicString(magicString: string): Promise<Uint8Array>;
    getAuthenticatedAccount(): Promise<IGenericAccount | null>;
    attachPublicKey(publicKey: Uint8Array): Promise<void>;
    requestAuthentication(): Promise<null | IGenericAccount>;
    disconnectAccount(): Promise<void>;
    publishMessage(me: IGenericAccount, contentData: Uint8Array, recipients: {
        address: Uint256;
        messageKey: MessageKey;
    }[]): Promise<Uint256 | null>;
    broadcastMessage(me: IGenericAccount, contentData: Uint8Array): Promise<Uint256 | null>;
    decryptMessageKey(senderPublicKey: PublicKey, recipientAccount: IGenericAccount, encryptedKey: Uint8Array): Promise<Uint8Array>;
}
export declare const everscaleWalletFactory: WalletControllerFactory;
