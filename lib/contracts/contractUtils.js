"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeAddressToPublicKeyMessageBody = exports.decodeContentMessageBody = exports.decodePushMessageBody = exports.decodeBroadcastMessageBody = void 0;
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const core_1 = __importDefault(require("everscale-standalone-client/core"));
const MailerContract_1 = require("./MailerContract");
const RegistryContract_1 = require("./RegistryContract");
function decodeBroadcastMessageBody(body) {
    const data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(MailerContract_1.MAILER_ABI), 'MailBroadcast');
    if (!data) {
        throw new Error('PushMessage format is not supported');
    }
    return {
        msgId: (0, sdk_1.bigIntToUint256)(data.data.msgId),
    };
}
exports.decodeBroadcastMessageBody = decodeBroadcastMessageBody;
function decodePushMessageBody(body) {
    const data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(MailerContract_1.MAILER_ABI), 'MailPush');
    if (!data) {
        throw new Error('PushMessage format is not supported');
    }
    return {
        sender: data.data.sender.startsWith(':') ? `0${data.data.sender}` : data.data.sender,
        msgId: (0, sdk_1.bigIntToUint256)(data.data.msgId),
        key: smart_buffer_1.default.ofBase64String(data.data.key).bytes,
    };
}
exports.decodePushMessageBody = decodePushMessageBody;
function decodeContentMessageBody(body) {
    const data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(MailerContract_1.MAILER_ABI), 'MailContent');
    if (!data) {
        throw new Error('ContentMessage format is not supported');
    }
    return {
        sender: data.data.sender,
        msgId: (0, sdk_1.bigIntToUint256)(data.data.msgId),
        parts: Number(data.data.parts),
        partIdx: Number(data.data.partIdx),
        content: smart_buffer_1.default.ofBase64String(data.data.content).bytes,
    };
}
exports.decodeContentMessageBody = decodeContentMessageBody;
function decodeAddressToPublicKeyMessageBody(body) {
    const data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(RegistryContract_1.REGISTRY_ABI), 'AddressToPublicKey');
    if (!data) {
        throw new Error('AddressToPublicKeyMessage format is not supported');
    }
    return smart_buffer_1.default.ofHexString(BigInt(data.data.publicKey)
        .toString(16)
        .padStart(64, '0')).bytes;
}
exports.decodeAddressToPublicKeyMessageBody = decodeAddressToPublicKeyMessageBody;
//# sourceMappingURL=contractUtils.js.map