import {
  BASE_FEE,
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

/**
 * Reads a contract's view/getter method via `simulateTransaction` — no
 * signing, no submission, no state change. Every tier-vault getter used by
 * reconciliation (`balance`, `shares`, `total_balance`, `total_shares`,
 * `max_tvl`, `remaining_capacity`, `emergency_unlock`, ...) and Harvester's
 * (`last_harvest`, `next_harvest_ledger`) is a plain getter with no
 * `require_auth`, so this works against any syntactically valid source
 * account.
 */
export async function readContractValue(
  server: SorobanRpc.Server,
  sourcePublicKey: string,
  contractId: string,
  method: string,
  args: unknown[] = [],
): Promise<unknown> {
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);
  const scArgs = args.map((a) => toScVal(a));

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${contractId}.${method} failed: ${sim.error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim) || sim.result === undefined) {
    throw new Error(`simulate ${contractId}.${method} returned no result`);
  }
  return scValToNative(sim.result.retval);
}

function toScVal(value: unknown): xdr.ScVal {
  if (typeof value === 'string' && value.startsWith('G') && value.length === 56) {
    return nativeToScVal(value, { type: 'address' });
  }
  if (typeof value === 'bigint' || typeof value === 'number') {
    return nativeToScVal(value, { type: 'i128' });
  }
  return nativeToScVal(value);
}

export interface HarvestEvent {
  ledger: number;
  txHash: string;
  caller: string;
  harvested: bigint;
  bounty: bigint;
  remainder: bigint;
}

/**
 * Fetches decoded `harvest` events (issue #145 event emission) for a
 * Harvester contract in `[startLedger, latest]`. Public Soroban RPC
 * providers only retain a rolling event window (commonly ~7 days of
 * ledgers) — pass a recent `startLedger` or this will simply return fewer
 * events than exist historically, which is expected, not an error.
 */
export async function getHarvestEvents(
  server: SorobanRpc.Server,
  harvesterContractId: string,
  startLedger: number,
): Promise<HarvestEvent[]> {
  const response = await server.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [harvesterContractId],
      },
    ],
    limit: 200,
  });

  const events: HarvestEvent[] = [];
  for (const raw of response.events) {
    const topics = raw.topic.map((t) => scValToNative(t));
    if (topics[0] !== 'harvest') continue;

    const data = scValToNative(raw.value) as [bigint, bigint, bigint];
    events.push({
      ledger: raw.ledger,
      txHash: raw.txHash,
      caller: String(topics[1]),
      harvested: BigInt(data[0]),
      bounty: BigInt(data[1]),
      remainder: BigInt(data[2]),
    });
  }
  return events;
}
