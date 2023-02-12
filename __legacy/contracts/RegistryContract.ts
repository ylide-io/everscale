import { Uint256 } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, Contract, ProviderRpcClient } from 'everscale-inpage-provider';
import core from 'everscale-standalone-client/core';
import { EverscaleBlockchainController } from '../controllers';
import { publicKeyToBigIntString, getContractMessagesQuery } from '../misc';
import { decodeAddressToPublicKeyMessageBody } from './contractUtils';

export class RegistryContract {
	readonly contractAddress: string;
	readonly contract: Contract<typeof REGISTRY_ABI>;

	constructor(private readonly ever: ProviderRpcClient, contractAddress: string) {
		this.contractAddress = contractAddress;
		this.contract = new ever.Contract(REGISTRY_ABI, new Address(this.contractAddress));
	}

	async attachPublicKey(address: string, publicKey: Uint8Array): Promise<boolean> {
		const result: any = await this.contract.methods
			// @ts-ignore
			.attachPublicKey({ publicKey: publicKeyToBigIntString(publicKey) })
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
		return true;
	}
}

export const REGISTRY_ABI = {
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
