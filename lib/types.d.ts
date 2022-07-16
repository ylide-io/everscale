export interface IEverscaleMessage {
    id: string;
    created_at: number;
    created_lt: string;
    src: string;
    dst: string;
    body: string;
}
export interface IEverscalePushMessageBody {
    sender: string;
    msgId: string;
    key: Uint8Array;
}
export interface IEverscalePushMessage extends IEverscaleMessage, IEverscalePushMessageBody {
}
export interface IEverscaleContentMessageBody {
    sender: string;
    msgId: string;
    parts: number;
    partIdx: number;
    content: Uint8Array;
}
export interface IEverscaleContentMessage extends IEverscaleMessage, IEverscaleContentMessageBody {
}
