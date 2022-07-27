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
exports.EverscaleBlockchainController = void 0;
var smart_buffer_1 = require('@ylide/smart-buffer');
var everscale_standalone_client_1 = require('everscale-standalone-client');
var core_1 = require('everscale-standalone-client/core');
var everscale_inpage_provider_1 = require('everscale-inpage-provider');
var sdk_1 = require('@ylide/sdk');
var EverscaleContract_1 = require('./EverscaleContract');
var RegistryContract_1 = require('./RegistryContract');
var MailerContract_1 = require('./MailerContract');
var EverscaleBlockchainController = /** @class */ (function(_super) {
    __extends(EverscaleBlockchainController, _super);

    function EverscaleBlockchainController(props) {
        if (props === void 0) {
            props = {
                address: EverscaleContract_1.CONTRACT_ADDRESS,
                abi: EverscaleContract_1.CONTRACT_ABI,
                dev: false,
            };
        }
        var _this = _super.call(this, props) || this;
        _this.MESSAGES_FETCH_LIMIT = 50;
        if (props.dev) {
            _this.gqlAddress = 'http://localhost/graphql';
        } else {
            _this.gqlAddress = 'https://eri01.main.everos.dev/graphql';
        }
        _this.ever = new everscale_inpage_provider_1.ProviderRpcClient({
            fallback: function() {
                return everscale_standalone_client_1.EverscaleStandaloneClient.create({
                    connection: 'local',
                });
            },
        });
        _this.mailerContract = new MailerContract_1.MailerContract(_this, props.dev);
        _this.registryContract = new RegistryContract_1.RegistryContract(_this, props.dev);
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
                            var queryResults, messages, foundDuplicate, _e, _f, _g;
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
                                        queryResults = _h.sent();
                                        messages = queryResults.data.messages;
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
                                                                    console.log('push tx: ', m);
                                                                    pushMessage = this.formatPushMessage(m);
                                                                    return [
                                                                        4 /*yield*/ ,
                                                                        this.retrieveMessageContentByMsgId(
                                                                            pushMessage.msgId,
                                                                        ),
                                                                    ];
                                                                case 1:
                                                                    content = _a.sent();
                                                                    console.log('got content: ', content);
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
    EverscaleBlockchainController.prototype.gqlQuery = function(query, variables) {
        return __awaiter(this, void 0, void 0, function() {
            var response;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [
                            4 /*yield*/ ,
                            fetch(this.gqlAddress, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                },
                                body: JSON.stringify({
                                    query: query,
                                    variables: variables,
                                }),
                            }),
                        ];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/ , response.json()];
                    case 2:
                        return [2 /*return*/ , _a.sent()];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.convertMsgIdToAddress = function(msgId) {
        return ':'.concat(msgId);
    };
    EverscaleBlockchainController.prototype.retrieveMessageContentByMsgId = function(msgId) {
        return __awaiter(this, void 0, void 0, function() {
            var fakeAddress, data;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        return [4 /*yield*/ , core_1.default.ensureNekotonLoaded()];
                    case 1:
                        _a.sent();
                        fakeAddress = this.convertMsgIdToAddress(msgId);
                        console.log('fakeAddress: ', fakeAddress);
                        return [
                            4 /*yield*/ ,
                            this.gqlQuery(
                                '\n\t\t  query {\n\t\t\tmessages(\n\t\t\t  filter: {\n\t\t\t\tmsg_type: { eq: 2 },\n\t\t\t\tdst: { eq: "'
                                .concat(fakeAddress, '" },\n\t\t\t\tsrc: { eq: "')
                                .concat(
                                    EverscaleContract_1.DEV_CONTRACT_ADDRESS,
                                    '" },\n\t\t\t  }\n\t\t\t) {\n\t\t\t  body\n\t\t\t  id\n\t\t\t  src\n\t\t\t  created_at\n\t\t\t  created_lt\n\t\t\t  dst\n\t\t\t}\n\t\t  }',
                                ), {},
                            ),
                        ];
                    case 2:
                        data = _a.sent();
                        console.log('retrieveMessageContentByMsgId data: ', data);
                        return [2 /*return*/ , null];
                }
            });
        });
    };
    EverscaleBlockchainController.prototype.formatPushMessage = function(message) {
        var body = this.decodePushMessageBody(message.body);
        return {
            msgId: body.msgId,
            createdAt: message.created_at,
            senderAddress: body.sender,
            recipientAddress: message.dst,
            blockchain: 'everscale',
            isContentLoaded: false,
            isContentDecrypted: false,
            contentLink: null,
            decryptedContent: null,
            blockchainMeta: message,
            userspaceMeta: null,
        };
    };
    EverscaleBlockchainController.prototype.decodePushMessageBody = function(body) {
        var data = core_1.default.nekoton.decodeEvent(
            body,
            JSON.stringify(EverscaleContract_1.CONTRACT_ABI),
            'MailPush',
        );
        if (!data) {
            throw new Error('PushMessage format is not supported');
        }
        console.log('decoded push event data: ', data);
        return {
            sender: data.data.sender,
            msgId: BigInt(data.data.msgId).toString(16).padStart(64, '0'),
            key: smart_buffer_1.default.ofBase64String(data.data.key).bytes,
        };
    };
    EverscaleBlockchainController.prototype.decodeContentMessageBody = function(body) {
        var data = core_1.default.nekoton.decodeEvent(
            body,
            JSON.stringify(EverscaleContract_1.CONTRACT_ABI),
            'MailContent',
        );
        if (!data) {
            throw new Error('ContentMessage format is not supported');
        }
        console.log('decoded content event data: ', data);
        return {
            sender: data.data.sender,
            msgId: BigInt(data.data.msgId).toString(16).padStart(64, '0'),
            parts: data.data.parts,
            partIdx: data.data.partIdx,
            content: smart_buffer_1.default.ofBase64String(data.data.content).bytes,
        };
    };
    EverscaleBlockchainController.prototype.decodeMailText = function(senderAddress, recipient, data, nonce) {
        return __awaiter(this, void 0, void 0, function() {
            var senderPublicKey, decryptedText, e_1;
            return __generator(this, function(_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/ , this.extractPublicKeyFromAddress(senderAddress)];
                    case 1:
                        senderPublicKey = _a.sent();
                        if (!senderPublicKey) {
                            throw new Error('Error decrypting message text: no sender public key found');
                        }
                        return [
                            4 /*yield*/ ,
                            this.ever.decryptData({
                                algorithm: 'ChaCha20Poly1305',
                                data: data,
                                nonce: nonce,
                                recipientPublicKey: recipient.publicKey,
                                sourcePublicKey: new smart_buffer_1.default(senderPublicKey).toHexString(),
                            }),
                        ];
                    case 2:
                        decryptedText = _a.sent();
                        if (decryptedText) {
                            return [2 /*return*/ , Buffer.from(decryptedText, 'base64').toString('utf8')];
                        } else {
                            throw new Error('Error decrypting message text');
                        }
                        return [3 /*break*/ , 4];
                    case 3:
                        e_1 = _a.sent();
                        throw e_1;
                    case 4:
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
                            this.gqlQuery(
                                '\n\t\tquery {\n\t\t\tmessages(\n\t\t\t  filter: {\n\t\t\t\tmsg_type: { eq: 2 },\n\t\t\t\tdst: { eq: "'
                                .concat(addressValue, '" },\n\t\t\t\tsrc: { eq: "')
                                .concat(EverscaleContract_1.DEV_CONTRACT_ADDRESS, '" },\n\t\t\t\tcreated_at: ')
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
                                ), {},
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