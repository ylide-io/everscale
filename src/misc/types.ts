import { IMessage, Uint256 } from '@ylide/sdk';

export interface ITVMInternalMessage {
	id: string;

	created_at: number;
	created_lt: string;

	src: string;
	dst: string;

	body: string;
}

export interface ITVMMeta {
	id: string;
	created_lt: string;
	src: string;
	dst: string;

	internalMsgId: Uint256;
}

export type ITVMMessage = IMessage<ITVMMeta>;

// export interface ITVMPushMessage extends ITVMMessage, ITVMPushMessageBody {}

export interface ITVMContentMessageBody {
	sender: string;
	msgId: Uint256;
	parts: number;
	partIdx: number;
	content: Uint8Array;
}

export interface ITVMRecipientsMessageBody {
	sender: string;
	msgId: Uint256;
	recipients: string[];
}

// export interface ITVMContentMessage extends ITVMMessage, ITVMContentMessageBody {}

// ----

export enum TVMMailerContractType {
	TVMMailerV5 = 'TVMMailerV5',
	TVMMailerV6 = 'TVMMailerV6',
	TVMMailerV7 = 'TVMMailerV7',
}

export enum TVMRegistryContractType {
	TVMRegistryV1 = 'TVMRegistryV1',
	TVMRegistryV2 = 'TVMRegistryV2',
}

export interface ITVMBaseContractLink {
	id: number;
	verified: boolean;
	address: string;
}

export interface ITVMMailerContractLink extends ITVMBaseContractLink {
	type: TVMMailerContractType;
}

export interface ITVMRegistryContractLink extends ITVMBaseContractLink {
	type: TVMRegistryContractType;
}

export interface ITVMNetworkContracts {
	mailerContracts: ITVMMailerContractLink[];
	broadcasterContracts: ITVMMailerContractLink[];
	registryContracts: ITVMRegistryContractLink[];

	currentMailerId: number;
	currentBroadcasterId: number;
	currentRegistryId: number;
}
