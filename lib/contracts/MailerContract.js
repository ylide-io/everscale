"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerContract = void 0;
var smart_buffer_1 = require("@ylide/smart-buffer");
var everscale_inpage_provider_1 = require("everscale-inpage-provider");
var core_1 = require("everscale-standalone-client/core");
var misc_1 = require("../misc");
var MailerContract = /** @class */ (function () {
    function MailerContract(reader, contractAddress) {
        this.reader = reader;
        this.contractAddress = contractAddress;
        this.contract = new reader.ever.Contract(MAILER_ABI, new everscale_inpage_provider_1.Address(this.contractAddress));
    }
    MailerContract.prototype.setFees = function (address, _contentPartFee, _recipientFee) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            .setFees({
                            // @ts-ignore
                            _contentPartFee: BigInt(_contentPartFee).toString(10),
                            // @ts-ignore
                            _recipientFee: BigInt(_recipientFee).toString(10),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '200000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.transferOwnership = function (address, newOwner) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            .transferOwnership({
                            // @ts-ignore
                            newOwner: newOwner,
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '200000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.setBeneficiary = function (address, _beneficiary) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            .setBeneficiary({
                            // @ts-ignore
                            _beneficiary: _beneficiary,
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '200000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.getMsgId = function (publicKey, uniqueId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, msgId, initTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .getMsgId({ publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey), uniqueId: uniqueId })
                            .call()];
                    case 1:
                        _a = _b.sent(), msgId = _a.msgId, initTime = _a.initTime;
                        return [2 /*return*/, {
                                msgId: msgId,
                                initTime: initTime,
                            }];
                }
            });
        });
    };
    MailerContract.prototype.sendMultipartMailPart = function (address, publicKey, uniqueId, initTime, parts, partIdx, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            .sendMultipartMailPart({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            initTime: initTime,
                            // @ts-ignore
                            parts: parts,
                            // @ts-ignore
                            partIdx: partIdx,
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendSmallMail = function (address, publicKey, uniqueId, recipient, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendSmallMail({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            recipient: recipient,
                            // @ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendSmallMail0 = function (address, publicKey, uniqueId, recipient, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendSmallMail0({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            recipient: recipient,
                            // @ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendSmallMail1 = function (address, publicKey, uniqueId, recipient, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendSmallMail1({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            recipient: recipient,
                            // @ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendSmallMail2 = function (address, publicKey, uniqueId, recipient, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendSmallMail2({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            recipient: recipient,
                            // @ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendSmallMail4 = function (address, publicKey, uniqueId, recipient, key, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendSmallMail4({
                            // @ts-ignore
                            publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey),
                            // @ts-ignore
                            uniqueId: uniqueId,
                            // @ts-ignore
                            recipient: recipient,
                            // @ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            // @ts-ignore
                            content: new smart_buffer_1.default(content).toBase64String(),
                        })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.sendBulkMail = function (address, publicKey, uniqueId, recipients, keys, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .sendBulkMail({ publicKey: publicKey, uniqueId: uniqueId, recipients: recipients, keys: keys, content: content })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MailerContract.prototype.decodePushMessageBody = function (body) {
        var data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailPush');
        if (!data) {
            throw new Error('PushMessage format is not supported');
        }
        return {
            sender: data.data.sender.startsWith(':')
                ? "0".concat(data.data.sender)
                : data.data.sender,
            msgId: BigInt(data.data.msgId)
                .toString(16)
                .padStart(64, '0'),
            key: smart_buffer_1.default.ofBase64String(data.data.key).bytes,
        };
    };
    MailerContract.prototype.decodeContentMessageBody = function (body) {
        var data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(MAILER_ABI), 'MailContent');
        if (!data) {
            throw new Error('ContentMessage format is not supported');
        }
        return {
            sender: data.data.sender,
            msgId: BigInt(data.data.msgId)
                .toString(16)
                .padStart(64, '0'),
            parts: Number(data.data.parts),
            partIdx: Number(data.data.partIdx),
            content: smart_buffer_1.default.ofBase64String(data.data.content).bytes,
        };
    };
    return MailerContract;
}());
exports.MailerContract = MailerContract;
var MAILER_ABI = {
    'ABI version': 2,
    'version': '2.2',
    'header': ['pubkey', 'time', 'expire'],
    'functions': [
        {
            name: 'constructor',
            inputs: [],
            outputs: [],
        },
        {
            name: 'setFees',
            inputs: [
                { name: '_contentPartFee', type: 'uint128' },
                { name: '_recipientFee', type: 'uint128' },
            ],
            outputs: [],
        },
        {
            name: 'setBeneficiary',
            inputs: [{ name: '_beneficiary', type: 'address' }],
            outputs: [],
        },
        {
            name: 'buildHash',
            inputs: [
                { name: 'pubkey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'time', type: 'uint32' },
            ],
            outputs: [{ name: '_hash', type: 'uint256' }],
        },
        {
            name: 'getMsgId',
            inputs: [
                { name: 'publicKey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'initTime', type: 'uint32' },
            ],
            outputs: [{ name: 'msgId', type: 'uint256' }],
        },
        {
            name: 'sendMultipartMailPart',
            inputs: [
                { name: 'publicKey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'initTime', type: 'uint32' },
                { name: 'parts', type: 'uint16' },
                { name: 'partIdx', type: 'uint16' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'addRecipients',
            inputs: [
                { name: 'publicKey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'initTime', type: 'uint32' },
                { name: 'recipients', type: 'address[]' },
                { name: 'keys', type: 'bytes[]' },
            ],
            outputs: [],
        },
        {
            name: 'sendSmallMail',
            inputs: [
                { name: 'publicKey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'recipient', type: 'address' },
                { name: 'key', type: 'bytes' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'sendBulkMail',
            inputs: [
                { name: 'publicKey', type: 'uint256' },
                { name: 'uniqueId', type: 'uint32' },
                { name: 'recipients', type: 'address[]' },
                { name: 'keys', type: 'bytes[]' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'transferOwnership',
            inputs: [{ name: 'newOwner', type: 'address' }],
            outputs: [],
        },
        {
            name: 'terminate',
            inputs: [],
            outputs: [],
        },
        {
            name: 'owner',
            inputs: [],
            outputs: [{ name: 'owner', type: 'address' }],
        },
        {
            name: 'contentPartFee',
            inputs: [],
            outputs: [{ name: 'contentPartFee', type: 'uint128' }],
        },
        {
            name: 'recipientFee',
            inputs: [],
            outputs: [{ name: 'recipientFee', type: 'uint128' }],
        },
        {
            name: 'beneficiary',
            inputs: [],
            outputs: [{ name: 'beneficiary', type: 'address' }],
        },
    ],
    'data': [
        { key: 1, name: 'owner', type: 'address' },
        { key: 2, name: 'beneficiary', type: 'address' },
    ],
    'events': [
        {
            name: 'MailPush',
            inputs: [
                { name: 'sender', type: 'address' },
                { name: 'msgId', type: 'uint256' },
                { name: 'key', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'MailContent',
            inputs: [
                { name: 'sender', type: 'address' },
                { name: 'msgId', type: 'uint256' },
                { name: 'parts', type: 'uint16' },
                { name: 'partIdx', type: 'uint16' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
    ],
    'fields': [
        { name: '_pubkey', type: 'uint256' },
        { name: '_timestamp', type: 'uint64' },
        { name: '_constructorFlag', type: 'bool' },
        { name: 'owner', type: 'address' },
        { name: 'contentPartFee', type: 'uint128' },
        { name: 'recipientFee', type: 'uint128' },
        { name: 'beneficiary', type: 'address' },
    ],
};
//# sourceMappingURL=MailerContract.js.map