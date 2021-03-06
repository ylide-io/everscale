"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EverscaleSendingController = void 0;
var everscale_inpage_provider_1 = require("everscale-inpage-provider");
var sdk_1 = require("@ylide/sdk");
var _1 = require(".");
var smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
var EverscaleSendingController = /** @class */ (function (_super) {
    __extends(EverscaleSendingController, _super);
    function EverscaleSendingController(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this, options) || this;
        _this.reader = new _1.EverscaleReadingController(options);
        return _this;
    }
    // wallet block
    EverscaleSendingController.isWalletAvailable = function () {
        return new everscale_inpage_provider_1.ProviderRpcClient().hasProvider();
    };
    EverscaleSendingController.walletType = function () {
        return 'everwallet';
    };
    EverscaleSendingController.blockchainType = function () {
        return 'everscale';
    };
    EverscaleSendingController.prototype.deriveMessagingKeypair = function (magicString) {
        return __awaiter(this, void 0, void 0, function () {
            var me, result, signatureBytes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAuthenticatedAccount()];
                    case 1:
                        me = _a.sent();
                        if (!me) {
                            throw new Error("Can't derive without auth");
                        }
                        return [4 /*yield*/, this.reader.ever.signData({
                                publicKey: me.publicKey,
                                data: smart_buffer_1.default.ofUTF8String(magicString).toBase64String(),
                            })];
                    case 2:
                        result = _a.sent();
                        signatureBytes = smart_buffer_1.default.ofHexString(result.signatureHex).bytes;
                        return [2 /*return*/, (0, sdk_1.sha256)(signatureBytes)];
                }
            });
        });
    };
    // account block
    EverscaleSendingController.prototype.getAuthenticatedAccount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var providerState;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.reader.ever.ensureInitialized()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.reader.ever.getProviderState()];
                    case 2:
                        providerState = _a.sent();
                        if (providerState.permissions.accountInteraction) {
                            return [2 /*return*/, {
                                    address: providerState.permissions.accountInteraction.address.toString(),
                                    publicKey: providerState.permissions.accountInteraction.publicKey,
                                }];
                        }
                        else {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    EverscaleSendingController.prototype.attachPublicKey = function (publicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var me;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAuthenticatedAccount()];
                    case 1:
                        me = _a.sent();
                        if (!me) {
                            throw new Error('Not authorized');
                        }
                        return [4 /*yield*/, this.reader.registryContract.attachPublicKey(me.address, publicKey)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EverscaleSendingController.prototype.requestAuthentication = function () {
        return __awaiter(this, void 0, void 0, function () {
            var accountInteraction;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.reader.ever.requestPermissions({
                            permissions: ['basic', 'accountInteraction'],
                        })];
                    case 1:
                        accountInteraction = (_a.sent()).accountInteraction;
                        if (accountInteraction) {
                            return [2 /*return*/, {
                                    address: accountInteraction.address.toString(),
                                    publicKey: accountInteraction.publicKey,
                                }];
                        }
                        else {
                            throw new Error('Not authenticated');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    EverscaleSendingController.prototype.disconnectAccount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.reader.ever.disconnect()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    EverscaleSendingController.prototype.publishMessage = function (me, publicKey, chunks, recipientKeys) {
        return __awaiter(this, void 0, void 0, function () {
            var uniqueId, transaction, om, contentMsg, decodedEvent, transaction, om, contentMsg, decodedEvent, initTime, msgId, i, i, recs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        uniqueId = Math.floor(Math.random() * 4 * Math.pow(10, 9));
                        if (!(chunks.length === 1 && recipientKeys.length === 1)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.reader.mailerContract.sendSmallMail(me.address, publicKey, uniqueId, recipientKeys[0].address, recipientKeys[0].key, chunks[0])];
                    case 1:
                        transaction = _a.sent();
                        om = transaction.childTransaction.outMessages;
                        contentMsg = om.length ? om[0] : null;
                        if (!contentMsg || !contentMsg.body) {
                            throw new Error('Content event was not found');
                        }
                        decodedEvent = this.reader.mailerContract.decodeContentMessageBody(contentMsg.body);
                        return [2 /*return*/, decodedEvent.msgId];
                    case 2:
                        if (!(chunks.length === 1 && recipientKeys.length < Math.ceil((15.5 * 1024 - chunks[0].byteLength) / 70))) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.reader.mailerContract.sendBulkMail(me.address, publicKey, uniqueId, recipientKeys.map(function (r) { return r.address; }), recipientKeys.map(function (r) { return r.key; }), chunks[0])];
                    case 3:
                        transaction = _a.sent();
                        om = transaction.childTransaction.outMessages;
                        contentMsg = om.length ? om[0] : null;
                        if (!contentMsg || !contentMsg.body) {
                            throw new Error('Content event was not found');
                        }
                        decodedEvent = this.reader.mailerContract.decodeContentMessageBody(contentMsg.body);
                        return [2 /*return*/, decodedEvent.msgId];
                    case 4:
                        initTime = Math.floor(Date.now() / 1000);
                        return [4 /*yield*/, this.reader.mailerContract.buildHash(publicKey, uniqueId, initTime)];
                    case 5:
                        msgId = _a.sent();
                        i = 0;
                        _a.label = 6;
                    case 6:
                        if (!(i < chunks.length)) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.reader.mailerContract.sendMultipartMailPart(me.address, publicKey, uniqueId, initTime, chunks.length, i, chunks[i])];
                    case 7:
                        _a.sent();
                        _a.label = 8;
                    case 8:
                        i++;
                        return [3 /*break*/, 6];
                    case 9:
                        i = 0;
                        _a.label = 10;
                    case 10:
                        if (!(i < recipientKeys.length)) return [3 /*break*/, 13];
                        recs = recipientKeys.slice(i, i + 210);
                        return [4 /*yield*/, this.reader.mailerContract.addRecipients(me.address, publicKey, uniqueId, initTime, recs.map(function (r) { return r.address; }), recs.map(function (r) { return r.key; }))];
                    case 11:
                        _a.sent();
                        _a.label = 12;
                    case 12:
                        i += 210;
                        return [3 /*break*/, 10];
                    case 13: return [2 /*return*/, msgId];
                }
            });
        });
    };
    // message send block
    EverscaleSendingController.prototype.sendMessage = function (serviceCode, keypair, content, recipients) {
        return __awaiter(this, void 0, void 0, function () {
            var me, _a, encryptedContent, key, chunks, recipientKeys;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getAuthenticatedAccount()];
                    case 1:
                        me = _b.sent();
                        if (!me) {
                            throw new Error('Not authorized');
                        }
                        _a = sdk_1.MessageContainer.encodeContent(content), encryptedContent = _a.content, key = _a.key;
                        chunks = sdk_1.MessageChunks.packContentInChunks(serviceCode, keypair.publicKey, encryptedContent, 10 * 1024);
                        recipientKeys = recipients.map(function (rec) {
                            return { address: rec.address, key: keypair.encrypt(key, rec.publicKey) };
                        });
                        return [2 /*return*/, this.publishMessage(me, keypair.publicKey, chunks, recipientKeys)];
                }
            });
        });
    };
    // message send block
    EverscaleSendingController.prototype.sendNativeMessage = function (serviceCode, encryptedContent, key, recipients) {
        return __awaiter(this, void 0, void 0, function () {
            var me, nativePublicKey, chunks, encryptedKeys, recipientKeys;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAuthenticatedAccount()];
                    case 1:
                        me = _a.sent();
                        if (!me) {
                            throw new Error('Not authorized');
                        }
                        nativePublicKey = smart_buffer_1.default.ofHexString(me.publicKey).bytes;
                        chunks = sdk_1.MessageChunks.packContentInChunks(serviceCode, nativePublicKey, encryptedContent, 15 * 1024, true);
                        return [4 /*yield*/, this.reader.ever.encryptData({
                                publicKey: me.publicKey,
                                recipientPublicKeys: recipients.map(function (r) { return r.publicKey; }),
                                algorithm: 'ChaCha20Poly1305',
                                data: new smart_buffer_1.default(key).toBase64String(),
                            })];
                    case 2:
                        encryptedKeys = _a.sent();
                        recipientKeys = recipients.map(function (rec, idx) {
                            var kkey = encryptedKeys[idx];
                            return {
                                address: rec.address,
                                key: (0, sdk_1.packSymmetricalyEncryptedData)(smart_buffer_1.default.ofBase64String(kkey.data).bytes, smart_buffer_1.default.ofBase64String(kkey.nonce).bytes),
                            };
                        });
                        return [2 /*return*/, this.publishMessage(me, nativePublicKey, chunks, recipientKeys)];
                }
            });
        });
    };
    return EverscaleSendingController;
}(sdk_1.AbstractSendingController));
exports.EverscaleSendingController = EverscaleSendingController;
//# sourceMappingURL=EverscaleSendingController.js.map