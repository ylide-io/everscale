import { WalletAccount } from '@ylide/sdk';

export const TVMWalletAccount = WalletAccount<{ publicKeyHex: string }>;
export type TVMWalletAccount = WalletAccount<{ publicKeyHex: string }>;
