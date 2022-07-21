import { Address, Contract } from 'everscale-inpage-provider';
import { EverscaleReadingController } from '../controllers/EverscaleReadingController';
import { IEverscaleContentMessageBody, IEverscalePushMessageBody } from '../misc';
export declare class MailerContract {
    private readonly reader;
    readonly contractAddress: string;
    readonly contract: Contract<typeof MAILER_ABI>;
    constructor(reader: EverscaleReadingController, contractAddress: string);
    buildHash(pubkey: Uint8Array, uniqueId: number, time: number): Promise<string>;
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
    addRecipients(address: string, publicKey: Uint8Array, uniqueId: number, initTime: number, recipients: string[], keys: Uint8Array[]): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendMultipartMailPart(address: string, publicKey: Uint8Array, uniqueId: number, initTime: number, parts: number, partIdx: number, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendSmallMail(address: string, publicKey: Uint8Array, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendBulkMail(address: string, publicKey: Uint8Array, uniqueId: number, recipients: string[], keys: Uint8Array[], content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    decodePushMessageBody(body: string): IEverscalePushMessageBody;
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
