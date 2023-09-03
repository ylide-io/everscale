import { RemotePublicKey, PublicKey, PublicKeyType } from '@ylide/sdk';
import { SmartBuffer } from '@ylide/smart-buffer';
import { Address, ProviderRpcClient, Transaction } from 'everscale-inpage-provider';
import { TVMBlockchainReader, NekotonCore } from '../controllers/helpers/TVMBlockchainReader';
import {
	ILogService,
	ITVMContentMessageBody,
	ITVMInternalMessage,
	ITVMMessage,
	ITVMRegistryContractLink,
	TVMWalletAccount,
	publicKeyToBigIntString,
	randomHex,
} from '../misc';
import { ContractCache } from './ContractCache';
import { TVMDeployer } from './TVMDeployer';

export class TVMRegistryV2Wrapper {
	private readonly cache: ContractCache<typeof REGISTRY_V2_ABI>;

	constructor(public readonly blockchainReader: TVMBlockchainReader) {
		this.cache = new ContractCache(REGISTRY_V2_ABI, blockchainReader);
	}

	static async deploy(ever: ProviderRpcClient, from: TVMWalletAccount): Promise<string> {
		const contractAddress = await TVMDeployer.deployContract(
			ever,
			from,
			REGISTRY_V2_ABI,
			{
				tvc: REGISTRY_V2_TVC_BASE64,
				workchain: 0,
				publicKey: from.$$meta.publicKeyHex,
				initParams: {
					nonce: BigInt(`0x${randomHex(64)}`).toString(10),
				} as never,
			},
			{} as never,
			'1000000000',
		);

		return contractAddress.contract.address.toString();
	}

	decodeAddressToPublicKeyMessageBody(
		core: NekotonCore,
		body: string,
	): {
		publicKey: Uint8Array;
		keyVersion: number;
		registrar: number;
	} {
		const data = core.decodeEvent(body, JSON.stringify(REGISTRY_V2_ABI), 'AddressToPublicKey');
		if (!data) {
			throw new Error('AddressToPublicKeyMessage format is not supported');
		}
		return {
			publicKey: SmartBuffer.ofHexString(
				BigInt(data.data.publicKey as string)
					.toString(16)
					.padStart(64, '0'),
			).bytes,
			keyVersion: Number(data.data.keyVersion),
			registrar: Number(data.data.registrar),
		};
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
				const key = this.decodeAddressToPublicKeyMessageBody(core, lastKeyMessage.body);
				return new RemotePublicKey(
					this.blockchainReader.blockchainGroup,
					this.blockchainReader.blockchain,
					address.toLowerCase(),
					new PublicKey(PublicKeyType.YLIDE, key.keyVersion, key.publicKey),
					lastKeyMessage.created_at,
					key.registrar,
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
			const key = this.decodeAddressToPublicKeyMessageBody(core, message.body);
			return {
				type: 'key',
				key: new RemotePublicKey(
					this.blockchainReader.blockchainGroup,
					this.blockchainReader.blockchain,
					message.dst.startsWith(':') ? `0${message.dst.toLowerCase()}` : message.dst.toLowerCase(),
					new PublicKey(PublicKeyType.YLIDE, key.keyVersion, key.publicKey),
					message.created_at,
					key.registrar,
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
		options?: { log: ILogService },
	): Promise<
		(
			| { type: 'message'; msg: ITVMMessage; raw: ITVMInternalMessage }
			| { type: 'content'; content: ITVMContentMessageBody; raw: ITVMInternalMessage }
			| { type: 'key'; key: RemotePublicKey; raw: ITVMInternalMessage }
			| { type: 'none'; raw: ITVMInternalMessage }
		)[]
	> {
		options?.log.log('RevistryV2 retrieveHistoryAscRaw external start');
		const result = await this.cache.contractOperation(registry, async (contract, ever, gql, core) => {
			options?.log.log('RevistryV2 retrieveHistoryAscRaw internal start');
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
			options?.log.log('RevistryV2 retrieveHistoryAscRaw internal end');
			return msgs.map(m => this.parseEvent(core, registry, m));
		});
		options?.log.log('RevistryV2 retrieveHistoryAscRaw external end');
		return result;
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
			return messages.map(m => {
				const key = this.decodeAddressToPublicKeyMessageBody(core, m.body);
				return new RemotePublicKey(
					this.blockchainReader.blockchainGroup,
					this.blockchainReader.blockchain,
					address.toLowerCase(),
					new PublicKey(PublicKeyType.YLIDE, key.keyVersion, key.publicKey),
					m.created_at,
					key.registrar,
				);
			});
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
				.attachPublicKey({
					publicKey: publicKeyToBigIntString(publicKey.keyBytes),
					keyVersion: publicKey.keyVersion,
					registrar,
				})
				.sendWithResult({
					from: new Address(from),
					amount: '1000000000',
					bounce: false,
				});
		});
	}
}

export const REGISTRY_V2_ABI = {
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
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'keyVersion', type: 'uint32' },
				{ name: 'registrar', type: 'uint32' },
			],
			outputs: [],
		},
		{
			name: 'attachAddress',
			inputs: [{ name: 'publicKey', type: 'uint256' }],
			outputs: [],
		},
		{
			name: 'immediatelyTerminate',
			inputs: [],
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
			name: 'terminated',
			inputs: [],
			outputs: [{ name: 'terminated', type: 'bool' }],
		},
		{
			name: 'nonce',
			inputs: [],
			outputs: [{ name: 'nonce', type: 'uint256' }],
		},
	],
	'data': [{ key: 1, name: 'nonce', type: 'uint256' }],
	'events': [
		{
			name: 'PublicKeyToAddress',
			inputs: [{ name: 'addr', type: 'address' }],
			outputs: [],
		},
		{
			name: 'AddressToPublicKey',
			inputs: [
				{ name: 'publicKey', type: 'uint256' },
				{ name: 'keyVersion', type: 'uint32' },
				{ name: 'registrar', type: 'uint32' },
			],
			outputs: [],
		},
	],
	'fields': [
		{ name: '_pubkey', type: 'uint256' },
		{ name: '_timestamp', type: 'uint64' },
		{ name: '_constructorFlag', type: 'bool' },
		{ name: 'owner', type: 'address' },
		{ name: 'terminated', type: 'bool' },
		{ name: 'nonce', type: 'uint256' },
	],
};

