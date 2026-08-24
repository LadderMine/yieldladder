# Testnet deployment, reconciliation & demo tooling

Tooling for issue #145 (Payments 8/8): deploying the payment stack to
Soroban testnet, reconciling on-chain reality against expected outcomes,
reporting operational health, and running an end-to-end demo through the
real TypeScript SDK.

## Setup

```bash
cd scripts
pnpm install   # or npm install
cp .env.example .env   # then fill in the values below
```

| Variable | Used by | Notes |
| --- | --- | --- |
| `SOROBAN_RPC_URL` | all | defaults to the public testnet RPC |
| `USDC_TOKEN_CONTRACT_ID` | deploy, reconcile, report, demo | the deposit-asset SAC for this deployment |
| `RECONCILE_READER_PUBLIC_KEY` | reconcile, report | any existing testnet account; read-only, no funds needed |
| `DEPLOYER_IDENTITY` | deploy | a `stellar keys` identity, funded on testnet |
| `DEMO_SECRET_KEY` | demo | a funded testnet account holding the deposit asset |

## 1. Deploy to testnet

```bash
stellar keys generate "$DEPLOYER_IDENTITY"
stellar keys fund "$DEPLOYER_IDENTITY" --network testnet
./scripts/deploy-testnet.sh
```

Builds every contract, deploys VaultRouter, all four tier vaults,
StrategyVault, Harvester, Governance, and GuardianMultisig, initializes them
in dependency order, and writes real contract ids into
`deployments/testnet.json`, replacing the `CC_PENDING_TESTNET` placeholders.

**Testnet resets:** Stellar testnet is periodically wiped. When that
happens every previously-deployed contract id in `deployments/testnet.json`
stops resolving. Recovery is just re-running `./scripts/deploy-testnet.sh`
— it always deploys and initializes fresh rather than trying to detect and
reuse old ids, so there's no special "reset mode" to remember.

The script deploys a single-owner GuardianMultisig (`threshold=1`) for
testnet convenience. Replace that with the real multisig owner set before
any mainnet deployment.

## 2. Run the end-to-end demo

```bash
DEMO_SECRET_KEY=S... USDC_TOKEN_CONTRACT_ID=C... pnpm demo
```

Drives the real `@yieldladder/sdk` (issues #139/#141) against the
deployment from step 1:

1. Deposits into Flex and L3 (2+ tiers), printing each `PaymentStatus`
   transition as the SDK polls for confirmation.
2. Prints the `stellar contract invoke ... harvest` command to trigger a
   harvest (the SDK's public surface is deposit/withdraw-focused;
   Harvester's `harvest()` is permissionless and unrelated to a specific
   depositor, so it's invoked directly rather than added to the SDK for
   this one demo step).
3. Re-reads the Flex position so you can compare `accruedYield` before vs.
   after the harvest.
4. Withdraws Flex and early-exits L3.
5. Prints final positions (both principals should be back to `0`) and the
   exact `pnpm reconcile` command to confirm zero discrepancy.

**On Freighter:** this script signs with a `Keypair` instead of a browser
extension, because Freighter can't be driven headlessly from Node. It
implements the SDK's `Signer` interface exactly (`signTransaction(xdr,
opts)`) — the same shape a WalletAdapter from issue #143 satisfies — so the
calls this script makes (`sdk.deposit(...)`, `sdk.withdraw(...)`,
`sdk.earlyExit(...)`) are identical to what the app makes through a
connected Freighter wallet. To demo it through Freighter instead, run the
app (`cd app && pnpm dev`), connect a testnet-funded Freighter wallet, and
repeat the same deposit → harvest → withdraw sequence through the UI.

## 3. Reconcile

```bash
RECONCILE_READER_PUBLIC_KEY=G... USDC_TOKEN_CONTRACT_ID=C... pnpm reconcile
```

Cross-checks:

- **Per-asset balances**: sums deposit/withdraw/early_exit events (issue
  #145's event-emission additions) per `(tier, asset)` and flags any that
  goes negative — an impossible state that a tier-wide-only check would
  miss if a shortfall in one asset were offset by a surplus in another.
- **Aggregate balance**: the same computed sums, totalled across assets per
  tier, against that tier vault's on-chain `total_balance()` — the only
  total the contracts track (there's no per-asset total on-chain, hence the
  event-derived check above).
- **Harvest bounty split**: for every `harvest` event in the lookback
  window, `bounty + remainder == harvested` (mirroring the invariant
  unit-tested in isolation at `contracts/harvester/src/lib.rs:160-179`,
  now checked against real chain state). A zero-yield harvest
  (`harvested == 0`, `contracts/harvester/src/lib.rs:80-87`) is expected to
  carry a zero bounty and is not flagged.
- **SDK vs. chain**: for every user seen in the event window (or passed via
  `--users G...,G...`), compares `VaultRouter.position()` (what the SDK
  reports) against the tier vault's own `balance()` getter (read directly).

Exits non-zero if any mismatch is found — safe to wire into CI or a cron
job. The mismatch-detection logic itself (`src/reconcile.core.ts`) is pure
and covered by `pnpm test`, including an intentionally-injected mismatch,
so the detector's correctness doesn't depend on having a live deployment.

**Emergency-unlock / paused windows:** neither is special-cased, by
design. A paused protocol has no new deposit events during the pause, so
the event-derived balance simply doesn't move — comparing reality against
reality (rather than against an "expected activity" model) means an idle
window during a pause produces zero mismatches on its own. Early-exit
events already carry the post-fee `net_amount` as their data (whether or
not emergency unlock waived the fee), so reconciliation never re-derives
fee logic itself. See the "paused window" and "zero-yield harvest" cases in
`src/reconcile.test.ts`.

## 4. Operational health report

```bash
RECONCILE_READER_PUBLIC_KEY=G... pnpm report
```

Answers "is the payment system healthy right now?" without reading
contract storage by hand: current TVL vs. cap per tier, and last-harvest
ledger vs. the expected cooldown-elapsed ledger. Run alongside `pnpm
reconcile` for the mismatch-detection half of that picture.

## Known limitations

- **Multi-asset event lookback**: `pnpm reconcile`'s event queries default
  to roughly the last day of ledgers and rely on `getEvents`, which public
  Soroban RPC providers only retain for a rolling window (commonly ~7
  days). A full-history reconciliation needs either a wider `--from-ledger`
  (bounded by the provider's retention) or a persistent indexer ingesting
  events as they're emitted — out of scope here; this tooling reconciles
  the recent window, which is what a scheduled health check needs.
- **GuardianMultisig id**: `deployments/testnet.json`'s existing schema
  (defined before this issue) doesn't have a slot for it. `deploy-testnet.sh`
  prints it at the end of a run — record it yourself if you need to
  reference it later (e.g. to call `set_emergency_unlock`).
