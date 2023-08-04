import { BitPackReader, BitPackWriter, Uint256 } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';

export const encodeTvmMsgId = (isBroacast: boolean, contractId2bytes: number, id: Uint256) => {
	const writer = new BitPackWriter();
	writer.writeBit(1);
	writer.writeBit(isBroacast ? 1 : 0);
	writer.writeBits(2, 4); // TVM
	writer.writeUintVariableSize(contractId2bytes);
	const bytes = SmartBuffer.ofHexString(id).bytes;
	writer.writeBytes(bytes);
	return new SmartBuffer(writer.toBuffer()).toBase64String();
};

export const decodeTvmMsgId = (msgId: string) => {
	const buffer = SmartBuffer.ofBase64String(msgId);
	const reader = BitPackReader.fromBuffer(buffer.bytes, true);
	if (reader.readBit() !== 1) {
		throw new Error('Invalid shrink bit');
	}
	const isBroadcast = reader.readBit() === 1;
	const tvmFlag = reader.readBits(4); // TVM flag
	if (tvmFlag !== 2) {
		throw new Error('Invalid TVM flag');
	}
	const contractId2bytes = reader.readUintVariableSize();
	// const lt8bytes = reader.readUint64();
	const idUint256Hex = new SmartBuffer(reader.readBytes(32)).toHexString();

	return {
		isBroadcast,
		contractId: contractId2bytes,
		id: idUint256Hex as Uint256,
		// contentId: contentIdUint256Hex as Uint256,
	};
};
