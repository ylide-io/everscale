"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicKeyToBigIntString = void 0;
var smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
function publicKeyToBigIntString(publicKey) {
    return BigInt('0x' + new smart_buffer_1.default(publicKey).toHexString()).toString();
}
exports.publicKeyToBigIntString = publicKeyToBigIntString;
//# sourceMappingURL=utils.js.map