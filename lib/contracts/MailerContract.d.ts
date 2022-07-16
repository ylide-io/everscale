import { Address, Contract } from 'everscale-inpage-provider';
import { EverscaleReadingController } from '../controllers/EverscaleReadingController';
import { IEverscaleContentMessageBody, IEverscalePushMessageBody } from '../misc';
export declare class MailerContract {
    private readonly reader;
    readonly contractAddress: string;
    readonly contract: Contract<typeof MAILER_ABI>;
    constructor(reader: EverscaleReadingController, contractAddress: string);
    getMsgId(publicKey: Uint8Array, uniqueId: number): Promise<{
        msgId: never;
        initTime: never;
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
    sendSmallMail0(address: string, publicKey: Uint8Array, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendSmallMail1(address: string, publicKey: Uint8Array, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendSmallMail2(address: string, publicKey: Uint8Array, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendSmallMail4(address: string, publicKey: Uint8Array, uniqueId: number, recipient: string, key: Uint8Array, content: Uint8Array): Promise<{
        parentTransaction: import("everscale-inpage-provider").Transaction<Address>;
        childTransaction: import("everscale-inpage-provider").Transaction<Address>;
        output?: undefined;
    }>;
    sendBulkMail(address: string, publicKey: Uint8Array, uniqueId: number, recipients: string, keys: Uint8Array[], content: Uint8Array): Promise<{
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
    data: never[];
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
