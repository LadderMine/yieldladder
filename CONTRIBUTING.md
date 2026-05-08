# Contributing to YieldLadder

Thank you for your interest in contributing. This document covers the three main workspaces: Soroban contracts (Rust), the TypeScript SDK, and the Next.js dashboard.

## Prerequisites

- Rust stable + `wasm32-unknown-unknown` target
- Node.js 20+
- pnpm 9+

## Soroban contracts

The contracts live in `contracts/` and share a Cargo workspace defined at the repo root.

```bash
# Build all contracts for wasm32
cargo build --target wasm32-unknown-unknown --release

# Run tests (native target)
cargo test
```

Add the wasm32 target if missing:

```bash
rustup target add wasm32-unknown-unknown
```

## TypeScript SDK

The SDK lives in `sdks/typescript/`.

```bash
cd sdks/typescript
pnpm install
pnpm typecheck   # type-check without emitting
pnpm build       # emit to dist/
```

## Next.js dashboard

The app lives in `app/`.

```bash
cd app
pnpm install
pnpm dev         # start dev server on http://localhost:3000
pnpm typecheck   # type-check without building
pnpm build       # production build
```

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes and ensure all CI checks pass locally.
3. Open a PR with a clear title and description referencing any related issues.
4. A maintainer will review and merge.

## Code style

- Rust: `rustfmt` defaults (enforced by CI).
- TypeScript: follow the existing tsconfig strictness settings.
- Commit messages: use [Conventional Commits](https://www.conventionalcommits.org/) prefixes (`feat:`, `fix:`, `docs:`, `chore:`).

## Security

Do not open public issues for security findings. See `security/bounty.md` and email `security@yieldladder.dev`.
