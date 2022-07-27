import { ProviderRpcClient } from 'everscale-inpage-provider';
import {
	AbstractBlockchainController,
	IMessage,
	RetrievingMessagesOptions,
	IMessageContent,
	IMessageCorruptedContent,
} from '@ylide/sdk';
import { MailerContract, RegistryContract } from '../contracts';
import { IEverscaleMessage } from '../misc';
import { GqlSender } from '../misc/GqlSender';
export declare class EverscaleBlockchainController extends AbstractBlockchainController {
	ever: ProviderRpcClient;
	gql: GqlSender;
	readonly MESSAGES_FETCH_LIMIT = 50;
	readonly mailerContract: MailerContract;
	readonly registryContract: RegistryContract;
	private readonly mainnetEndpoints;
	constructor(options?: {
		dev?: boolean;
		mailerContractAddress?: string;
		registryContractAddress?: string;
		endpoints?: string[];
	});
	static blockchainType(): string;
	getRecipientReadingRules(address: string): Promise<any>;
	extractAddressFromPublicKey(publicKey: Uint8Array): Promise<string | null>;
	extractPublicKeyFromAddress(address: string): Promise<Uint8Array | null>;
	extractNativePublicKeyFromAddress(addressStr: string): Promise<Uint8Array | null>;
	retrieveMessageHistoryByDates(recipientAddress: string, options?: RetrievingMessagesOptions): Promise<IMessage[]>;
	gqlQueryMessages(query: string, variables?: Record<string, any>): Promise<IEverscaleMessage[]>;
	private gqlQuery;
	private convertMsgIdToAddress;
	retrieveAndVerifyMessageContent(msg: IMessage): Promise<IMessageContent | IMessageCorruptedContent | null>;
	retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | IMessageCorruptedContent | null>;
	private formatPushMessage;
	decodeNativeKey(senderPublicKey: Uint8Array, recipientPublicKey: Uint8Array, key: Uint8Array): Promise<Uint8Array>;
	isAddressValid(address: string): boolean;
	private queryMessagesList;
}
