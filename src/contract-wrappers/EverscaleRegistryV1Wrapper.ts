import { ExternalYlidePublicKey, PublicKey, PublicKeyType, YlidePublicKeyVersion } from '@ylide/sdk';
import SmartBuffer from '@ylide/smart-buffer';
import { Address, Transaction } from 'everscale-inpage-provider';
import { EverscaleBlockchainReader, NekotonCore } from '../controllers/helpers/EverscaleBlockchainReader';
import { ITVMRegistryContractLink, publicKeyToBigIntString } from '../misc';
import { ContractCache } from './ContractCache';

export class EverscaleRegistryV1Wrapper {
	private readonly cache: ContractCache<typeof REGISTRY_V1_ABI>;

	constructor(public readonly blockchainReader: EverscaleBlockchainReader) {
		this.cache = new ContractCache(REGISTRY_V1_ABI, blockchainReader);
	}

	decodeAddressToPublicKeyMessageBody(core: NekotonCore, body: string): Uint8Array {
		const data = core.decodeEvent(body, JSON.stringify(REGISTRY_V1_ABI), 'AddressToPublicKey');
		if (!data) {
			throw new Error('AddressToPublicKeyMessage format is not supported');
		}
		return SmartBuffer.ofHexString(
			BigInt(data.data.publicKey as string)
				.toString(16)
				.padStart(64, '0'),
		).bytes;
	}

	async getPublicKeyByAddress(
		registry: ITVMRegistryContractLink,
		address: string,
	): Promise<ExternalYlidePublicKey | null> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			const [lastKeyMessage] = await gql.queryContractMessages(address, registry.address, 1);
			if (lastKeyMessage) {
				const lastKeyBytes = this.decodeAddressToPublicKeyMessageBody(core, lastKeyMessage.body);
				return {
					keyVersion: YlidePublicKeyVersion.INSECURE_KEY_V1,
					publicKey: PublicKey.fromBytes(PublicKeyType.YLIDE, lastKeyBytes),
					timestamp: lastKeyMessage.created_at,
					registrar: 0,
				};
			} else {
				return null;
			}
		});
	}

	async getPublicKeysHistoryForAddress(
		registry: ITVMRegistryContractLink,
		address: string,
	): Promise<ExternalYlidePublicKey[]> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			const messages = await gql.queryContractMessages(address, registry.address, 100);
			return messages.map(m => ({
				keyVersion: YlidePublicKeyVersion.INSECURE_KEY_V1,
				publicKey: PublicKey.fromBytes(
					PublicKeyType.YLIDE,
					this.decodeAddressToPublicKeyMessageBody(core, m.body),
				),
				timestamp: m.created_at,
				registrar: 0,
			}));
		});
	}

	async attachPublicKey(
		registry: ITVMRegistryContractLink,
		from: string,
		publicKey: ExternalYlidePublicKey,
	): Promise<{
		parentTransaction: Transaction;
		childTransaction: Transaction;
		output?: any;
	}> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			return await contract.methods
				// @ts-ignore
				.attachPublicKey({ publicKey: publicKeyToBigIntString(publicKey.publicKey.bytes) })
				.sendWithResult({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}
}

export const REGISTRY_V1_ABI = {
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
