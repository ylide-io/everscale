import { Uint256 } from '@ylide/sdk';

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
	msgId: Uint256;
	key: Uint8Array;
}

export interface IEverscalePushMessage extends IEverscaleMessage, IEverscalePushMessageBody {}

export interface IEverscaleContentMessageBody {
	sender: string;
	msgId: Uint256;
	parts: number;
	partIdx: number;
	content: Uint8Array;
}

export interface IEverscaleContentMessage extends IEverscaleMessage, IEverscaleContentMessageBody {}
