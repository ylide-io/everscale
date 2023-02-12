import { AbstractBlockchainController, IMessage, IMessageContent, IMessageCorruptedContent, IExtraEncryptionStrateryBulk, IExtraEncryptionStrateryEntry, MessageKey, BlockchainControllerFactory, Uint256, ISourceSubject, AbstractNameService, IBlockchainSourceSubject, LowLevelMessagesSource } from '@ylide/sdk';
import { ITVMMailerContractLink, ITVMMessage, ITVMRegistryContractLink, TVMMailerContractType, TVMRegistryContractType } from '../misc';
import { ExternalYlidePublicKey } from '@ylide/sdk';
import { EverscaleBlockchainReader } from './helpers/EverscaleBlockchainReader';
import { EverscaleMailerV6Wrapper } from '../contract-wrappers/EverscaleMailerV6Wrapper';
import { EverscaleRegistryV2Wrapper } from '../contract-wrappers/EverscaleRegistryV2Wrapper';
import { EverscaleMailerV5Wrapper } from '../contract-wrappers/EverscaleMailerV5Wrapper';
import { EverscaleRegistryV1Wrapper } from '../contract-wrappers/EverscaleRegistryV1Wrapper';
export declare class EverscaleBlockchainController extends AbstractBlockchainController {
    readonly blockchainReader: EverscaleBlockchainReader;
    static readonly mailerWrappers: Record<TVMMailerContractType, typeof EverscaleMailerV5Wrapper | typeof EverscaleMailerV6Wrapper>;
    static readonly registryWrappers: Record<TVMRegistryContractType, typeof EverscaleRegistryV1Wrapper | typeof EverscaleRegistryV2Wrapper>;
    readonly mailers: {
        link: ITVMMailerContractLink;
        wrapper: EverscaleMailerV5Wrapper | EverscaleMailerV6Wrapper;
    }[];
    readonly broadcasters: {
        link: ITVMMailerContractLink;
        wrapper: EverscaleMailerV5Wrapper | EverscaleMailerV6Wrapper;
    }[];
    readonly registries: {
        link: ITVMRegistryContractLink;
        wrapper: EverscaleRegistryV1Wrapper | EverscaleRegistryV2Wrapper;
    }[];
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
    readonly MESSAGES_FETCH_LIMIT = 50;
    readonly mainnetEndpoints: string[];
    constructor(options?: {
        dev?: boolean;
        endpoints?: string[];
    });
    blockchainGroup(): string;
    blockchain(): string;
    isReadingBySenderAvailable(): boolean;
    defaultNameService(): AbstractNameService | null;
    init(): Promise<void>;
    getBalance(address: string): Promise<{
        original: string;
        numeric: number;
        string: string;
        e18: string;
    }>;
    getRecipientReadingRules(address: Uint256): Promise<any>;
    extractPublicKeyFromAddress(address: string): Promise<ExternalYlidePublicKey | null>;
    extractPublicKeysHistoryByAddress(address: string): Promise<ExternalYlidePublicKey[]>;
    isValidMsgId(msgId: string): boolean;
    getMessageByMsgId(msgId: string): Promise<ITVMMessage | null>;
    getBlockchainSourceSubjects(subject: ISourceSubject): IBlockchainSourceSubject[];
    ininiateMessagesSource(subject: IBlockchainSourceSubject): LowLevelMessagesSource;
    retrieveMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;
    isAddressValid(address: string): boolean;
    extractNativePublicKeyFromAddress(addressStr: string): Promise<Uint8Array | null>;
    decodeNativeKey(senderPublicKey: Uint8Array, recipientPublicKey: Uint8Array, key: Uint8Array): Promise<Uint8Array>;
    getExtraEncryptionStrategiesFromAddress(address: string): Promise<IExtraEncryptionStrateryEntry[]>;
    getSupportedExtraEncryptionStrategies(): string[];
    prepareExtraEncryptionStrategyBulk(entries: IExtraEncryptionStrateryEntry[]): Promise<IExtraEncryptionStrateryBulk>;
    executeExtraEncryptionStrategy(entries: IExtraEncryptionStrateryEntry[], bulk: IExtraEncryptionStrateryBulk, addedPublicKeyIndex: number | null, messageKey: Uint8Array): Promise<MessageKey[]>;
    addressToUint256(address: string): Uint256;
    compareMessagesTime(a: IMessage, b: IMessage): number;
}
export declare const everscaleBlockchainFactory: BlockchainControllerFactory;
