"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVERSCALE_MAINNET = exports.EVERSCALE_LOCAL = void 0;
const _1 = require(".");
exports.EVERSCALE_LOCAL = {
    registryContracts: [
        {
            id: 1,
            type: _1.TVMRegistryContractType.TVMRegistryV1,
            address: '0:3273912b3960d7b8b866dfe22ce7bdd3f599ae973f97cc8b1b5e94e47274ee2e',
            verified: true,
        },
    ],
    mailerContracts: [
        {
            id: 2,
            type: _1.TVMMailerContractType.TVMMailerV5,
            address: '0:fbdcae5d0ebb3ce98d31f4b554e6493c9d1d5e1f6acbea1f58488e3e1b2c42da',
            verified: true,
        },
    ],
    broadcasterContracts: [
        {
            id: 3,
            type: _1.TVMMailerContractType.TVMMailerV5,
            address: '0:0263d12284a98e4ebcc95e7ed3a5f6c6611da2e101320e5a0f554d2de7a5cba8',
            verified: true,
        },
    ],
    currentRegistryId: 1,
    currentMailerId: 2,
    currentBroadcasterId: 3,
};
exports.EVERSCALE_MAINNET = {
    registryContracts: [
        {
            id: 4,
            type: _1.TVMRegistryContractType.TVMRegistryV1,
            address: '0:c68ec196b86fe001c3762e454991b460e115862f64a9f929591557e00fb0cb3a',
            verified: true,
        },
    ],
    mailerContracts: [
        {
            id: 5,
            type: _1.TVMMailerContractType.TVMMailerV5,
            address: '0:a06a244f2632aaff3573e2fa45283fc67e3ad8a11bcba62b060fe9b60c36a0c9',
            verified: true,
        },
    ],
    broadcasterContracts: [
        {
            id: 6,
            type: _1.TVMMailerContractType.TVMMailerV5,
            address: '0:38eaf0a6482ebdc4e1d8f7d7addabbecf14b134d23144971595552630e653f5b',
            verified: true,
        },
    ],
    currentRegistryId: 4,
    currentMailerId: 5,
    currentBroadcasterId: 6,
};
//# sourceMappingURL=constants.js.map