import { Address, Contract, GetExpectedAddressParams, ProviderRpcClient, Transaction } from 'everscale-inpage-provider';
import { TVMWalletAccount } from '../misc';

export type DeployParams<Abi> = GetExpectedAddressParams<Abi> & { publicKey: string };
export type ConstructorParams<Abi> = Parameters<constructorParamsType<Abi, Contract<Abi>['methods']>>[0];
type constructorParamsType<Abi, T extends Contract<Abi>['methods']> = {
	[key in keyof T]: key extends 'constructor' ? T[key] : never;
}[keyof T];
export type TransactionWithOutput = { transaction: Transaction; output?: Record<string, unknown> | undefined };
export type TransactionParameter = TransactionWithOutput | { tx: TransactionWithOutput } | Transaction;

export const errorExtractor = async <T extends { transaction: Transaction; output?: Record<string, unknown> }>(
	transactionResult: Promise<T>,
): Promise<T> => {
	return transactionResult.then(res => {
		if (res.transaction.aborted) {
			// eslint-disable-next-line no-throw-literal
			throw {
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				message: `Transaction aborted with code ${res.transaction.exitCode}`,
				name: 'TransactionAborted',
				transaction: res,
			};
		}
		return res;
	});
};

export class TVMDeployer {
	static async deployContract<Abi>(
		ever: ProviderRpcClient,
		me: TVMWalletAccount,

		abi: Abi,
		deployParams: DeployParams<Abi>,
		constructorParams: ConstructorParams<Abi>,
		value: string,
	): Promise<{ contract: Contract<Abi>; tx: TransactionWithOutput }> {
		const expectedAddress = await ever.getExpectedAddress(abi, deployParams);
		await errorExtractor(
			ever.sendMessage({
				sender: new Address(me.address),
				recipient: expectedAddress,
				bounce: false,
				amount: value,
			}),
		);
		const contract = new ever.Contract(abi, expectedAddress);
		const stateInit = await ever.getStateInit(abi, deployParams);
		// tslint:disable-next-line
		console.log('stateInit: ', stateInit);
		// tslint:disable-next-line
		console.log('expectedAddress: ', expectedAddress);
		const tx = await errorExtractor(
			contract.methods.constructor(constructorParams).sendExternal({
				stateInit: stateInit.stateInit,
				publicKey: deployParams.publicKey,
			}),
		);

		return { contract, tx };
	}
}
