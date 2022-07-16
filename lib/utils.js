"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicKeyToBigIntString = void 0;
var smart_buffer_1 = require("@ylide/smart-buffer");
function publicKeyToBigIntString(publicKey) {
    return BigInt('0x' + new smart_buffer_1.default(publicKey).toHexString()).toString();
}
exports.publicKeyToBigIntString = publicKeyToBigIntString;
//# sourceMappingURL=utils.js.map