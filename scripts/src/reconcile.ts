#!/usr/bin/env tsx
/**
 * Reconciliation job (issue #145). Cross-checks on-chain reality against
 * expected payment outcomes:
 *   - sums per-user Balance/Shares (derived from indexed deposit/withdraw/
 *     early_exit events) against each tier vault's total_balance()
 *   - verifies Harvester's bounty+remainder split against harvested, for
 *     every harvest event in the lookback window
 *   - flags any user whose SDK-reported position disagrees with a position
 *     read directly from the tier vault's own storage
 *
 * All of the actual mismatch-detection logic lives in reconcile.core.ts and
 * is unit-tested there without touching the network. This file is just the
 * chain I/O plumbing.
 *
 * Usage:
 *   RECONCILE_READER_PUBLIC_KEY=G... USDC_TOKEN_CONTRACT_ID=C... \
 *     pnpm reconcile [--from-ledger <n>] [--users G...,G...,...]
 *
 * Exits non-zero if any mismatch is found, so it's safe to wire into CI/cron.
 */
import { SorobanRpc, scValToNative } from '@stellar/stellar-sdk';
import { loadDeployments, readerPublicKey, rpcUrl, usdcContractId } from './env';
import { getHarvestEvents, readContractValue } from './rpc';
import {
  runReconciliation,
  type PositionPair,
  type Tier,
  type VaultEvent,
  type VaultTotals,
} from './reconcile.core';

const TIERS: Tier[] = ['Flex', 'L3', 'L6', 'L12'];

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

/**
 * Reads deposit/withdraw/early_exit events for one tier vault contract by
 * decoding the topics/data shape emitted by the vault_flex/vault_l3/
 * vault_l6/vault_l12 contracts' event-emission additions (issue #145).
 */
async function getVaultEvents(
  server: SorobanRpc.Server,
  tier: Tier,
  contractId: string,
  startLedger: number,
): Promise<VaultEvent[]> {
  const response = await server.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [contractId] }],
    limit: 200,
  });

  const events: VaultEvent[] = [];
  for (const raw of response.events) {
    const topics = raw.topic.map((t) => scValToNative(t));
    const kind = topics[0] as string;
    if (kind !== 'deposit' && kind !== 'withdraw' && kind !== 'early_exit') continue;

    const [user, asset] = [String(topics[1]), String(topics[2])];
    const amount = BigInt(scValToNative(raw.value) as bigint | number);
    events.push({ tier, asset, user, kind, amount });
  }
  return events;
}

async function main() {
  const deployments = loadDeployments('testnet');
  const server = new SorobanRpc.Server(rpcUrl());
  const source = readerPublicKey();
  const asset = usdcContractId();

  const latest = await server.getLatestLedger();
  // Default lookback: ~1 day of ledgers (17,280 at ~5s/ledger) — enough for
  // a routine health check without hitting most providers' event-retention
  // ceiling. Override with --from-ledger for a wider historical run.
  const startLedger = Number(parseArg('from-ledger') ?? latest.sequence - 17_280);
  const explicitUsers = parseArg('users')?.split(',').filter(Boolean) ?? [];

  const tierContracts: Record<Tier, string> = {
    Flex: deployments.contracts.VaultFlex,
    L3: deployments.contracts.VaultL3,
    L6: deployments.contracts.VaultL6,
    L12: deployments.contracts.VaultL12,
  };

  const allEvents: VaultEvent[] = [];
  const vaultTotals: VaultTotals[] = [];
  for (const tier of TIERS) {
    const contractId = tierContracts[tier];
    const events = await getVaultEvents(server, tier, contractId, startLedger);
    allEvents.push(...events);

    const totalBalance = (await readContractValue(
      server,
      source,
      contractId,
      'total_balance',
    )) as bigint;
    vaultTotals.push({ tier, totalBalance: BigInt(totalBalance) });
  }

  const harvestEvents = await getHarvestEvents(
    server,
    deployments.contracts.Harvester,
    startLedger,
  );

  // "SDK-reported vs contract storage read directly" — reads each user seen
  // in the event window (or explicitly passed via --users) through
  // VaultRouter.position() (the same call the SDK's queryTierPosition
  // makes) and compares it to the tier vault's own balance() getter.
  const users = explicitUsers.length > 0 ? explicitUsers : [...new Set(allEvents.map((e) => e.user))];
  const positions: PositionPair[] = [];
  for (const tier of TIERS) {
    const contractId = tierContracts[tier];
    for (const user of users) {
      const [routerPosition, chainBalance] = await Promise.all([
        readContractValue(server, source, deployments.contracts.VaultRouter, 'position', [
          user,
          tier,
          asset,
        ]),
        readContractValue(server, source, contractId, 'balance', [user, asset]),
      ]);
      const sdkBalance = BigInt(
        (routerPosition as { principal: bigint | number }).principal ?? 0,
      );
      positions.push({
        tier,
        asset,
        user,
        sdkBalance,
        chainBalance: BigInt(chainBalance as bigint | number),
      });
    }
  }

  const report = runReconciliation({
    events: allEvents,
    vaultTotals,
    harvests: harvestEvents.map((h) => ({
      ledger: h.ledger,
      txHash: h.txHash,
      harvested: h.harvested,
      bounty: h.bounty,
      remainder: h.remainder,
    })),
    positions,
  });

  console.log(JSON.stringify(report, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));

  if (report.mismatches.length > 0) {
    console.error(`\n${report.mismatches.length} reconciliation mismatch(es) found.`);
    process.exit(1);
  }
  console.log('\nReconciliation clean — zero mismatches.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
