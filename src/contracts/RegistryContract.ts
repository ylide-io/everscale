import SmartBuffer from '@ylide/smart-buffer';
import { Address, Contract } from 'everscale-inpage-provider';
import core from 'everscale-standalone-client/core';
import { EverscaleBlockchainController } from '../controllers';
import { publicKeyToBigIntString, getContractMessagesQuery } from '../misc';

export class RegistryContract {
	private readonly contractAddress: string;
	readonly contract: Contract<typeof REGISTRY_ABI>;

	constructor(private readonly blockchainController: EverscaleBlockchainController, contractAddress: string) {
		this.contractAddress = contractAddress;
		this.contract = new blockchainController.ever.Contract(REGISTRY_ABI, new Address(this.contractAddress));
	}

	private publicKeyToAddress(publicKey: Uint8Array) {
		return `:${new SmartBuffer(publicKey).toHexString()}`;
	}

	async getAddressByPublicKey(publicKey: Uint8Array): Promise<string | null> {
		await core.ensureNekotonLoaded();
		const messages = await this.blockchainController.gqlQueryMessages(
			getContractMessagesQuery(this.publicKeyToAddress(publicKey), this.contractAddress),
		);
		if (messages.length) {
			return this.decodePublicKeyToAddressMessageBody(messages[0].body);
		} else {
			return null;
		}
	}

	async getPublicKeyByAddress(address: string): Promise<Uint8Array | null> {
		await core.ensureNekotonLoaded();
		const messages = await this.blockchainController.gqlQueryMessages(
			getContractMessagesQuery(address.substring(1), this.contractAddress),
		);
		if (messages.length) {
			return this.decodeAddressToPublicKeyMessageBody(messages[0].body);
		} else {
			return null;
		}
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

	async attachAddress(address: string, publicKey: Uint8Array): Promise<boolean> {
		const result: any = await this.contract.methods
			// @ts-ignore
			.attachAddress({ publicKey: publicKeyToBigIntString(publicKey) })
			.sendWithResult({
				from: new Address(address),
				amount: '1000000000',
				bounce: false,
			});
		return true;
	}

	private decodePublicKeyToAddressMessageBody(body: string): string {
		const data = core.nekoton.decodeEvent(body, JSON.stringify(REGISTRY_ABI), 'PublicKeyToAddress');
		if (!data) {
			throw new Error('PublicKeyToAddressMessage format is not supported');
		}
		return data.data.addr as string;
	}

	private decodeAddressToPublicKeyMessageBody(body: string): Uint8Array {
		const data = core.nekoton.decodeEvent(body, JSON.stringify(REGISTRY_ABI), 'AddressToPublicKey');
		if (!data) {
			throw new Error('AddressToPublicKeyMessage format is not supported');
		}
		return SmartBuffer.ofHexString(
			BigInt(data.data.publicKey as string)
				.toString(16)
				.padStart(64, '0'),
		).bytes;
	}
}

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
