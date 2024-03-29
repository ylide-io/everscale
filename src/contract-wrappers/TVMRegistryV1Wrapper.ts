import { RemotePublicKey, PublicKey, PublicKeyType, YlideKeyVersion } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';
import { Address, ProviderRpcClient, Transaction } from 'everscale-inpage-provider';
import { TVMBlockchainReader, NekotonCore } from '../controllers/helpers/TVMBlockchainReader';
import {
	ITVMContentMessageBody,
	ITVMInternalMessage,
	ITVMMessage,
	ITVMRegistryContractLink,
	TVMWalletAccount,
	publicKeyToBigIntString,
} from '../misc';
import { ContractCache } from './ContractCache';
import { TVMDeployer } from './TVMDeployer';

export class TVMRegistryV1Wrapper {
	private readonly cache: ContractCache<typeof REGISTRY_V1_ABI>;

	constructor(public readonly blockchainReader: TVMBlockchainReader) {
		this.cache = new ContractCache(REGISTRY_V1_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: TVMWalletAccount): Promise<string> {
		const contractAddress = await TVMDeployer.deployContract(
			ever,
			from,
			REGISTRY_V1_ABI,
			{
				tvc: REGISTRY_V1_TVC_BASE64,
				workchain: 0,
				publicKey: from.$$meta.publicKeyHex,
				initParams: {} as never,
			},
			{} as never,
			'1000000000',
		);

		return contractAddress.contract.address.toString();
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

	async getPublicKeyByAddress(registry: ITVMRegistryContractLink, address: string): Promise<RemotePublicKey | null> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			const [lastKeyMessage] = await gql.queryContractMessages(
				':' + address.split(':')[1],
				'desc',
				{
					type: 'before',
					cursor: null,
				},
				registry.address,
				1,
			);
			if (lastKeyMessage) {
				const lastKeyBytes = this.decodeAddressToPublicKeyMessageBody(core, lastKeyMessage.body);
				return new RemotePublicKey(
					this.blockchainReader.blockchainGroup,
					this.blockchainReader.blockchain,
					address.toLowerCase(),
					new PublicKey(PublicKeyType.YLIDE, YlideKeyVersion.INSECURE_KEY_V1, lastKeyBytes),
					lastKeyMessage.created_at,
					0,
				);
			} else {
				return null;
			}
		});
	}

	parseEvent(
		core: NekotonCore,
		registry: ITVMRegistryContractLink,
		message: ITVMInternalMessage,
	): { type: 'key'; key: RemotePublicKey; raw: ITVMInternalMessage } | { type: 'none'; raw: ITVMInternalMessage } {
		try {
			return {
				type: 'key',
				key: new RemotePublicKey(
					this.blockchainReader.blockchainGroup,
					this.blockchainReader.blockchain,
					message.dst.startsWith(':') ? `0${message.dst.toLowerCase()}` : message.dst.toLowerCase(),
					new PublicKey(
						PublicKeyType.YLIDE,
						YlideKeyVersion.INSECURE_KEY_V1,
						this.decodeAddressToPublicKeyMessageBody(core, message.body),
					),
					message.created_at,
					0,
				),
				raw: message,
			};
		} catch (err) {
			// nothing
		}
		return {
			type: 'none',
			raw: message,
		};
	}

	async retrieveHistoryAscRaw(
		registry: ITVMRegistryContractLink,
		fromMessage: ITVMInternalMessage | null,
		limit?: number,
	): Promise<
		(
			| { type: 'message'; msg: ITVMMessage; raw: ITVMInternalMessage }
			| { type: 'content'; content: ITVMContentMessageBody; raw: ITVMInternalMessage }
			| { type: 'key'; key: RemotePublicKey; raw: ITVMInternalMessage }
			| { type: 'none'; raw: ITVMInternalMessage }
		)[]
	> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			const msgs = await gql.queryContractMessages(
				null,
				'asc',
				{
					type: 'after',
					cursor: fromMessage && fromMessage.cursor,
				},
				registry.address,
				limit,
			);
			return msgs.map(m => this.parseEvent(core, registry, m));
		});
	}

	async getPublicKeysHistoryForAddress(
		registry: ITVMRegistryContractLink,
		address: string,
	): Promise<RemotePublicKey[]> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			const messages = await gql.queryContractMessages(
				':' + address.split(':')[1],
				'desc',
				{
					type: 'before',
					cursor: null,
				},
				registry.address,
				100,
			);
			return messages.map(
				m =>
					new RemotePublicKey(
						this.blockchainReader.blockchainGroup,
						this.blockchainReader.blockchain,
						address.toLowerCase(),
						new PublicKey(
							PublicKeyType.YLIDE,
							YlideKeyVersion.INSECURE_KEY_V1,
							this.decodeAddressToPublicKeyMessageBody(core, m.body),
						),
						m.created_at,
						0,
					),
			);
		});
	}

	async attachPublicKey(
		registry: ITVMRegistryContractLink,
		from: string,
		publicKey: PublicKey,
		registrar: number,
	): Promise<{
		parentTransaction: Transaction;
		childTransaction: Transaction;
		output?: any;
	}> {
		return await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			return await contract.methods
				// @ts-ignore
				.attachPublicKey({ publicKey: publicKeyToBigIntString(publicKey.keyBytes) })
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

const REGISTRY_V1_TVC_BASE64 =
	'te6ccgECFQEAAmYAAgE0AwEBAcACAEPQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBCSK7VMg4wMgwP/jAiDA/uMC8gsSBwQUAQAFAv7tRNDXScMB+GaNCGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT4aSHbPNMAAY4cgwjXGCD5AQHTAAGU0/8DAZMC+ELiIPhl+RDyqJXTAAHyeuLTPwH4QyG58rQg+COBA+iogggbd0CgufK0+GPTHwH4I7zyudMfCgYBCgHbPPI8CANS7UTQ10nDAfhmItDTA/pAMPhpqTgA3CHHAOMCIdcNH/K8IeMDAds88jwREQgDPCCCECDHok664wIgghAnwsS4uuMCIIIQaLVfP7rjAg4MCQJIMPhCbuMA+Ebyc9H4QvLgZfhFIG6SMHDe+EK68uBm+ADbPPIACg8BPu1E0NdJwgGOFHDtRND0BYBA9A7yvdcL//hicPhj4w0LAB7tRNDT/9M/0wAx0fhj+GICKjD4RvLgTCGT1NHQ3tP/0ds84wDyAA0PAH6CEDuaygBw+wKDByDIz4WAywgBzwHJ0MjPhyDOcc8LYfhJyM+Q3t36ps7NyXD7APhJyM+FCM6Ab89AyYMG+wACKjD4RvLgTCGT1NHQ3tP/0ds84wDyABAPABz4Q/hCyMv/yz/Pg8ntVACIghA7msoAcPsC+En6Qm8T1wv/gwcgyM+FgMsIAc8BydDIz4cgzoIQXsnDXc8Lgcv/yXD7APhJyM+FCM6Ab89AyYMG+wAACvhG8uBMAgr0pCD0oRQTABRzb2wgMC42MS4yAAA=';
