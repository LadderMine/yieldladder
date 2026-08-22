import { getFeeStats, type FeeDistribution } from '../services/rpc';

const STROOPS_PER_XLM = 10_000_000;

export interface FeeEstimate {
  available: boolean;
  /** e.g. "up to ~0.00012 XLM" — always an "up to" ceiling, never a fixed quote (see note). */
  display: string;
  note: string;
}

function stroopsToXlm(stroops: string): number {
  return Number(stroops) / STROOPS_PER_XLM;
}

const UNAVAILABLE: FeeEstimate = {
  available: false,
  display: 'Fee estimate unavailable',
  note: "Couldn't reach the network to estimate the fee — you'll see the exact amount in your wallet before you sign.",
};

function pickDistribution(stats: {
  sorobanInclusionFee?: FeeDistribution;
  inclusionFee?: FeeDistribution;
}): FeeDistribution | undefined {
  return stats.sorobanInclusionFee ?? stats.inclusionFee;
}

/**
 * A real fee estimate (issue #143) sourced from the network's own recent
 * fee data (`getFeeStats`), replacing the previous hardcoded
 * '0.00001 XLM' string. Presented as an "up to" ceiling (the 99th
 * percentile recently paid), not a fixed quote: Soroban's resource-fee
 * component varies per transaction under load, and this app can't
 * simulate this specific deposit's fee without @stellar/stellar-sdk
 * (still blocked — see feeEstimate.test.ts and paymentFlow.ts's
 * requestWalletSignature doc for the same, already-documented
 * constraint). A ceiling is the honest choice here: it can't understate
 * what the user might actually pay the way a fixed/average figure could.
 *
 * Never throws — a network failure or an unrecognized response shape
 * both resolve to `available: false` with an explanatory note, the same
 * "explicit unavailable over a fabricated number" convention already used
 * throughout this codebase (see e.g. hooks/usePosition.ts).
 */
export async function estimateNetworkFee(): Promise<FeeEstimate> {
  try {
    const stats = await getFeeStats();
    const distribution = pickDistribution(stats);
    if (!distribution?.p99) {
      return UNAVAILABLE;
    }

    const ceilingXlm = stroopsToXlm(distribution.p99);
    if (!Number.isFinite(ceilingXlm) || ceilingXlm <= 0) {
      return UNAVAILABLE;
    }

    return {
      available: true,
      display: `up to ~${ceilingXlm.toFixed(5)} XLM`,
      note: "Based on recent network fees (99th percentile) — this is a Stellar network fee, not a YieldLadder fee.",
    };
  } catch {
    return UNAVAILABLE;
  }
}
