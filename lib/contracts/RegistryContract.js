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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistryContract = void 0;
var smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
var everscale_inpage_provider_1 = require("everscale-inpage-provider");
var core_1 = __importDefault(require("everscale-standalone-client/core"));
var misc_1 = require("../misc");
var RegistryContract = /** @class */ (function () {
    function RegistryContract(blockchainController, contractAddress) {
        this.blockchainController = blockchainController;
        this.contractAddress = contractAddress;
        this.contract = new blockchainController.ever.Contract(REGISTRY_ABI, new everscale_inpage_provider_1.Address(this.contractAddress));
    }
    RegistryContract.prototype.getPublicKeyByAddress = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var messages;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, core_1.default.ensureNekotonLoaded()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.blockchainController.gqlQueryMessages((0, misc_1.getContractMessagesQuery)(address, this.contractAddress))];
                    case 2:
                        messages = _a.sent();
                        console.log("pk ".concat(address, " messages: "), messages);
                        if (messages.length) {
                            return [2 /*return*/, this.decodeAddressToPublicKeyMessageBody(messages[0].body)];
                        }
                        else {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    RegistryContract.prototype.attachPublicKey = function (address, publicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.contract.methods
                            // @ts-ignore
                            .attachPublicKey({ publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey) })
                            .sendWithResult({
                            from: new everscale_inpage_provider_1.Address(address),
                            amount: '1000000000',
                            bounce: false,
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    RegistryContract.prototype.decodeAddressToPublicKeyMessageBody = function (body) {
        var data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(REGISTRY_ABI), 'AddressToPublicKey');
        if (!data) {
            throw new Error('AddressToPublicKeyMessage format is not supported');
        }
        return smart_buffer_1.default.ofHexString(BigInt(data.data.publicKey)
            .toString(16)
            .padStart(64, '0')).bytes;
    };
    return RegistryContract;
}());
exports.RegistryContract = RegistryContract;
var REGISTRY_ABI = {
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
            name: 'attachPublicKey',
            inputs: [{ name: 'publicKey', type: 'uint256' }],
            outputs: [],
        },
        {
            name: 'attachAddress',
            inputs: [{ name: 'publicKey', type: 'uint256' }],
            outputs: [],
        },
    ],
    'data': [],
    'events': [
        {
            name: 'PublicKeyToAddress',
            inputs: [{ name: 'addr', type: 'address' }],
            outputs: [],
        },
        {
            name: 'AddressToPublicKey',
            inputs: [{ name: 'publicKey', type: 'uint256' }],
            outputs: [],
        },
    ],
    'fields': [
        { name: '_pubkey', type: 'uint256' },
        { name: '_timestamp', type: 'uint64' },
        { name: '_constructorFlag', type: 'bool' },
    ],
};
//# sourceMappingURL=RegistryContract.js.map