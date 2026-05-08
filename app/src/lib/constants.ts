export type Tier = 'Flex' | 'L3' | 'L6' | 'L12';

export interface TierParams {
  /** Lock duration in seconds. 0 for Flex (no lock). */
  lockDuration: number;
  /** Share-unit multiplier applied at deposit time. */
  lockMultiplier: number;
  /** Early-exit fee as a decimal fraction (e.g. 0.005 = 0.50%). */
  earlyExitFee: number;
  /** Minimum deposit in USDC (human-readable). */
  minDeposit: string;
}

export const VAULT_TIERS: Record<Tier, TierParams> = {
  Flex: {
    lockDuration: 0,
    lockMultiplier: 1.0,
    earlyExitFee: 0,
    minDeposit: '1.00',
  },
  L3: {
    lockDuration: 90 * 24 * 60 * 60, // 3 months in seconds
    lockMultiplier: 1.05,
    earlyExitFee: 0.005,
    minDeposit: '50.00',
  },
  L6: {
    lockDuration: 180 * 24 * 60 * 60, // 6 months in seconds
    lockMultiplier: 1.15,
    earlyExitFee: 0.0125,
    minDeposit: '100.00',
  },
  L12: {
    lockDuration: 365 * 24 * 60 * 60, // 12 months in seconds
    lockMultiplier: 1.4,
    earlyExitFee: 0.03,
    minDeposit: '250.00',
  },
};
