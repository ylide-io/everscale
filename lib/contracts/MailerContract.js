"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAILER_ABI = exports.MailerContract = void 0;
const sdk_1 = require("@ylide/sdk");
const smart_buffer_1 = __importDefault(require("@ylide/smart-buffer"));
const everscale_inpage_provider_1 = require("everscale-inpage-provider");
const misc_1 = require("../misc");
class MailerContract {
    ever;
    contractAddress;
    contract;
    constructor(ever, contractAddress) {
        this.ever = ever;
        this.contractAddress = contractAddress;
        this.contract = new ever.Contract(exports.MAILER_ABI, new everscale_inpage_provider_1.Address(this.contractAddress));
    }
    async buildHash(pubkey, uniqueId, time) {
        const args = {
            pubkey: (0, misc_1.publicKeyToBigIntString)(pubkey),
            uniqueId,
            time,
        };
        // @ts-ignore
        const result = await this.contract.methods.buildHash(args).call();
        return (0, sdk_1.bigIntToUint256)(BigInt(result._hash).toString(10));
    }
    async setFees(address, _contentPartFee, _recipientFee) {
        return await this.contract.methods
            // @ts-ignore
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
        });
    }
    async transferOwnership(address, newOwner) {
        return await this.contract.methods
            // @ts-ignore
            .transferOwnership({
            // @ts-ignore
            newOwner,
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '200000000',
            bounce: false,
        });
    }
    async setBeneficiary(address, _beneficiary) {
        return await this.contract.methods
            // @ts-ignore
            .setBeneficiary({
            // @ts-ignore
            _beneficiary,
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '200000000',
            bounce: false,
        });
    }
    async addRecipients(address, uniqueId, initTime, recipients, keys) {
        // uint256 publicKey, uint32 uniqueId, uint32 initTime, address[] recipients, bytes[] keys
        return await this.contract.methods
            // @ts-ignore
            .addRecipients({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            initTime,
            // @ts-ignore
            recipients: recipients.map(r => (0, misc_1.uint256ToAddress)(r)),
            // @ts-ignore
            keys: keys.map(k => new smart_buffer_1.default(k).toBase64String()),
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
    async sendMultipartMailPart(address, uniqueId, initTime, parts, partIdx, content) {
        return await this.contract.methods
            // @ts-ignore
            .sendMultipartMailPart({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            initTime,
            // @ts-ignore
            parts,
            // @ts-ignore
            partIdx,
            // @ts-ignore
            content: new smart_buffer_1.default(content).toBase64String(),
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
    async broadcastMail(address, uniqueId, content) {
        return await this.contract.methods
            // @ts-ignore
            .broadcastMail({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            content: new smart_buffer_1.default(content).toBase64String(),
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
    async broadcastMailHeader(address, uniqueId, initTime) {
        return await this.contract.methods
            // @ts-ignore
            .broadcastMail({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            initTime,
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
    async sendSmallMail(address, uniqueId, recipient, key, content) {
        return await this.contract.methods
            // @ts-ignore
            .sendSmallMail({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            recipient: (0, misc_1.uint256ToAddress)(recipient),
            // @ts-ignore
            key: new smart_buffer_1.default(key).toBase64String(),
            // @ts-ignore
            content: new smart_buffer_1.default(content).toBase64String(),
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
    async sendBulkMail(address, uniqueId, recipients, keys, content) {
        return await this.contract.methods
            // @ts-ignore
            .sendBulkMail({
            // @ts-ignore
            uniqueId,
            // @ts-ignore
            recipients: recipients.map(r => (0, misc_1.uint256ToAddress)(r)),
            // @ts-ignore
            keys: keys.map(k => new smart_buffer_1.default(k).toBase64String()),
            // @ts-ignore
            content: new smart_buffer_1.default(content).toBase64String(),
        })
            .sendWithResult({
            from: new everscale_inpage_provider_1.Address(address),
            amount: '1000000000',
            bounce: false,
        });
    }
}
exports.MailerContract = MailerContract;
exports.MAILER_ABI = {
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
                { name: 'uniqueId', type: 'uint32' },
                { name: 'recipients', type: 'address[]' },
                { name: 'keys', type: 'bytes[]' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'broadcastMail',
            inputs: [
                { name: 'uniqueId', type: 'uint32' },
                { name: 'content', type: 'bytes' },
            ],
            outputs: [],
        },
        {
            name: 'broadcastMailHeader',
            inputs: [
                { name: 'uniqueId', type: 'uint32' },
                { name: 'initTime', type: 'uint32' },
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
        {
            name: 'MailBroadcast',
            inputs: [{ name: 'msgId', type: 'uint256' }],
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