import { ConnectorScope } from '@ylide/sdk';
import {
	everscaleBlockchainFactory,
	everscaleWalletFactory,
	venomBlockchainFactory,
	venomWalletFactory,
} from './controllers';

export * from './contract-wrappers';
export * from './controllers';
export * from './encrypt';
export * from './messages-sources';
export * from './misc';
export * from './network';

export const tvm: ConnectorScope = {
	walletFactories: [everscaleWalletFactory, venomWalletFactory],
	blockchainFactories: [everscaleBlockchainFactory, venomBlockchainFactory],
};
