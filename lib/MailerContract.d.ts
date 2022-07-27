import { Address, Contract } from 'everscale-inpage-provider';
import { CONTRACT_ABI } from './EverscaleContract';
import { EverscaleBlockchainController } from './EverscaleBlockchainController';
export declare class MailerContract {
	readonly contract: Contract<typeof CONTRACT_ABI>;
	constructor(reader: EverscaleBlockchainController, isDev: boolean);
	getMsgId(
		publicKey: Uint8Array,
		uniqueId: number,
	): Promise<{
		msgId: never;
		initTime: never;
	}>;
	sendMultipartMailPart(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		initTime: number,
		parts: number,
		partIdx: number,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendSmallMail(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendSmallMail0(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendSmallMail1(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendSmallMail2(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendSmallMail4(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipient: string,
		key: Uint8Array,
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
	sendBulkMail(
		address: string,
		publicKey: Uint8Array,
		uniqueId: number,
		recipients: string,
		keys: Uint8Array[],
		content: Uint8Array,
	): Promise<{
		parentTransaction: import('everscale-inpage-provider').Transaction<Address>;
		childTransaction: import('everscale-inpage-provider').Transaction<Address>;
		output?: undefined;
	}>;
}
