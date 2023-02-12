import { IGenericAccount, AbstractWalletController, PublicKey, MessageKey, WalletControllerFactory, Uint256, SwitchAccountCallback, YlidePublicKeyVersion, SendMailResult } from '@ylide/sdk';
import { EverscaleMailerV6Wrapper } from '../contract-wrappers/EverscaleMailerV6Wrapper';
import { EverscaleRegistryV2Wrapper } from '../contract-wrappers/EverscaleRegistryV2Wrapper';
import { ITVMMailerContractLink, ITVMRegistryContractLink } from '../misc';
import { EverscaleBlockchainReader } from './helpers/EverscaleBlockchainReader';
export declare class EverscaleWalletController extends AbstractWalletController {
    readonly blockchainReader: EverscaleBlockchainReader;
    readonly currentMailer: {
        link: ITVMMailerContractLink;
        wrapper: EverscaleMailerV6Wrapper;
    };
    readonly currentBroadcaster: {
        link: ITVMMailerContractLink;
        wrapper: EverscaleMailerV6Wrapper;
    };
    readonly currentRegistry: {
        link: ITVMRegistryContractLink;
        wrapper: EverscaleRegistryV2Wrapper;
    };
    readonly mainnetEndpoints: string[];
    private lastCurrentAccount;
    constructor(options?: {
        dev?: boolean;
        endpoints?: string[];
        onSwitchAccountRequest?: SwitchAccountCallback;
    });
    blockchainGroup(): string;
    wallet(): string;
    isMultipleAccountsSupported(): boolean;
    init(): Promise<void>;
    private ensureAccount;
    addressToUint256(address: string): Uint256;
    requestYlidePrivateKey(me: IGenericAccount): Promise<Uint8Array | null>;
    signMagicString(account: IGenericAccount, magicString: string): Promise<Uint8Array>;
    getAuthenticatedAccount(): Promise<IGenericAccount | null>;
    getCurrentBlockchain(): Promise<string>;
    attachPublicKey(me: IGenericAccount, publicKey: Uint8Array, keyVersion?: YlidePublicKeyVersion, registrar?: number, options?: any): Promise<void>;
    requestAuthentication(): Promise<null | IGenericAccount>;
    disconnectAccount(account: IGenericAccount): Promise<void>;
    sendMail(me: IGenericAccount, contentData: Uint8Array, recipients: {
        address: Uint256;
        messageKey: MessageKey;
    }[]): Promise<SendMailResult>;
    sendBroadcast(me: IGenericAccount, contentData: Uint8Array): Promise<SendMailResult>;
    decryptMessageKey(recipientAccount: IGenericAccount, senderPublicKey: PublicKey, encryptedKey: Uint8Array): Promise<Uint8Array>;
    deployMailerV5(me: IGenericAccount): Promise<string>;
}
export declare const everscaleWalletFactory: WalletControllerFactory;
