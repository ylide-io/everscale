"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_CONTRACT_ABI = exports.CONTRACT_ABI = exports.CONTRACT_ADDRESS = exports.DEV_CONTRACT_ADDRESS = void 0;
exports.DEV_CONTRACT_ADDRESS = '0:323205efc522377da7714285c4a15b75017a3052a81faac7e87045aad204b803';
exports.CONTRACT_ADDRESS = '0:b40bf3e285b82dba93b320cc15823ef01fb200d334d09d134f2414a6c95a8ead';
exports.CONTRACT_ABI = {
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
            name: 'getAddressByPublicKey',
            inputs: [{ name: 'publicKey', type: 'uint256' }],
            outputs: [{ name: 'addr', type: 'address' }],
        },
        {
            name: 'getPublicKeyByAddress',
            inputs: [{ name: 'addr', type: 'address' }],
            outputs: [{ name: 'publicKey', type: 'uint256' }],
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
            ],
            outputs: [
                { name: 'msgId', type: 'uint256' },
                { name: 'initTime', type: 'uint32' },
            ],
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
            name: 'sendSmallMail0',
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
            name: 'sendSmallMail4',
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
            name: 'sendSmallMail1',
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
            name: 'sendSmallMail2',
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
            name: 'addressToPublicKey',
            inputs: [],
            outputs: [{ name: 'addressToPublicKey', type: 'map(address,uint256)' }],
        },
        {
            name: 'publicKeyToAddress',
            inputs: [],
            outputs: [{ name: 'publicKeyToAddress', type: 'map(uint256,address)' }],
        },
    ],
    'data': [],
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
        { name: 'addressToPublicKey', type: 'map(address,uint256)' },
        { name: 'publicKeyToAddress', type: 'map(uint256,address)' },
    ],
};
exports.DEV_CONTRACT_ABI = exports.CONTRACT_ABI;
//# sourceMappingURL=EverscaleContract.js.map