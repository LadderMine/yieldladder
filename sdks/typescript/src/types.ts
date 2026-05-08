export type Tier = 'Flex' | 'L3' | 'L6' | 'L12';
export type Network = 'mainnet' | 'testnet';

export interface YieldLadderOptions {
  network: Network;
  signer: unknown;
}

export interface Position {
  tier: Tier;
  principal: string;
  shares: string;
  accruedYield: string;
  lockUntil: number | null;
}
