#!/usr/bin/env bash
#
# Deploys the full payment stack (GuardianMultisig, StrategyVault, Harvester,
# all four tier vaults, VaultRouter, Governance) to Soroban testnet and
# populates deployments/testnet.json with the real contract ids, replacing
# the CC_PENDING_TESTNET placeholders (issue #145).
#
# Stellar testnet is periodically reset, wiping every previously-deployed
# contract. This script always deploys+initializes fresh rather than trying
# to detect and reuse "already deployed" ids from a prior deployments.json —
# after a reset those ids point at nothing, so a full rerun is the only
# state that's ever safe to assume. Re-running this script is exactly how
# you recover from a testnet reset.
#
# Usage:
#   DEPLOYER_IDENTITY=yieldladder-deployer USDC_TOKEN_CONTRACT_ID=C... \
#     ./scripts/deploy-testnet.sh
#
# Prerequisites:
#   - `stellar` CLI (https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)
#   - `jq`
#   - An identity registered and funded on testnet:
#       stellar keys generate "$DEPLOYER_IDENTITY"
#       stellar keys fund "$DEPLOYER_IDENTITY" --network testnet
#   - USDC_TOKEN_CONTRACT_ID pointing at the deposit-asset SAC this
#     deployment should use (see scripts/.env.example) — not deployed by
#     this script, since which test token to use is an environment choice,
#     not a protocol concern.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENTS_FILE="$REPO_ROOT/deployments/testnet.json"
NETWORK="testnet"
IDENTITY="${DEPLOYER_IDENTITY:-yieldladder-deployer}"
COOLDOWN_LEDGERS="${HARVEST_COOLDOWN_LEDGERS:-120}" # ~10 minutes at 5s/ledger — short for demo iteration
DEFAULT_MAX_TVL="${DEFAULT_MAX_TVL:-10000000000000}" # 1,000,000 USDC (7 decimals), matches contract defaults

for bin in stellar jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: '$bin' is required but not found on PATH." >&2
    exit 1
  fi
done

if [ -z "${USDC_TOKEN_CONTRACT_ID:-}" ]; then
  echo "error: USDC_TOKEN_CONTRACT_ID is not set. See scripts/.env.example." >&2
  exit 1
fi
USDC="$USDC_TOKEN_CONTRACT_ID"

DEPLOYER_ADDRESS="$(stellar keys address "$IDENTITY")"
echo "Deployer identity: $IDENTITY ($DEPLOYER_ADDRESS)"
echo "Deposit asset:      $USDC"
echo

echo "==> Building contracts"
stellar contract build

deploy() {
  local wasm_name="$1"
  local wasm_path="$REPO_ROOT/target/wasm32-unknown-unknown/release/${wasm_name}.wasm"
  stellar contract deploy \
    --wasm "$wasm_path" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    2>/dev/null
}

echo "==> Deploying contracts"
GUARDIAN_ID="$(deploy guardian_multisig)"
echo "  GuardianMultisig: $GUARDIAN_ID"
STRATEGY_ID="$(deploy strategy_vault)"
echo "  StrategyVault:    $STRATEGY_ID"
HARVESTER_ID="$(deploy harvester)"
echo "  Harvester:        $HARVESTER_ID"
FLEX_ID="$(deploy vault_flex)"
echo "  VaultFlex:        $FLEX_ID"
L3_ID="$(deploy vault_l3)"
echo "  VaultL3:          $L3_ID"
L6_ID="$(deploy vault_l6)"
echo "  VaultL6:          $L6_ID"
L12_ID="$(deploy vault_l12)"
echo "  VaultL12:         $L12_ID"
ROUTER_ID="$(deploy vault_router)"
echo "  VaultRouter:      $ROUTER_ID"
GOVERNANCE_ID="$(deploy governance)"
echo "  Governance:       $GOVERNANCE_ID"
echo

