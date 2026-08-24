/**
 * Pure reconciliation logic (issue #145) — no network I/O, so it is fully
 * unit-testable. `reconcile.ts` is the thin CLI wrapper that fetches chain
 * state and events, then calls the functions below.
 */

export type Tier = 'Flex' | 'L3' | 'L6' | 'L12';

export interface VaultEvent {
  tier: Tier;
  asset: string;
  user: string;
  kind: 'deposit' | 'withdraw' | 'early_exit';
  /**
   * The amount that moved the vault's balance for this event: the deposit
   * amount, or the actual payout for withdraw/early_exit — for early_exit
   * this is already net of any exit fee (or un-feed, under emergency
   * unlock), because the contract emits the post-fee `net_amount` as the
   * event data. Reconciliation therefore never needs to re-derive fee or
   * emergency-unlock logic itself.
   */
  amount: bigint;
}

export interface VaultTotals {
  tier: Tier;
  /** vault.total_balance() — aggregated across ALL deposit assets for this tier (the contracts don't track a per-asset total). */
  totalBalance: bigint;
}

export interface HarvestRecord {
  ledger: number;
  txHash: string;
  harvested: bigint;
  bounty: bigint;
  remainder: bigint;
}

export interface PositionPair {
  tier: Tier;
  asset: string;
  user: string;
  sdkBalance: bigint;
  chainBalance: bigint;
}

export type MismatchKind =
  | 'negative_asset_balance'
  | 'aggregate_balance'
  | 'harvest_split'
  | 'sdk_vs_chain_position';

export interface Mismatch {
  kind: MismatchKind;
  tier?: Tier;
  asset?: string;
  user?: string;
  expected: string;
  actual: string;
  detail: string;
}

/** (tier, asset) -> computed principal balance, from summing deposit/withdraw/early_exit events. */
export function computeAssetBalances(events: VaultEvent[]): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  for (const ev of events) {
    const key = `${ev.tier}|${ev.asset}`;
    const current = balances.get(key) ?? 0n;
    const delta = ev.kind === 'deposit' ? ev.amount : -ev.amount;
    balances.set(key, current + delta);
  }
  return balances;
}

/**
 * Flags any (tier, asset) whose event-derived balance has gone negative —
 * an impossible state that means withdrawals/early-exits were recorded
 * (or amounts computed) that the deposit history doesn't support. Checking
 * per-asset, rather than only the tier-wide aggregate below, is what
 * catches a shortfall in one asset that a surplus in another would
 * otherwise mask.
 */
export function reconcilePerAssetBalances(events: VaultEvent[]): Mismatch[] {
  const balances = computeAssetBalances(events);
  const mismatches: Mismatch[] = [];
  for (const [key, balance] of balances) {
    if (balance < 0n) {
      const [tier, asset] = key.split('|') as [Tier, string];
      mismatches.push({
        kind: 'negative_asset_balance',
        tier,
        asset,
        expected: '>= 0',
        actual: balance.toString(),
        detail: `Computed balance for ${tier}/${asset} went negative — withdrawals exceed recorded deposits.`,
      });
    }
  }
  return mismatches;
}

/**
 * Cross-checks the event-derived balance, summed across every asset for a
 * tier, against that tier vault's on-chain `total_balance()` — the only
 * total the contracts expose (it is not tracked per-asset on-chain).
 */
export function reconcileAggregateBalances(
  events: VaultEvent[],
  vaultTotals: VaultTotals[],
): Mismatch[] {
  const perAsset = computeAssetBalances(events);
  const byTier = new Map<Tier, bigint>();
  for (const [key, balance] of perAsset) {
    const tier = key.split('|')[0] as Tier;
    byTier.set(tier, (byTier.get(tier) ?? 0n) + balance);
  }

  const mismatches: Mismatch[] = [];
  for (const { tier, totalBalance } of vaultTotals) {
    const computed = byTier.get(tier) ?? 0n;
    if (computed !== totalBalance) {
      mismatches.push({
        kind: 'aggregate_balance',
        tier,
        expected: totalBalance.toString(),
        actual: computed.toString(),
        detail: `${tier} vault total_balance() is ${totalBalance} but summed deposit/withdraw/early_exit events give ${computed}.`,
      });
    }
  }
  return mismatches;
}

/**
 * Validates the harvester's bounty/remainder split against each harvest
 * event's `harvested` amount — the invariant unit-tested in isolation at
 * contracts/harvester/src/lib.rs:160-179, now checked against live chain
 * state instead of just in-process arithmetic. A zero-yield harvest
 * (harvested === 0) is expected to carry bounty === remainder === 0 and is
 * NOT flagged as a discrepancy (contracts/harvester/src/lib.rs:80-87).
 */
export function reconcileHarvestSplits(records: HarvestRecord[]): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const r of records) {
    if (r.harvested === 0n) {
      if (r.bounty !== 0n || r.remainder !== 0n) {
        mismatches.push({
          kind: 'harvest_split',
          expected: 'bounty=0, remainder=0',
          actual: `bounty=${r.bounty}, remainder=${r.remainder}`,
          detail: `Zero-yield harvest at ledger ${r.ledger} (tx ${r.txHash}) paid out a non-zero bounty/remainder.`,
        });
      }
      continue;
    }
    const sum = r.bounty + r.remainder;
    if (sum !== r.harvested) {
      mismatches.push({
        kind: 'harvest_split',
        expected: r.harvested.toString(),
        actual: sum.toString(),
        detail: `Harvest at ledger ${r.ledger} (tx ${r.txHash}): bounty(${r.bounty}) + remainder(${r.remainder}) != harvested(${r.harvested}).`,
      });
    }
  }
  return mismatches;
}

/**
 * Flags any user/tier/asset where the SDK-reported position
 * (VaultRouter.position() via the TypeScript SDK) disagrees with a
 * position read directly from the tier vault's own storage getters.
 */
export function reconcileSdkVsChain(pairs: PositionPair[]): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const p of pairs) {
    if (p.sdkBalance !== p.chainBalance) {
      mismatches.push({
        kind: 'sdk_vs_chain_position',
        tier: p.tier,
        asset: p.asset,
        user: p.user,
        expected: p.chainBalance.toString(),
        actual: p.sdkBalance.toString(),
        detail: `${p.user}'s SDK-reported ${p.tier}/${p.asset} balance (${p.sdkBalance}) disagrees with the tier vault's own balance() (${p.chainBalance}).`,
      });
    }
  }
  return mismatches;
}

export interface ReconciliationReport {
  mismatches: Mismatch[];
  checkedAt: string;
}

export function runReconciliation(input: {
  events: VaultEvent[];
  vaultTotals: VaultTotals[];
  harvests: HarvestRecord[];
  positions: PositionPair[];
}): ReconciliationReport {
  return {
    mismatches: [
      ...reconcilePerAssetBalances(input.events),
      ...reconcileAggregateBalances(input.events, input.vaultTotals),
      ...reconcileHarvestSplits(input.harvests),
      ...reconcileSdkVsChain(input.positions),
    ],
    checkedAt: new Date().toISOString(),
  };
}
