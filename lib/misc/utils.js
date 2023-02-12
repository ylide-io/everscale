"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTVMAddressValid = exports.convertMsgIdToAddress = exports.everscaleAddressToUint256 = exports.uint256ToAddress = exports.publicKeyToBigIntString = void 0;
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
function publicKeyToBigIntString(publicKey) {
    return BigInt('0x' + new smart_buffer_1.default(publicKey).toHexString()).toString();
}
exports.publicKeyToBigIntString = publicKeyToBigIntString;
function uint256ToAddress(value, withPrefix = true, nullPrefix = false) {
    if (value.length !== 64) {
        throw new Error('Value must have 32-bytes');
    }
    return `${withPrefix ? (nullPrefix ? ':' : '0:') : ''}${value}`;
}
exports.uint256ToAddress = uint256ToAddress;
function everscaleAddressToUint256(address) {
    return (0, sdk_1.hexToUint256)(address.substring(address.length - 64, address.length).toLowerCase());
}
exports.everscaleAddressToUint256 = everscaleAddressToUint256;
function convertMsgIdToAddress(msgId) {
    return `:${msgId}`;
}
exports.convertMsgIdToAddress = convertMsgIdToAddress;
function isTVMAddressValid(address) {
    if (address.length !== 66) {
        return false;
    }
    else if (!address.includes(':')) {
        return false;
    }
    const splitAddress = address.split(':');
    if (splitAddress[0] !== '0') {
        return false;
    }
    if (splitAddress[1].includes('_'))
        return false;
    const regExp = new RegExp('^[^\\W]+$');
    return regExp.test(splitAddress[1]);
}
exports.isTVMAddressValid = isTVMAddressValid;
//# sourceMappingURL=utils.js.map