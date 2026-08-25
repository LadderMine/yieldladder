import { describe, expect, it } from 'vitest';
import {
  computeAssetBalances,
  reconcileAggregateBalances,
  reconcileHarvestSplits,
  reconcilePerAssetBalances,
  reconcileSdkVsChain,
  runReconciliation,
  type HarvestRecord,
  type PositionPair,
  type VaultEvent,
} from './reconcile.core';

const USDC = 'CUSDC000000000000000000000000000000000000000000000000';
const EURC = 'CEURC000000000000000000000000000000000000000000000000';
const ALICE = 'GALICE00000000000000000000000000000000000000000000000';
const BOB = 'GBOB00000000000000000000000000000000000000000000000000';

describe('computeAssetBalances', () => {
  it('sums deposits and subtracts withdraw/early_exit per (tier, asset)', () => {
    const events: VaultEvent[] = [
      { tier: 'Flex', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n },
      { tier: 'Flex', asset: USDC, user: ALICE, kind: 'withdraw', amount: 40n },
      { tier: 'Flex', asset: EURC, user: BOB, kind: 'deposit', amount: 50n },
    ];
    const balances = computeAssetBalances(events);
    expect(balances.get('Flex|' + USDC)).toBe(60n);
    expect(balances.get('Flex|' + EURC)).toBe(50n);
  });
});

describe('reconcilePerAssetBalances', () => {
  it('reports zero mismatches for a clean, balanced event history', () => {
    const events: VaultEvent[] = [
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'deposit', amount: 500n },
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'withdraw', amount: 200n },
    ];
    expect(reconcilePerAssetBalances(events)).toEqual([]);
  });

  it('flags a (tier, asset) whose computed balance goes negative', () => {
    const events: VaultEvent[] = [
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n },
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'withdraw', amount: 150n },
    ];
    const mismatches = reconcilePerAssetBalances(events);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      kind: 'negative_asset_balance',
      tier: 'L3',
      asset: USDC,
      actual: '-50',
    });
  });

  it('does not mask a shortfall in one asset with a surplus in another', () => {
    // Aggregate net across both assets is +50 (healthy), but USDC alone is
    // negative — a tier-wide-only check would miss this.
    const events: VaultEvent[] = [
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n },
      { tier: 'L3', asset: USDC, user: ALICE, kind: 'withdraw', amount: 150n },
      { tier: 'L3', asset: EURC, user: BOB, kind: 'deposit', amount: 100n },
    ];
    const mismatches = reconcilePerAssetBalances(events);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].asset).toBe(USDC);
  });
});

describe('reconcileAggregateBalances', () => {
  it('matches when the vault total equals the sum of computed per-asset balances', () => {
    const events: VaultEvent[] = [
      { tier: 'Flex', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n },
      { tier: 'Flex', asset: EURC, user: BOB, kind: 'deposit', amount: 50n },
    ];
    const mismatches = reconcileAggregateBalances(events, [{ tier: 'Flex', totalBalance: 150n }]);
    expect(mismatches).toEqual([]);
  });

  it('flags drift between the on-chain aggregate and computed events', () => {
    const events: VaultEvent[] = [
      { tier: 'Flex', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n },
    ];
    const mismatches = reconcileAggregateBalances(events, [{ tier: 'Flex', totalBalance: 90n }]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ kind: 'aggregate_balance', expected: '90', actual: '100' });
  });

  it('does not false-flag a paused window with zero new deposit events', () => {
    // No new events during a pause — the aggregate simply doesn't move,
    // and reconciliation compares reality against reality rather than an
    // expected-activity model, so a paused window with no deposits is
    // indistinguishable from "nothing happened," which is correct.
    const events: VaultEvent[] = [
      { tier: 'L6', asset: USDC, user: ALICE, kind: 'deposit', amount: 200n },
    ];
    const mismatches = reconcileAggregateBalances(events, [{ tier: 'L6', totalBalance: 200n }]);
    expect(mismatches).toEqual([]);
  });
});

describe('reconcileHarvestSplits', () => {
  it('passes a normal harvest whose bounty + remainder equals the harvested amount', () => {
    const records: HarvestRecord[] = [
      { ledger: 100, txHash: 'abc', harvested: 10_000n, bounty: 10n, remainder: 9_990n },
    ];
    expect(reconcileHarvestSplits(records)).toEqual([]);
  });

  it('treats a documented zero-yield harvest as expected, not a discrepancy', () => {
    const records: HarvestRecord[] = [
      { ledger: 100, txHash: 'abc', harvested: 0n, bounty: 0n, remainder: 0n },
    ];
    expect(reconcileHarvestSplits(records)).toEqual([]);
  });

  it('flags a zero-yield harvest that still paid out a bounty', () => {
    const records: HarvestRecord[] = [
      { ledger: 100, txHash: 'abc', harvested: 0n, bounty: 5n, remainder: 0n },
    ];
    const mismatches = reconcileHarvestSplits(records);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('harvest_split');
  });

  it('flags an injected bounty/remainder split mismatch', () => {
    const records: HarvestRecord[] = [
      { ledger: 100, txHash: 'abc', harvested: 10_000n, bounty: 10n, remainder: 9_000n },
    ];
    const mismatches = reconcileHarvestSplits(records);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ kind: 'harvest_split', expected: '10000', actual: '9010' });
  });
});

describe('reconcileSdkVsChain', () => {
  it('passes when SDK-reported and direct chain reads agree', () => {
    const pairs: PositionPair[] = [
      { tier: 'L12', asset: USDC, user: ALICE, sdkBalance: 2_500_000_000n, chainBalance: 2_500_000_000n },
    ];
    expect(reconcileSdkVsChain(pairs)).toEqual([]);
  });

  it('flags disagreement between the SDK and a direct contract-storage read', () => {
    const pairs: PositionPair[] = [
      { tier: 'L12', asset: USDC, user: ALICE, sdkBalance: 2_500_000_000n, chainBalance: 2_400_000_000n },
    ];
    const mismatches = reconcileSdkVsChain(pairs);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0].kind).toBe('sdk_vs_chain_position');
  });
});

describe('runReconciliation', () => {
  it('reports zero mismatches on a fully clean, consistent snapshot', () => {
    const report = runReconciliation({
      events: [{ tier: 'Flex', asset: USDC, user: ALICE, kind: 'deposit', amount: 100n }],
      vaultTotals: [{ tier: 'Flex', totalBalance: 100n }],
      harvests: [{ ledger: 1, txHash: 'x', harvested: 0n, bounty: 0n, remainder: 0n }],
      positions: [{ tier: 'Flex', asset: USDC, user: ALICE, sdkBalance: 100n, chainBalance: 100n }],
    });
    expect(report.mismatches).toEqual([]);
  });

  it('aggregates mismatches from every dimension when several are broken at once', () => {
    const report = runReconciliation({
      events: [{ tier: 'Flex', asset: USDC, user: ALICE, kind: 'withdraw', amount: 100n }],
      vaultTotals: [{ tier: 'Flex', totalBalance: 0n }],
      harvests: [{ ledger: 1, txHash: 'x', harvested: 1000n, bounty: 1n, remainder: 998n }],
      positions: [{ tier: 'Flex', asset: USDC, user: BOB, sdkBalance: 5n, chainBalance: 6n }],
    });
    const kinds = report.mismatches.map((m) => m.kind).sort();
    expect(kinds).toEqual(
      ['aggregate_balance', 'harvest_split', 'negative_asset_balance', 'sdk_vs_chain_position'].sort(),
    );
  });
});
