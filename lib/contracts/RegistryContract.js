"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTRY_ABI = exports.RegistryContract = void 0;
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const misc_1 = require("../misc");
class RegistryContract {
    ever;
    contractAddress;
    contract;
    constructor(ever, contractAddress) {
        this.ever = ever;
        this.contractAddress = contractAddress;
        this.contract = new ever.Contract(exports.REGISTRY_ABI, new everscale_inpage_provider_1.Address(this.contractAddress));
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
}
exports.RegistryContract = RegistryContract;
exports.REGISTRY_ABI = {
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