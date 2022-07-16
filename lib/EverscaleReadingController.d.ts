import { ProviderRpcClient } from 'everscale-inpage-provider';
import {
	AbstractReadingController,
	IMessage,
	RetrievingMessagesOptions,
	IGenericAccount,
	IMessageContent,
} from '@ylide/sdk';
import { RegistryContract } from './RegistryContract';
import { MailerContract } from './MailerContract';
export declare class EverscaleReadingController extends AbstractReadingController {
	ever: ProviderRpcClient;
	gqlAddress: string;
	readonly MESSAGES_FETCH_LIMIT = 50;
	readonly mailerContract: MailerContract;
	readonly registryContract: RegistryContract;
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
	static blockchainType(): string;
	getRecipientReadingRules(address: string): Promise<any>;
	extractAddressFromPublicKey(publicKey: Uint8Array): Promise<string | null>;
	extractPublicKeyFromAddress(address: string): Promise<Uint8Array | null>;
	retrieveMessageHistoryByDates(recipientAddress: string, options?: RetrievingMessagesOptions): Promise<IMessage[]>;
	private gqlQuery;
	private convertMsgIdToAddress;
	retrieveMessageContentByMsgId(msgId: string): Promise<IMessageContent | null>;
	private formatPushMessage;
	private decodePushMessageBody;
	private decodeContentMessageBody;
	decodeMailText(senderAddress: string, recipient: IGenericAccount, data: string, nonce: string): Promise<string>;
	isAddressValid(address: string): boolean;
	private queryMessagesList;
}
