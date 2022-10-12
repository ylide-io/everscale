import { ProviderRpcClient } from 'everscale-inpage-provider';
import { AbstractBlockchainController, IMessage, IMessageContent, IMessageCorruptedContent, IExtraEncryptionStrateryBulk, IExtraEncryptionStrateryEntry, MessageKey, PublicKey, BlockchainControllerFactory, Uint256, AbstractNameService } from '@ylide/sdk';
import { IEverscaleMessage } from '../misc';
import { GqlSender } from '../misc/GqlSender';
export declare class EverscaleBlockchainController extends AbstractBlockchainController {
    ever: ProviderRpcClient;
    gql: GqlSender;
    readonly everscaleEncryptCore: Promise<any>;
    readonly MESSAGES_FETCH_LIMIT = 50;
    readonly mailerContractAddress: string;
    readonly broadcasterContractAddress: string;
    readonly registryContractAddress: string;
    private readonly mainnetEndpoints;
    constructor(options?: {
        dev?: boolean;
        mailerContractAddress?: string;
        broadcasterContractAddress?: string;
        registryContractAddress?: string;
        endpoints?: string[];
    });
    isReadingBySenderAvailable(): boolean;
    defaultNameService(): AbstractNameService | null;
    init(): Promise<void>;
    getBalance(address: string): Promise<string>;
    getDefaultMailerAddress(): string;
    getRecipientReadingRules(address: Uint256): Promise<any>;
    private getPublicKeyByAddress;
    extractPublicKeyFromAddress(address: string): Promise<PublicKey | null>;
    private _retrieveMessageHistoryByTime;
    private _retrieveMessageHistoryByBounds;
    retrieveMessageHistoryByTime(sender: string | null, recipient: Uint256 | null, fromTimestamp?: number, toTimestamp?: number, limit?: number): Promise<IMessage[]>;
    retrieveMessageHistoryByBounds(sender: string | null, recipient: Uint256 | null, fromMessage?: IMessage, toMessage?: IMessage, limit?: number): Promise<IMessage[]>;
    retrieveBroadcastHistoryByTime(sender: string | null, fromTimestamp?: number, toTimestamp?: number, limit?: number): Promise<IMessage[]>;
    retrieveBroadcastHistoryByBounds(sender: string | null, fromMessage?: IMessage, toMessage?: IMessage, limit?: number): Promise<IMessage[]>;
    gqlQueryMessages(query: string, variables?: Record<string, any>): Promise<IEverscaleMessage[]>;
    private gqlQuery;
    private convertMsgIdToAddress;
    retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;
    retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | IMessageCorruptedContent | null>;
    private formatPushMessage;
    private formatBroadcastMessage;
    isAddressValid(address: string): boolean;
    private queryMessagesList;
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
