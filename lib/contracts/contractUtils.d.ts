import { IEverscalePushMessageBody, IEverscaleBroadcastMessageBody, IEverscaleContentMessageBody } from '../misc';
export declare function decodeBroadcastMessageBody(body: string): IEverscaleBroadcastMessageBody;
export declare function decodePushMessageBody(body: string): IEverscalePushMessageBody;
export declare function decodeContentMessageBody(body: string): IEverscaleContentMessageBody;
export declare function decodeAddressToPublicKeyMessageBody(body: string): Uint8Array;
