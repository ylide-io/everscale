'use strict';
var __extends =
    (this && this.__extends) ||
    (function() {
        var extendStatics = function(d, b) {
            extendStatics =
                Object.setPrototypeOf ||
                ({ __proto__: [] }
                    instanceof Array &&
                    function(d, b) {
                        d.__proto__ = b;
                    }) ||
                function(d, b) {
                    for (var p in b)
                        if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
                };
            return extendStatics(d, b);
        };
        return function(d, b) {
            if (typeof b !== 'function' && b !== null)
                throw new TypeError('Class extends value ' + String(b) + ' is not a constructor or null');
            extendStatics(d, b);

            function __() {
                this.constructor = d;
            }
            d.prototype = b === null ? Object.create(b) : ((__.prototype = b.prototype), new __());
        };
    })();
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P ?
                value :
                new P(function(resolve) {
                    resolve(value);
                });
        }
        return new(P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }

            function rejected(value) {
                try {
                    step(generator['throw'](value));
                } catch (e) {
                    reject(e);
                }
            }

            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
var __generator =
    (this && this.__generator) ||
    function(thisArg, body) {
        var _ = {
                label: 0,
                sent: function() {
                    if (t[0] & 1) throw t[1];
                    return t[1];
                },
                trys: [],
                ops: [],
            },
            f,
            y,
            t,
            g;
        return (
            (g = { next: verb(0), throw: verb(1), return: verb(2) }),
            typeof Symbol === 'function' &&
            (g[Symbol.iterator] = function() {
                return this;
            }),
            g
        );

        function verb(n) {
            return function(v) {
                return step([n, v]);
            };
        }

        function step(op) {
            if (f) throw new TypeError('Generator is already executing.');
            while (_)
                try {
                    if (
                        ((f = 1),
                            y &&
                            (t =
                                op[0] & 2 ?
                                y['return'] :
                                op[0] ?
                                y['throw'] || ((t = y['return']) && t.call(y), 0) :
                                y.next) &&
                            !(t = t.call(y, op[1])).done)
                    )
                        return t;
                    if (((y = 0), t)) op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (!((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                                (op[0] === 6 || op[0] === 2)
                            ) {
                                _ = 0;
                                continue;
                            }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2]) _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                } catch (e) {
                    op = [6, e];
                    y = 0;
                } finally {
                    f = t = 0;
                }
            if (op[0] & 5) throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.EverscaleWalletController = void 0;
var everscale_inpage_provider_1 = require('everscale-inpage-provider');
var sdk_1 = require('@ylide/sdk');
var EverscaleContract_1 = require('./EverscaleContract');
var _1 = require('.');
var smart_buffer_1 = require('@ylide/smart-buffer');
var EverscaleWalletController = /** @class */ (function(_super) {
    __extends(EverscaleWalletController, _super);

    function EverscaleWalletController(props) {
        if (props === void 0) {
            props = {
                address: EverscaleContract_1.CONTRACT_ADDRESS,
                abi: EverscaleContract_1.CONTRACT_ABI,
                dev: false,
            };
        }
        var _this = _super.call(this, props) || this;
        _this.blockchainController = new _1.EverscaleBlockchainController(props);
        return _this;
    }
    // wallet block
    EverscaleWalletController.isWalletAvailable = function() {
        return new everscale_inpage_provider_1.ProviderRpcClient().hasProvider();
    };
    EverscaleWalletController.walletType = function() {
        return 'inpage-provider';
    };
    EverscaleWalletController.blockchainType = function() {
        return 'everscale';
    };
    EverscaleWalletController.prototype.deriveMessagingKeypair = function(magicString) {
        return __awaiter(this, void 0, void 0, function() {
            var me, result, signatureBytes;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.getAuthenticatedAccount()];
                    case 1:
                        me = _a.sent();
                        if (!me) {
                            throw new Error("Can't derive without auth");
                        }
                        return [
                            4 /*yield*/ ,
                            this.blockchainController.ever.signData({
                                publicKey: me.publicKey,
                                data: smart_buffer_1.default.ofUTF8String(magicString).toBase64String(),
                            }),
                        ];
                    case 2:
                        result = _a.sent();
                        signatureBytes = smart_buffer_1.default.ofHexString(result.signatureHex).bytes;
                        return [2 /*return*/ , (0, sdk_1.sha256)(signatureBytes)];
                }
            });
        });
    };
    // account block
    EverscaleWalletController.prototype.getAuthenticatedAccount = function() {
        return __awaiter(this, void 0, void 0, function() {
            var providerState;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.blockchainController.ever.ensureInitialized()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/ , this.blockchainController.ever.getProviderState()];
                    case 2:
                        providerState = _a.sent();
                        if (providerState.permissions.accountInteraction) {
                            return [
                                2 /*return*/ ,
                                {
                                    address: providerState.permissions.accountInteraction.address.toString(),
                                    publicKey: providerState.permissions.accountInteraction.publicKey,
                                },
                            ];
                        } else {
                            return [2 /*return*/ , null];
                        }
                        return [2 /*return*/ ];
                }
            });
        });
    };
    EverscaleWalletController.prototype.attachPublicKey = function(publicKey) {
        return __awaiter(this, void 0, void 0, function() {
            var me;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.getAuthenticatedAccount()];
                    case 1:
                        me = _a.sent();
                        if (!me) {
                            throw new Error('Not authorized');
                        }
                        return [
                            4 /*yield*/ ,
                            this.blockchainController.registryContract.attachPublicKey(me.address, publicKey),
                        ];
                    case 2:
                        _a.sent();
                        return [2 /*return*/ ];
                }
            });
        });
    };
    EverscaleWalletController.prototype.requestAuthentication = function() {
        return __awaiter(this, void 0, void 0, function() {
            var accountInteraction;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [
                            4 /*yield*/ ,
                            this.blockchainController.ever.requestPermissions({
                                permissions: ['basic', 'accountInteraction'],
                            }),
                        ];
                    case 1:
                        accountInteraction = _a.sent().accountInteraction;
                        if (accountInteraction) {
                            return [
                                2 /*return*/ ,
                                {
                                    address: accountInteraction.address.toString(),
                                    publicKey: accountInteraction.publicKey,
                                },
                            ];
                        } else {
                            throw new Error('Not authenticated');
                        }
                        return [2 /*return*/ ];
                }
            });
        });
    };
    EverscaleWalletController.prototype.disconnectAccount = function() {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.blockchainController.ever.disconnect()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/ ];
                }
            });
        });
    };
    // message send block
    EverscaleWalletController.prototype.sendMessage = function(serviceCode, keypair, content, recipients) {
        return __awaiter(this, void 0, void 0, function() {
            var me, _a, encryptedContent, key, chunks, recipientKeys, uniqueId, transaction;
            return __generator(this, function(_b) {
                switch (_b.label) {
                    case 0:
                        return [4 /*yield*/ , this.getAuthenticatedAccount()];
                    case 1:
                        me = _b.sent();
                        if (!me) {
                            throw new Error('Not authorized');
                        }
                        (_a = sdk_1.MessageContainer.encodeContent(content)),
                        (encryptedContent = _a.content),
                        (key = _a.key);
                        chunks = sdk_1.MessageChunks.packContentInChunks(
                            serviceCode,
                            keypair.publicKey,
                            encryptedContent,
                        );
                        recipientKeys = recipients.map(function(rec) {
                            return { address: rec.address, key: keypair.encrypt(key, rec.publicKey) };
                        });
                        uniqueId = Math.floor(Math.random() * 4 * Math.pow(10, 9));
                        if (!(chunks.length === 1 && recipientKeys.length === 1)) return [3 /*break*/ , 3];
                        return [
                            4 /*yield*/ ,
                            this.blockchainController.mailerContract.sendSmallMail(
                                me.address,
                                keypair.publicKey,
                                uniqueId,
                                recipientKeys[0].address,
                                recipientKeys[0].key,
                                chunks[0],
                            ),
                        ];
                    case 2:
                        transaction = _b.sent();
                        console.log('transaction: ', transaction);
                        return [3 /*break*/ , 4];
                    case 3:
                        throw new Error('Multisending is not supported for now');
                    case 4:
                        // if (transaction && transaction.childTransaction) {
                        // 	const ct = transaction.childTransaction;
                        // 	if (ct.outMessages && ct.outMessages[0]) {
                        // 		const o = ct.outMessages[0];
                        // 		if (o.value === '0' && o.src._address === this.contract!.address.toString()) {
                        // 			return o.hash;
                        // 		}
                        // 	}
                        // }
                        return [2 /*return*/ , null];
                }
            });
        });
    };
    return EverscaleWalletController;
})(sdk_1.AbstractWalletController);
exports.EverscaleWalletController = EverscaleWalletController;
//# sourceMappingURL=EverscaleWalletController.js.map