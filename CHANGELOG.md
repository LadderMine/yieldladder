# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cargo workspace with contract stubs for all eight vault roles.
- Next.js dashboard scaffold.
- TypeScript SDK skeleton.
- GitHub Actions CI for Rust and Next.js.
- `.editorconfig` for consistent indentation across Rust, TypeScript, and JSON.
- `CONTRIBUTING.md` covering Cargo workspace, Next.js app, and TypeScript SDK workflows.
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- GitHub issue templates for bug reports and feature requests.
- `docs/architecture.md` with ASCII diagram and contract responsibility descriptions.
- `contracts/vault_router/src/types.rs` with `TierName`, `Shares`, and `LockUntil` type aliases.
- `contracts/vault_router/src/error.rs` with `VaultError` enum (`InvalidTier`, `BelowMinDeposit`, `LockNotExpired`).
- `sdks/typescript/src/types.ts` extracting `Tier`, `Network`, `Position`, and `YieldLadderOptions`.
- `sdks/typescript/src/errors.ts` with `YieldLadderError`, `LockNotExpiredError`, and `BelowMinDepositError`.
- `sdks/typescript/src/utils.ts` with `formatUSDC` helper.
- `app/src/lib/constants.ts` with typed vault tier parameters.
- `app/src/components/VaultCard.tsx` stub component.
- `app/src/app/dashboard/page.tsx` stub dashboard page rendering all four vault tier cards.
- Rust doc comments on `VaultRouter` and `Harvester` structs.

## [0.3.0] — 2026-03-14

### Added

- Share-checkpoint mechanism for mid-period deposits.
- Early-exit fee redistribution to remaining tier depositors.
- Governance contract with 72-hour timelock.

## [0.2.0] — 2026-01-22

### Added

- Strategy Vault allocation engine.
- Harvester contract with caller bounty (10 bps).
- Lock multiplier table for all four vault tiers.

## [0.1.0] — 2025-11-10

### Added

- Initial vault router prototype.
- Vault Flex (no lock) and VaultL12 (12-month lock) contracts.
