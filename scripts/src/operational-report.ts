#!/usr/bin/env tsx
/**
 * Operational health report (issue #145). Answers "is the payment system
 * healthy right now?" without reading contract storage by hand: last
 * harvest ledger vs. the expected cooldown-elapsed ledger, current TVL vs.
 * cap per tier, and a summary of any reconciliation mismatches.
 *
 * Usage:
 *   RECONCILE_READER_PUBLIC_KEY=G... USDC_TOKEN_CONTRACT_ID=C... \
 *     pnpm report
 */
import { SorobanRpc } from '@stellar/stellar-sdk';
import { loadDeployments, readerPublicKey, rpcUrl } from './env';
import { readContractValue } from './rpc';
import type { Tier } from './reconcile.core';

const TIERS: Tier[] = ['Flex', 'L3', 'L6', 'L12'];

interface TierHealth {
  tier: Tier;
  totalBalance: string;
  maxTvl: string | null;
  remainingCapacity: string | null;
  pctOfCap: number | null;
}

interface HarvestHealth {
  lastHarvestLedger: number;
  nextHarvestLedger: number;
  currentLedger: number;
  cooldownElapsed: boolean;
  ledgersUntilNextHarvest: number;
}

async function main() {
  const deployments = loadDeployments('testnet');
  const server = new SorobanRpc.Server(rpcUrl());
  const source = readerPublicKey();

  const latest = await server.getLatestLedger();
  const currentLedger = latest.sequence;

  const tierContracts: Record<Tier, string> = {
    Flex: deployments.contracts.VaultFlex,
    L3: deployments.contracts.VaultL3,
    L6: deployments.contracts.VaultL6,
    L12: deployments.contracts.VaultL12,
  };

  const tierHealth: TierHealth[] = [];
  for (const tier of TIERS) {
    const contractId = tierContracts[tier];
    const totalBalance = BigInt(
      (await readContractValue(server, source, contractId, 'total_balance')) as bigint,
    );

    // Flex has no cap/remaining_capacity getters (contracts/vault_flex/src/lib.rs) — only the
    // locked tiers (L3/L6/L12) expose max_tvl/remaining_capacity.
    let maxTvl: bigint | null = null;
    let remaining: bigint | null = null;
    if (tier !== 'Flex') {
      maxTvl = BigInt((await readContractValue(server, source, contractId, 'max_tvl')) as bigint);
      remaining = BigInt(
        (await readContractValue(server, source, contractId, 'remaining_capacity')) as bigint,
      );
    }

    tierHealth.push({
      tier,
      totalBalance: totalBalance.toString(),
      maxTvl: maxTvl?.toString() ?? null,
      remainingCapacity: remaining?.toString() ?? null,
      pctOfCap: maxTvl && maxTvl > 0n ? Number((totalBalance * 10_000n) / maxTvl) / 100 : null,
    });
  }

  const lastHarvestLedger = Number(
    await readContractValue(server, source, deployments.contracts.Harvester, 'last_harvest'),
  );
  const nextHarvestLedger = Number(
    await readContractValue(
      server,
      source,
      deployments.contracts.Harvester,
      'next_harvest_ledger',
    ),
  );

  const harvestHealth: HarvestHealth = {
    lastHarvestLedger,
    nextHarvestLedger,
    currentLedger,
    cooldownElapsed: currentLedger >= nextHarvestLedger,
    ledgersUntilNextHarvest: Math.max(0, nextHarvestLedger - currentLedger),
  };

  const report = {
    checkedAt: new Date().toISOString(),
    network: deployments.network,
    currentLedger,
    tiers: tierHealth,
    harvest: harvestHealth,
    note:
      'Run `pnpm reconcile` alongside this report for balance/shares/harvest-split ' +
      'mismatch detection — this report only covers TVL-vs-cap and harvest cadence.',
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
