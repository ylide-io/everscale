import { Address, ProviderRpcClient, Contract } from 'everscale-inpage-provider';
import nekotonCore from 'everscale-standalone-client/core';
import { EverscaleBlockchainReader, NekotonCore } from '../controllers/helpers/EverscaleBlockchainReader';
import { ITVMMailerContractLink, ITVMRegistryContractLink } from '../misc';
import { GqlSender } from '../network';

export type SigningContext = any;

export class ContractCache<ABI = any> {
	private readonly contractCache: Record<string, Map<SigningContext, Contract<ABI>>> = {};

	constructor(public readonly abi: any, public readonly blockchainReader: EverscaleBlockchainReader) {
		//
	}

	getContract(address: string, provider: ProviderRpcClient): Contract<ABI> {
		if (!this.contractCache[address] || !this.contractCache[address].has(provider)) {
			const contract = new provider.Contract(this.abi, new Address(address));
			if (!this.contractCache[address]) {
				this.contractCache[address] = new Map();
			}
			this.contractCache[address].set(provider, contract);

			return contract;
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return this.contractCache[address].get(provider)!;
		}
	}

	async contractOperation<T>(
		contractLink: ITVMMailerContractLink | ITVMRegistryContractLink,
		callback: (
			contract: Contract<ABI>,
			ever: ProviderRpcClient,
			gql: GqlSender,
			core: NekotonCore,
			stopTrying: () => void,
		) => Promise<T>,
	): Promise<T> {
		return await this.blockchainReader.operation(async (ever, gql, core, stopTrying) => {
			const contract = this.getContract(contractLink.address, ever);
			return await callback(contract, ever, gql, core, stopTrying);
		});
	}
}
