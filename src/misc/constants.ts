import { ITVMNetworkContracts, TVMMailerContractType, TVMRegistryContractType } from './types';

export const EVERSCALE_LOCAL: ITVMNetworkContracts = {
	registryContracts: [
		{
			id: 1,
			type: TVMRegistryContractType.TVMRegistryV2,
			address: '0:6c85e7f93eb3d47dc365919e647eb5dd91b68527aa5bb318e9feaaf3dedf72f1',
			verified: true,
		},
	],
	mailerContracts: [
		{
			id: 2,
			type: TVMMailerContractType.TVMMailerV6,
			address: '0:c8349fd9e5f8e5047d2ad62ac5a453f6c88e4b1f45fdc160984f3c54500897e7',
			verified: true,
		},
	],
	broadcasterContracts: [
		{
			id: 3,
			type: TVMMailerContractType.TVMMailerV6,
			address: '0:17a1f159bbffd26a5de14f4b32bb6215f0c5c746ed04be8d353e7a41a56d7b0a',
			verified: true,
		},
	],
	currentRegistryId: 1,
	currentMailerId: 2,
	currentBroadcasterId: 3,
};

export const EVERSCALE_MAINNET: ITVMNetworkContracts = {
	registryContracts: [
		{
			id: 4,
			type: TVMRegistryContractType.TVMRegistryV1,
			address: '0:c68ec196b86fe001c3762e454991b460e115862f64a9f929591557e00fb0cb3a',
			verified: false,
		},
	],
	mailerContracts: [
		{
			id: 5,
			type: TVMMailerContractType.TVMMailerV5,
			address: '0:a06a244f2632aaff3573e2fa45283fc67e3ad8a11bcba62b060fe9b60c36a0c9',
			verified: false,
		},
	],
	broadcasterContracts: [
		{
			id: 6,
			type: TVMMailerContractType.TVMMailerV5,
			address: '0:38eaf0a6482ebdc4e1d8f7d7addabbecf14b134d23144971595552630e653f5b',
			verified: false,
		},
	],
	currentRegistryId: 4,
	currentMailerId: 5,
	currentBroadcasterId: 6,
};

export const VENOM_TESTNET: ITVMNetworkContracts = {
	registryContracts: [
		{
			id: 7,
			type: TVMRegistryContractType.TVMRegistryV1,
			address: '0:bbcaa42d2a25aea6da05ac1d86d318d56651155933216cd4c3bfaa1b5d3ccc28',
			verified: true,
		},
	],
	mailerContracts: [
		{
			id: 8,
			type: TVMMailerContractType.TVMMailerV5,
			address: '0:4a7fce450636c6608e1ce7852752c69439f9778dbfc5c3f7b4b9a36682ae0c83',
			verified: true,
		},
	],
	broadcasterContracts: [
		{
			id: 9,
			type: TVMMailerContractType.TVMMailerV5,
			address: '0:4a7fce450636c6608e1ce7852752c69439f9778dbfc5c3f7b4b9a36682ae0c83',
			verified: true,
		},
	],
	currentRegistryId: 7,
	currentMailerId: 8,
	currentBroadcasterId: 9,
};
