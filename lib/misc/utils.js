"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uint256ToAddress = exports.publicKeyToBigIntString = void 0;
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
//# sourceMappingURL=utils.js.map