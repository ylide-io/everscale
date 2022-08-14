import { Uint256 } from '@ylide/sdk';
import { Address, Contract } from 'everscale-inpage-provider';
import { EverscaleBlockchainController } from '../controllers/EverscaleBlockchainController';
import { IEverscaleBroadcastMessageBody, IEverscaleContentMessageBody, IEverscalePushMessageBody } from '../misc';
export declare class MailerContract {
    private readonly reader;
    readonly contractAddress: string;
    readonly contract: Contract<typeof MAILER_ABI>;
    constructor(reader: EverscaleBlockchainController, contractAddress: string);
    buildHash(pubkey: Uint8Array, uniqueId: number, time: number): Promise<Uint256>;
    setFees(address: string, _contentPartFee: number, _recipientFee: number): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    transferOwnership(address: string, newOwner: string): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    setBeneficiary(address: string, _beneficiary: string): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    addRecipients(address: string, uniqueId: number, initTime: number, recipients: Uint256[], keys: Uint8Array[]): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendMultipartMailPart(address: string, uniqueId: number, initTime: number, parts: number, partIdx: number, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    broadcastMail(address: string, uniqueId: number, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    broadcastMailHeader(address: string, uniqueId: number, initTime: number): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendSmallMail(address: string, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendBulkMail(address: string, uniqueId: number, recipients: Uint256[], keys: Uint8Array[], content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    decodePushMessageBody(body: string): IEverscalePushMessageBody;
    decodeBroadcastMessageBody(body: string): IEverscaleBroadcastMessageBody;
    decodeContentMessageBody(body: string): IEverscaleContentMessageBody;
}
declare const MAILER_ABI: {
    'ABI version': number;
    version: string;
    header: string[];
    functions: {
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
    data: {
        key: number;
        name: string;
        type: string;
    }[];
    events: {
        name: string;
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: never[];
    }[];
    fields: {
        name: string;
        type: string;
    }[];
};
export {};
