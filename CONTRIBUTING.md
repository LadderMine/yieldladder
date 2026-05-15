# Contributing to YieldLadder

Thank you for your interest in contributing to YieldLadder! This guide covers the project structure and local development workflows.

## Project Structure

YieldLadder is organised as a monorepo with three main components:

- **Soroban Contracts** (Rust): Cargo workspace in `contracts/`
- **Next.js Dashboard** (TypeScript): Web app in `app/`
- **TypeScript SDK**: Client library in `sdks/typescript/`

## Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- Node.js 20+ and pnpm 9+
- Soroban CLI (for contract deployment and testing)

## Running Locally

### Soroban Contracts

The contracts are organised as a Cargo workspace. To build all contracts:

```bash
cargo build --target wasm32-unknown-unknown --release
```

Run tests:

```bash
cargo test
```

### Next.js Dashboard

Navigate to the `app/` directory:

```bash
cd app
pnpm install
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

Run typechecking:

```bash
pnpm typecheck
```

### TypeScript SDK

Navigate to the `sdks/typescript/` directory:

```bash
cd sdks/typescript
pnpm install
pnpm build
```

Run typechecking:

```bash
pnpm typecheck
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes and ensure all CI checks pass
4. Submit a pull request with a clear description

All pull requests must pass CI checks including contract builds, Next.js typechecking, and SDK typechecking.