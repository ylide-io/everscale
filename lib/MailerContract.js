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
var EverscaleContract_1 = require("./EverscaleContract");
var utils_1 = require("./utils");
var MailerContract = /** @class */ (function () {
    function MailerContract(reader, isDev) {
        this.contract = new reader.ever.Contract(EverscaleContract_1.CONTRACT_ABI, new everscale_inpage_provider_1.Address(isDev ? EverscaleContract_1.DEV_CONTRACT_ADDRESS : EverscaleContract_1.CONTRACT_ADDRESS));
    }
    MailerContract.prototype.getMsgId = function (publicKey, uniqueId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, msgId, initTime;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            //@ts-ignore
                            .getMsgId({ publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey), uniqueId: uniqueId })
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
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            initTime: initTime,
                            //@ts-ignore
                            parts: parts,
                            //@ts-ignore
                            partIdx: partIdx,
                            //@ts-ignore
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
                            //@ts-ignore
                            .sendSmallMail({
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            recipient: recipient,
                            //@ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            //@ts-ignore
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
                            //@ts-ignore
                            .sendSmallMail0({
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            recipient: recipient,
                            //@ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            //@ts-ignore
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
                            //@ts-ignore
                            .sendSmallMail1({
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            recipient: recipient,
                            //@ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            //@ts-ignore
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
                            //@ts-ignore
                            .sendSmallMail2({
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            recipient: recipient,
                            //@ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            //@ts-ignore
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
                            //@ts-ignore
                            .sendSmallMail4({
                            //@ts-ignore
                            publicKey: (0, utils_1.publicKeyToBigIntString)(publicKey),
                            //@ts-ignore
                            uniqueId: uniqueId,
                            //@ts-ignore
                            recipient: recipient,
                            //@ts-ignore
                            key: new smart_buffer_1.default(key).toBase64String(),
                            //@ts-ignore
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
                            //@ts-ignore
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
    return MailerContract;
}());
exports.MailerContract = MailerContract;
//# sourceMappingURL=MailerContract.js.map