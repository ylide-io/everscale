"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistryContract = void 0;
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const core_1 = __importDefault(require("everscale-standalone-client/core"));
const misc_1 = require("../misc");
class RegistryContract {
    blockchainController;
    contractAddress;
    contract;
    constructor(blockchainController, contractAddress) {
        this.blockchainController = blockchainController;
        this.contractAddress = contractAddress;
        this.contract = new blockchainController.ever.Contract(REGISTRY_ABI, new everscale_inpage_provider_1.Address(this.contractAddress));
    }
    async getPublicKeyByAddress(address) {
        await core_1.default.ensureNekotonLoaded();
        const messages = await this.blockchainController.gqlQueryMessages((0, misc_1.getContractMessagesQuery)(address, this.contractAddress));
        console.log(`pk ${address} messages: `, messages);
        if (messages.length) {
            return this.decodeAddressToPublicKeyMessageBody(messages[0].body);
        }
        else {
            return null;
        }
    }
    async attachPublicKey(address, publicKey) {
        const result = await this.contract.methods
            // @ts-ignore
            .attachPublicKey({ publicKey: (0, misc_1.publicKeyToBigIntString)(publicKey) })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
        return true;
    }
    decodeAddressToPublicKeyMessageBody(body) {
        const data = core_1.default.nekoton.decodeEvent(body, JSON.stringify(REGISTRY_ABI), 'AddressToPublicKey');
        if (!data) {
            throw new Error('AddressToPublicKeyMessage format is not supported');
        }
        return smart_buffer_1.default.ofHexString(BigInt(data.data.publicKey)
            .toString(16)
            .padStart(64, '0')).bytes;
    }
}
exports.RegistryContract = RegistryContract;
const REGISTRY_ABI = {
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