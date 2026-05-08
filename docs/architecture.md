# Architecture

## Overview

```
+------------------+       +-------------------+       +------------------+
|   Vault Router   | ----> |  Vault Contracts  | ----> |  Strategy Vault  |
|   (entrypoint)   |       |  Flex / L3 / L6 / |       |    (allocator)   |
+------------------+       |        L12        |       +------------------+
                           +-------------------+                |
                                                                v
                                                       +------------------+
                                                       |   Stellar AMM    |
                                                       |  liquidity pools |
                                                       |   (curated set)  |
                                                       +------------------+
                                                                |
                                                                v
                                                       +------------------+
                                                       |    Harvester     |
                                                       | (cron-triggered) |
                                                       +------------------+
```

## Contracts

### VaultRouter

The user-facing entry point. All deposits and withdrawals flow through this contract. It:

- Validates tier rules (minimum deposit amount, lock duration).
- Mints non-transferable share-units: `shares = deposit_amount × lock_multiplier`.
- Records `lock_until = now + tier.duration` for L3, L6, and L12.
- Forwards deposited USDC to the appropriate tier vault.
- Enforces early-exit fees on pre-maturity withdrawals and socialises them across remaining depositors.

### Vault Contracts (VaultFlex, VaultL3, VaultL6, VaultL12)

One contract per tier. Each vault:

- Holds depositor balances and share-unit records for its tier.
- Maintains a checkpoint of total shares at each harvest event so mid-period deposits do not retroactively affect prior yield distributions.
- Forwards working capital to the Strategy Vault for allocation.

### Strategy Vault

Holds the protocol's aggregate working capital across all tiers and executes pool allocations. It:

- Allocates USDC across a curated set of Stellar AMM liquidity pools.
- Enforces a hard-coded 35% per-pool exposure cap.
- Restricts allocations to pools on the counterparty allowlist (XLM, EURC, AQUA).
- Accepts allocation proposals from the Strategist role, subject to the Governance timelock.

### Harvester

A permissionless contract that claims accumulated AMM trading fees and compounds them back into the Strategy Vault. Key properties:

- Anyone can call `harvest()` after the cooldown elapses — no privileged keeper required.
- The caller receives a 10 bps bounty on harvested yield as an execution incentive.
- Harvested USDC is re-deposited into the Strategy Vault, increasing the assets backing all share-units.

### Governance

Manages Strategist proposals with a 72-hour timelock. The Guardian Multisig (4-of-7) can veto any proposal during the timelock window. Neither the Strategist nor the Guardian can move user funds.