invoke() {
  local contract_id="$1"
  shift
  stellar contract invoke \
    --id "$contract_id" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    -- "$@"
}

echo "==> Initializing contracts (dependency order)"

echo "  GuardianMultisig.initialize (single-owner, threshold=1 — replace with the real guardian set before mainnet)"
invoke "$GUARDIAN_ID" initialize \
  --owners "[\"$DEPLOYER_ADDRESS\"]" \
  --threshold 1

echo "  StrategyVault.initialize"
invoke "$STRATEGY_ID" initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --usdc_token "$USDC"

echo "  Harvester.initialize (cooldown=${COOLDOWN_LEDGERS} ledgers)"
invoke "$HARVESTER_ID" initialize \
  --strategy "$STRATEGY_ID" \
  --usdc "$USDC" \
  --cooldown_ledgers "$COOLDOWN_LEDGERS"

echo "  VaultFlex.initialize"
invoke "$FLEX_ID" initialize \
  --admin "$ROUTER_ID" \
  --strategy "$STRATEGY_ID"

echo "  VaultL3.initialize (max_tvl=${DEFAULT_MAX_TVL})"
invoke "$L3_ID" initialize \
  --admin "$ROUTER_ID" \
  --governance "$GOVERNANCE_ID" \
  --guardian "$GUARDIAN_ID" \
  --strategy "$STRATEGY_ID" \
  --usdc "$USDC" \
  --max_tvl "$DEFAULT_MAX_TVL"

echo "  VaultL6.initialize (max_tvl=${DEFAULT_MAX_TVL})"
invoke "$L6_ID" initialize \
  --admin "$ROUTER_ID" \
  --governance "$GOVERNANCE_ID" \
  --strategy "$STRATEGY_ID" \
  --usdc "$USDC" \
  --max_tvl "$DEFAULT_MAX_TVL"

echo "  VaultL12.initialize (max_tvl=${DEFAULT_MAX_TVL})"
invoke "$L12_ID" initialize \
  --admin "$ROUTER_ID" \
  --governance "$GOVERNANCE_ID" \
  --strategy "$STRATEGY_ID" \
  --usdc "$USDC" \
  --max_tvl "$DEFAULT_MAX_TVL"

echo "  VaultRouter.initialize"
invoke "$ROUTER_ID" initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --governance "$GOVERNANCE_ID" \
  --guardian "$GUARDIAN_ID" \
  --vault_flex "$FLEX_ID" \
  --vault_l3 "$L3_ID" \
  --vault_l6 "$L6_ID" \
  --vault_l12 "$L12_ID" \
  --initial_assets "[\"$USDC\"]"

echo "  Governance.initialize"
invoke "$GOVERNANCE_ID" initialize \
  --strategist "$DEPLOYER_ADDRESS" \
  --guardian "$GUARDIAN_ID" \
  --strategy_vault "$STRATEGY_ID"

echo
echo "==> Writing $DEPLOYMENTS_FILE"
jq -n \
  --arg router "$ROUTER_ID" \
  --arg flex "$FLEX_ID" \
  --arg l3 "$L3_ID" \
  --arg l6 "$L6_ID" \
  --arg l12 "$L12_ID" \
  --arg strategy "$STRATEGY_ID" \
  --arg harvester "$HARVESTER_ID" \
  --arg governance "$GOVERNANCE_ID" \
  --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{
    network: "testnet",
    contracts: {
      VaultRouter: $router,
      VaultFlex: $flex,
      VaultL3: $l3,
      VaultL6: $l6,
      VaultL12: $l12,
      StrategyVault: $strategy,
      Harvester: $harvester,
      Governance: $governance
    },
    deployedAt: $deployedAt
  }' > "$DEPLOYMENTS_FILE"

echo "Done. deployments/testnet.json updated."
echo "GuardianMultisig ($GUARDIAN_ID) is not tracked in deployments/testnet.json's schema — record it separately if you need it (e.g. scripts/.env.example or your own notes)."
