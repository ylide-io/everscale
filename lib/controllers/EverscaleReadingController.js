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
var __importDefault =
    (this && this.__importDefault) ||
    function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.EverscaleBlockchainController = void 0;
var smart_buffer_1 = __importDefault(require('@ylide/smart-buffer'));
var everscale_standalone_client_1 = require('everscale-standalone-client');
var core_1 = __importDefault(require('everscale-standalone-client/core'));
var everscale_inpage_provider_1 = require('everscale-inpage-provider');
var sdk_1 = require('@ylide/sdk');
var constants_1 = require('../misc/constants');
var contracts_1 = require('../contracts');
var misc_1 = require('../misc');
var GqlSender_1 = require('../misc/GqlSender');
var EverscaleBlockchainController = /** @class */ (function(_super) {
    __extends(EverscaleBlockchainController, _super);

    function EverscaleBlockchainController(options) {
        if (options === void 0) {
            options = {};
        }
        var _this = _super.call(this, options) || this;
        // gqlAddress: string;
        _this.MESSAGES_FETCH_LIMIT = 50;
        _this.mainnetEndpoints = [
            'eri01.main.everos.dev',
            'gra01.main.everos.dev',
            'gra02.main.everos.dev',
            'lim01.main.everos.dev',
            'rbx01.main.everos.dev',
        ];
        if (options.endpoints) {
            _this.gql = new GqlSender_1.GqlSender({
                endpoints: options.endpoints,
                local: false,
            });
        } else if (options.dev) {
            _this.gql = new GqlSender_1.GqlSender({
                endpoints: ['localhost'],
                local: true,
            });
        } else {
            _this.gql = new GqlSender_1.GqlSender({
                endpoints: _this.mainnetEndpoints,
                local: false,
            });
        }
        _this.ever = new everscale_inpage_provider_1.ProviderRpcClient({
            fallback: function() {
                return everscale_standalone_client_1.EverscaleStandaloneClient.create({
                    connection: options.dev ? 'local' : 'mainnet',
                });
            },
        });
        _this.mailerContract = new contracts_1.MailerContract(
            _this,
            options.mailerContractAddress ||
            (options.dev ? constants_1.DEV_MAILER_ADDRESS : constants_1.MAILER_ADDRESS),
        );
        _this.registryContract = new contracts_1.RegistryContract(
            _this,
            options.registryContractAddress ||
            (options.dev ? constants_1.DEV_REGISTRY_ADDRESS : constants_1.REGISTRY_ADDRESS),
        );
        return _this;
    }
    EverscaleBlockchainController.blockchainType = function() {
        return 'everscale';
    };
    EverscaleBlockchainController.prototype.getRecipientReadingRules = function(address) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                return [2 /*return*/ , []];
            });
        });
    };
    EverscaleBlockchainController.prototype.extractAddressFromPublicKey = function(publicKey) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                return [2 /*return*/ , this.registryContract.getAddressByPublicKey(publicKey)];
            });
        });
    };
    EverscaleBlockchainController.prototype.extractPublicKeyFromAddress = function(address) {
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                return [2 /*return*/ , this.registryContract.getPublicKeyByAddress(address)];
            });
        });
    };
    EverscaleBlockchainController.prototype.extractNativePublicKeyFromAddress = function(addressStr) {
        return __awaiter(this, void 0, void 0, function() {
            var nt, address, boc, pk;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        nt = core_1.default.nekoton;
                        return [4 /*yield*/ , core_1.default.ensureNekotonLoaded()];
                    case 1:
                        _a.sent();
                        address = new everscale_inpage_provider_1.Address(addressStr);
                        return [4 /*yield*/ , this.ever.getFullContractState({ address: address })];
                    case 2:
                        boc = _a.sent();
                        if (!boc.state) {
                            return [2 /*return*/ , null];
                        }
                        try {
                            pk = nt.extractPublicKey(boc.state.boc);
                            return [2 /*return*/ , pk ? smart_buffer_1.default.ofHexString(pk).bytes : null];
                        } catch (err) {
                            return [2 /*return*/ , null];
                        }
                        return [2 /*return*/ ];
                }
            });
        });
    };
    // message history block
    // Query messages by interval options.since (included) - options.to (excluded)
    EverscaleBlockchainController.prototype.retrieveMessageHistoryByDates = function(recipientAddress, options) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function() {
            var sinceDate, untilDate, fullMessages, _loop_1, this_1, state_1;
            var _this = this;
            return __generator(this, function(_d) {
                switch (_d.label) {
                    case 0:
                        return [4 /*yield*/ , core_1.default.ensureNekotonLoaded()];
                    case 1:
                        _d.sent();
                        sinceDate = (
                                (_a = options === null || options === void 0 ? void 0 : options.since) === null ||
                                _a === void 0 ?
                                void 0 :
                                _a.getTime()
                            ) ?
                            ((_b = options === null || options === void 0 ? void 0 : options.since) === null ||
                                _b === void 0 ?
                                void 0 :
                                _b.getTime()) - 1 :
                            null;
                        untilDate =
                            ((_c = options === null || options === void 0 ? void 0 : options.to) === null ||
                                _c === void 0 ?
                                void 0 :
                                _c.getTime()) || null;
                        fullMessages = [];
                        _loop_1 = function() {
                            var messages, foundDuplicate, _e, _f, _g;
                            return __generator(this, function(_h) {
                                switch (_h.label) {
                                    case 0:
                                        return [
                                            4 /*yield*/ ,
                                            this_1.queryMessagesList(recipientAddress, sinceDate, untilDate, {
                                                nextPageAfterMessage: options === null || options === void 0 ?
                                                    void 0 :
                                                    options.nextPageAfterMessage,
                                                messagesLimit: options === null || options === void 0 ?
                                                    void 0 :
                                                    options.messagesLimit,
                                            }),
                                        ];
                                    case 1:
                                        messages = _h.sent();
                                        if (!messages.length) return [2 /*return*/ , 'break'];
                                        foundDuplicate = false;
                                        _f = (_e = fullMessages.push).apply;
                                        _g = [fullMessages];
                                        return [
                                            4 /*yield*/ ,
                                            Promise.all(
                                                messages.map(function(m) {
                                                    return __awaiter(_this, void 0, void 0, function() {
                                                        var pushMessage, content;
                                                        return __generator(this, function(_a) {
                                                            switch (_a.label) {
                                                                case 0:
                                                                    if (
                                                                        m.id ===
                                                                        (options === null || options === void 0 ?
                                                                            void 0 :
                                                                            options.firstMessageIdToStopSearching)
                                                                    ) {
                                                                        foundDuplicate = true;
                                                                    }
                                                                    pushMessage = this.formatPushMessage(m);
                                                                    return [
                                                                        4 /*yield*/ ,
                                                                        this.retrieveMessageContentByMsgId(
                                                                            pushMessage.msgId,
                                                                        ),
                                                                    ];
                                                                case 1:
                                                                    content = _a.sent();
                                                                    if (content && !content.corrupted) {
                                                                        pushMessage.isContentLoaded = true;
                                                                        pushMessage.contentLink = content;
                                                                    }
                                                                    return [2 /*return*/ , pushMessage];
                                                            }
                                                        });
                                                    });
                                                }),
                                            ),
                                        ];
                                    case 2:
                                        _f.apply(_e, _g.concat([_h.sent()]));
                                        if (foundDuplicate) return [2 /*return*/ , 'break'];
                                        if (messages.length < this_1.MESSAGES_FETCH_LIMIT)
                                            return [2 /*return*/ , 'break'];
                                        untilDate = messages[0].created_at * 1000;
                                        return [2 /*return*/ ];
                                }
                            });
                        };
                        this_1 = this;
                        _d.label = 2;
                    case 2:
                        if (!true) return [3 /*break*/ , 4];
                        return [5 /*yield**/ , _loop_1()];
                    case 3:
                        state_1 = _d.sent();
                        if (state_1 === 'break') return [3 /*break*/ , 4];
                        return [3 /*break*/ , 2];
                    case 4:
                        return [2 /*return*/ , fullMessages];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.gqlQueryMessages = function(query, variables) {
        if (variables === void 0) {
            variables = {};
        }
        return __awaiter(this, void 0, void 0, function() {
            var data;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.gqlQuery(query, variables)];
                    case 1:
                        data = _a.sent();
                        if (!data ||
                            !data.data ||
                            !data.data.messages ||
                            !Array.isArray(data.data.messages) ||
                            !data.data.messages.length
                        ) {
                            return [2 /*return*/ , []];
                        }
                        return [2 /*return*/ , data.data.messages];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.gqlQuery = function(query, variables) {
        if (variables === void 0) {
            variables = {};
        }
        return __awaiter(this, void 0, void 0, function() {
            return __generator(this, function(_a) {
                return [
                    2 /*return*/ ,
                    this.gql.send(
                        JSON.stringify({
                            query: query,
                            variables: variables,
                        }),
                    ),
                ];
            });
        });
    };
    EverscaleBlockchainController.prototype.convertMsgIdToAddress = function(msgId) {
        return ':'.concat(msgId);
    };
    EverscaleBlockchainController.prototype.retrieveAndVerifyMessageContent = function(msg) {
        return __awaiter(this, void 0, void 0, function() {
            var result;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , this.retrieveMessageContentByMsgId(msg.msgId)];
                    case 1:
                        result = _a.sent();
                        if (!result) {
                            return [2 /*return*/ , null];
                        }
                        if (result.corrupted) {
                            return [2 /*return*/ , result];
                        }
                        if (result.senderAddress !== msg.senderAddress) {
                            return [
                                2 /*return*/ ,
                                {
                                    msgId: msg.msgId,
                                    corrupted: true,
                                    chunks: [],
                                    reason: sdk_1.MessageContentFailure.NON_INTEGRITY_PARTS,
                                },
                            ];
                        }
                        return [2 /*return*/ , result];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.retrieveMessageContentByMsgId = function(msgId) {
        return __awaiter(this, void 0, void 0, function() {
            var fakeAddress,
                messages,
                decodedChunks,
                parts,
                sender,
                _loop_2,
                idx,
                state_2,
                sortedChunks,
                contentSize,
                buf,
                _i,
                sortedChunks_1,
                chunk;
            var _this = this;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , core_1.default.ensureNekotonLoaded()];
                    case 1:
                        _a.sent();
                        fakeAddress = this.convertMsgIdToAddress(msgId);
                        return [
                            4 /*yield*/ ,
                            this.gqlQueryMessages(
                                (0, misc_1.getContractMessagesQuery)(fakeAddress, this.mailerContract.contractAddress), {},
                            ),
                        ];
                    case 2:
                        messages = _a.sent();
                        if (!messages.length) {
                            return [2 /*return*/ , null];
                        }
                        try {
                            decodedChunks = messages.map(function(m) {
                                return {
                                    msg: m,
                                    body: _this.mailerContract.decodeContentMessageBody(m.body),
                                };
                            });
                        } catch (err) {
                            return [
                                2 /*return*/ ,
                                {
                                    msgId: msgId,
                                    corrupted: true,
                                    chunks: messages.map(function(m) {
                                        return { createdAt: m.created_at };
                                    }),
                                    reason: sdk_1.MessageContentFailure.NON_DECRYPTABLE,
                                },
                            ];
                        }
                        parts = decodedChunks[0].body.parts;
                        sender = decodedChunks[0].body.sender;
                        if (!decodedChunks.every(function(t) {
                                return t.body.parts === parts;
                            }) ||
                            !decodedChunks.every(function(t) {
                                return t.body.sender === sender;
                            })
                        ) {
                            return [
                                2 /*return*/ ,
                                {
                                    msgId: msgId,
                                    corrupted: true,
                                    chunks: decodedChunks.map(function(m) {
                                        return { createdAt: m.msg.created_at };
                                    }),
                                    reason: sdk_1.MessageContentFailure.NON_INTEGRITY_PARTS,
                                },
                            ];
                        }
                        _loop_2 = function(idx) {
                            if (!decodedChunks.find(function(d) {
                                    return d.body.partIdx === idx;
                                })) {
                                return {
                                    value: {
                                        msgId: msgId,
                                        corrupted: true,
                                        chunks: decodedChunks.map(function(m) {
                                            return { createdAt: m.msg.created_at };
                                        }),
                                        reason: sdk_1.MessageContentFailure.NOT_ALL_PARTS,
                                    },
                                };
                            }
                        };
                        for (idx = 0; idx < parts; idx++) {
                            state_2 = _loop_2(idx);
                            if (typeof state_2 === 'object') return [2 /*return*/ , state_2.value];
                        }
                        if (decodedChunks.length !== parts) {
                            return [
                                2 /*return*/ ,
                                {
                                    msgId: msgId,
                                    corrupted: true,
                                    chunks: decodedChunks.map(function(m) {
                                        return { createdAt: m.msg.created_at };
                                    }),
                                    reason: sdk_1.MessageContentFailure.DOUBLED_PARTS,
                                },
                            ];
                        }
                        sortedChunks = decodedChunks
                            .sort(function(a, b) {
                                return a.body.partIdx - b.body.partIdx;
                            })
                            .map(function(m) {
                                return m.body.content;
                            });
                        contentSize = sortedChunks.reduce(function(p, c) {
                            return p + c.length;
                        }, 0);
                        buf = smart_buffer_1.default.ofSize(contentSize);
                        for (_i = 0, sortedChunks_1 = sortedChunks; _i < sortedChunks_1.length; _i++) {
                            chunk = sortedChunks_1[_i];
                            buf.writeBytes(chunk);
                        }
                        return [
                            2 /*return*/ ,
                            {
                                msgId: msgId,
                                corrupted: false,
                                storage: 'everscale',
                                createdAt: Math.min.apply(
                                    Math,
                                    decodedChunks.map(function(d) {
                                        return d.msg.created_at;
                                    }),
                                ),
                                senderAddress: sender,
                                parts: parts,
                                content: buf.bytes,
                            },
                        ];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.formatPushMessage = function(message) {
        var body = this.mailerContract.decodePushMessageBody(message.body);
        return {
            msgId: body.msgId,
            createdAt: message.created_at,
            senderAddress: body.sender,
            recipientAddress: message.dst.startsWith(':') ? '0'.concat(message.dst) : message.dst,
            blockchain: 'everscale',
            key: body.key,
            isContentLoaded: false,
            isContentDecrypted: false,
            contentLink: null,
            decryptedContent: null,
            blockchainMeta: message,
            userspaceMeta: null,
        };
    };
    EverscaleBlockchainController.prototype.decodeNativeKey = function(senderPublicKey, recipientPublicKey, key) {
        return __awaiter(this, void 0, void 0, function() {
            var _a, encData, nonce, decryptedText, e_1;
            return __generator(this, function(_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        (_a = (0, sdk_1.unpackSymmetricalyEncryptedData)(key)),
                        (encData = _a.encData),
                        (nonce = _a.nonce);
                        return [
                            4 /*yield*/ ,
                            this.ever.decryptData({
                                algorithm: 'ChaCha20Poly1305',
                                data: new smart_buffer_1.default(encData).toBase64String(),
                                nonce: new smart_buffer_1.default(nonce).toBase64String(),
                                recipientPublicKey: new smart_buffer_1.default(recipientPublicKey).toHexString(),
                                sourcePublicKey: new smart_buffer_1.default(senderPublicKey).toHexString(),
                            }),
                        ];
                    case 1:
                        decryptedText = _b.sent();
                        if (decryptedText) {
                            return [2 /*return*/ , smart_buffer_1.default.ofBase64String(decryptedText).bytes];
                        } else {
                            throw new Error('Error decrypting message text');
                        }
                        return [3 /*break*/ , 3];
                    case 2:
                        e_1 = _b.sent();
                        throw e_1;
                    case 3:
                        return [2 /*return*/ ];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.isAddressValid = function(address) {
        if (address.length !== 66) {
            return false;
        } else if (!address.includes(':')) {
            return false;
        }
        var splitAddress = address.split(':');
        if (splitAddress[0] !== '0') {
            return false;
        }
        if (splitAddress[1].includes('_')) return false;
        var regExp = new RegExp('^[^\\W]+$');
        return regExp.test(splitAddress[1]);
    };
    // Query messages by interval sinceDate(excluded) - untilDate (excluded)
    EverscaleBlockchainController.prototype.queryMessagesList = function(
        recipientAddress,
        sinceDate,
        untilDate,
        options,
    ) {
        var _a;
        return __awaiter(this, void 0, void 0, function() {
            var receiverAddress, addressValue, greaterThen, lessThen, createdAtString;
            return __generator(this, function(_b) {
                switch (_b.label) {
                    case 0:
                        receiverAddress = recipientAddress;
                        if (!receiverAddress) throw new Error('No receiver address');
                        addressValue = receiverAddress.slice(1);
                        greaterThen = sinceDate !== null ? 'gt: '.concat(sinceDate / 1000) : '';
                        lessThen = untilDate !== null ? ', lt: '.concat(untilDate / 1000) : '';
                        createdAtString = '{ '.concat(greaterThen).concat(lessThen, ' }');
                        return [
                            4 /*yield*/ ,
                            this.gqlQueryMessages(
                                '\n\t\tquery {\n\t\t\tmessages(\n\t\t\t  filter: {\n\t\t\t\tmsg_type: { eq: 2 },\n\t\t\t\tdst: { eq: "'
                                .concat(addressValue, '" },\n\t\t\t\tsrc: { eq: "')
                                .concat(this.mailerContract.contractAddress, '" },\n\t\t\t\tcreated_at: ')
                                .concat(createdAtString, '\n\t\t\t\tcreated_lt: { ')
                                .concat(
                                    (
                                        (_a =
                                            options === null || options === void 0 ?
                                            void 0 :
                                            options.nextPageAfterMessage) === null || _a === void 0 ?
                                        void 0 :
                                        _a.blockchainMeta.created_lt
                                    ) ?
                                    'lt: "'.concat(
                                        options.nextPageAfterMessage.blockchainMeta.created_lt,
                                        '"',
                                    ) :
                                    '',
                                    ' }\n\t\t\t  }\n\t\t\t  orderBy: [{path: "created_at", direction: DESC}]\n\t\t\t  limit: ',
                                )
                                .concat(
                                    (options === null || options === void 0 ? void 0 : options.messagesLimit) ||
                                    this.MESSAGES_FETCH_LIMIT,
                                    '\n\t\t\t) {\n\t\t\t  body\n\t\t\t  id\n\t\t\t  src\n\t\t\t  created_at\n\t\t\t  created_lt\n\t\t\t  dst\n\t\t\t}\n\t\t  }\n\t\t  ',
                                ),
                            ),
                        ];
                    case 1:
                        return [2 /*return*/ , _b.sent()];
                }
            });
        });
    };
    return EverscaleBlockchainController;
})(sdk_1.AbstractBlockchainController);
exports.EverscaleBlockchainController = EverscaleBlockchainController;
//# sourceMappingURL=EverscaleBlockchainController.js.map