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
		{
			id: 15,
			type: TVMRegistryContractType.TVMRegistryV2,
			address: '0:40b51e25b86925335c085480e59763981b58defec327056c6f97dcbdaf055800',
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
		{
			id: 20,
			type: TVMMailerContractType.TVMMailerV8,
			address: '0:dabbebf837dac7484cc16aea4b34203a0f2190d1007c0339ec5114669d9cedf4',
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
		{
			id: 21,
			type: TVMMailerContractType.TVMMailerV8,
			address: '0:379475cdf11bf0c479ee03bc5e9ba5e0752167e7b11c9ff76a305da2769ea286',
			verified: false,
		},
	],
	currentRegistryId: 15,
	currentMailerId: 20,
	currentBroadcasterId: 21,
};

export const VENOM_TESTNET: ITVMNetworkContracts = {
	registryContracts: [
		{
			id: 7,
			type: TVMRegistryContractType.TVMRegistryV1,
			address: '0:bbcaa42d2a25aea6da05ac1d86d318d56651155933216cd4c3bfaa1b5d3ccc28',
			verified: true,
		},
		{
			id: 12,
			type: TVMRegistryContractType.TVMRegistryV2,
			address: '0:75db8c44199c91e82dddacdd7c26e1ff9ad7229f3c0b3c0c2ac01293f7d89b02',
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
		{
			id: 10,
			type: TVMMailerContractType.TVMMailerV6,
			address: '0:5fc46e8ed7dd5f5b10e9cd1ebf5fc49449ece07183da9bb7370772649aaa413b',
			verified: true,
		},
		{
			id: 13,
			type: TVMMailerContractType.TVMMailerV7,
			address: '0:eabbbaaca95ac62b0c47edad0b2427a27408b9d045241bd82ca512c7907345d3',
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
		{
			id: 11,
			type: TVMMailerContractType.TVMMailerV6,
			address: '0:12981245427f512cb1ebed1d14e4bb61c572ae6b8c4fcbbd044f752a3f764aba',
			verified: true,
		},
		{
			id: 14,
			type: TVMMailerContractType.TVMMailerV7,
			address: '0:eabbbaaca95ac62b0c47edad0b2427a27408b9d045241bd82ca512c7907345d3',
			verified: true,
		},
		{
			id: 30,
			type: TVMMailerContractType.TVMMailerV8,
			address: '0:eedc81247f8628034be30db049b6056a086c5fac0497598cf829f4997a8d52c9',
			verified: true,
		},
	],
	currentRegistryId: 12,
	currentMailerId: 13,
	currentBroadcasterId: 30,
};
