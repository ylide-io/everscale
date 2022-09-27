import { ProviderRpcClient } from 'everscale-inpage-provider';
import { IGenericAccount, AbstractWalletController, PublicKey, MessageKey, WalletControllerFactory, Uint256, SwitchAccountCallback } from '@ylide/sdk';
import { MailerContract, RegistryContract } from '../contracts';
export declare class EverscaleWalletController extends AbstractWalletController {
    ever: ProviderRpcClient;
    readonly mailerContract: MailerContract;
    readonly broadcasterContract: MailerContract;
    readonly registryContract: RegistryContract;
    private lastCurrentAccount;
    constructor(options?: {
        dev?: boolean;
        mailerContractAddress?: string;
        broadcasterContractAddress?: string;
        registryContractAddress?: string;
        endpoint?: string;
        onSwitchAccountRequest?: SwitchAccountCallback;
    });
    isMultipleAccountsSupported(): boolean;
    init(): Promise<void>;
    private ensureAccount;
    addressToUint256(address: string): Uint256;
    requestYlidePrivateKey(me: IGenericAccount): Promise<Uint8Array | null>;
    signMagicString(account: IGenericAccount, magicString: string): Promise<Uint8Array>;
    getAuthenticatedAccount(): Promise<IGenericAccount | null>;
    getCurrentBlockchain(): Promise<string>;
    attachPublicKey(account: IGenericAccount, publicKey: Uint8Array): Promise<void>;
    requestAuthentication(): Promise<null | IGenericAccount>;
    disconnectAccount(account: IGenericAccount): Promise<void>;
    publishMessage(me: IGenericAccount, contentData: Uint8Array, recipients: {
        address: Uint256;
        messageKey: MessageKey;
    }[]): Promise<Uint256 | null>;
    broadcastMessage(me: IGenericAccount, contentData: Uint8Array): Promise<Uint256 | null>;
    decryptMessageKey(recipientAccount: IGenericAccount, senderPublicKey: PublicKey, encryptedKey: Uint8Array): Promise<Uint8Array>;
}
export declare const everscaleWalletFactory: WalletControllerFactory;