const REGISTRY_V2_TVC_BASE64 =
	'te6ccgECIQEABC4AAgE0AwEBAcACAEPQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgBCSK7VMg4wMgwP/jAiDA/uMC8gseBQQgA8LtRNDXScMB+GaJ+Gkh2zzTAAGOHIMI1xgg+QEB0wABlNP/AwGTAvhC4iD4ZfkQ8qiV0wAB8nri0z8B+EMhufK0IPgjgQPoqIIIG3dAoLnytPhj0x8B+CO88rnTHwHbPPI8GAgGA1LtRNDXScMB+GYi0NMD+kAw+GmpOADcIccA4wIh1w0f8rwh4wMB2zzyPB0dBgM8IIIQKWXfTLvjAiCCEF8Lz9674wIgghBotV8/uuMCEAoHAlYw+EJu4wD4RvJz0fhJ+Gpw+Gv4QvLgZfhFIG6SMHDe+EK68uBm+ADbPPIACBYCFu1E0NdJwgGOgOMNCRkBUnDtRND0BYlwcSOAQPQOb5GT1wv/3vhs+Gv4aoBA9A7yvdcL//hicPhjGARQIIIQLLYpubrjAiCCEC4rpYS64wIgghBFYfaruuMCIIIQXwvP3rrjAg8ODAsBTjDR2zz4SiGOG40EcAAAAAAAAAAAAAAAADfC8/egyM7OyXD7AN7yABkDJjD4RvLgTPhCbuMA0ds8MNs88gAZDRYAGPhJ+ErHBfLgZH/4awFQMNHbPPhLIY4cjQRwAAAAAAAAAAAAAAAAK4rpYSDIzsoAyXD7AN7yABkBUDDR2zz4TCGOHI0EcAAAAAAAAAAAAAAAACstim5gyM7L/8lw+wDe8gAZBFAgghAKx7IUuuMCIIIQDgTSnrrjAiCCECfCxLi64wIgghApZd9MuuMCGhUTEQMmMPhG8uBM+EJu4wDR2zww2zzyABkSFgA0+En4SscF8uBk+ErIz4UIzoBvz0DJgQCg+wACKjD4RvLgTCGT1NHQ3tP/0ds84wDyABQbAH6CElQL5ABw+wKDByDIz4WAywgBzwHJ0MjPhyDOcc8LYfhJyM+Q3t36ps7NyXD7APhJyM+FCM6Ab89AyYMG+wADNjD4RvLgTPhCbuMAIZPU0dDe+kDR2zww2zzyABkXFgA2+Ev4SvhD+ELIy//LP8+DzsoA+EzIy//Nye1UASb4SfhKxwXy4GQgiccFkyD4at8wGABDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAA87UTQ0//TP9MAMfpA0gDU0dDT/9H4bPhr+Gr4Y/hiAjIw+Eby4Ewhk9TR0N7T/9Mf0x/R2zzjAPIAHBsAKO1E0NP/0z8x+ENYyMv/yz/Oye1UAJyCElQL5ABw+wIC+En6Qm8T1wv/gwcgyM+FgMsIAc8BydDIz4cgznHPC2FVIMjPkEBK4ibL/8sfyx/NyXD7APhJyM+FCM6Ab89AyYMG+wAACvhG8uBMAgr0pCD0oSAfABRzb2wgMC42MS4yAAA=';
