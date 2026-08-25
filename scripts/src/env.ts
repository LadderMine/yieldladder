import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

export interface Deployments {
  network: string;
  contracts: {
    VaultRouter: string;
    VaultFlex: string;
    VaultL3: string;
    VaultL6: string;
    VaultL12: string;
    StrategyVault: string;
    Harvester: string;
    Governance: string;
  };
  deployedAt: string;
}

const PLACEHOLDER = 'CC_PENDING_TESTNET';

/**
 * Loads deployments/testnet.json from the repo root. Throws with a clear,
 * actionable message if the file still holds placeholders — i.e. nobody has
 * run `scripts/deploy-testnet.sh` yet — rather than letting every tool that
 * reads this file fail with an opaque "CC_PENDING_TESTNET is not a valid
 * contract id" error deep inside the RPC client.
 */
export function loadDeployments(network: 'testnet' | 'mainnet' = 'testnet'): Deployments {
  const filePath = path.join(REPO_ROOT, 'deployments', `${network}.json`);
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Deployments;

  const pending = Object.entries(raw.contracts)
    .filter(([, id]) => !id || id === PLACEHOLDER)
    .map(([name]) => name);

  if (pending.length > 0) {
    throw new Error(
      `deployments/${network}.json is missing real contract ids for: ${pending.join(', ')}. ` +
        `Run scripts/deploy-testnet.sh first (see scripts/README.md).`,
    );
  }

  return raw;
}

export function rpcUrl(): string {
  return process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
}

export function usdcContractId(): string {
  const id = process.env.USDC_TOKEN_CONTRACT_ID;
  if (!id) {
    throw new Error(
      'USDC_TOKEN_CONTRACT_ID is not set. Point it at the deposit-asset SAC used for this ' +
        'deployment (see scripts/.env.example).',
    );
  }
  return id;
}

/**
 * Public key used as the transaction source for read-only simulation calls
 * (Soroban's simulateTransaction needs a syntactically valid source account
 * even though nothing is signed or submitted). Any existing testnet account
 * works — it does not need to hold a position or even be funded for a pure
 * read simulation in most RPC implementations, but funding it avoids edge
 * cases on some providers.
 */
export function readerPublicKey(): string {
  const key = process.env.RECONCILE_READER_PUBLIC_KEY;
  if (!key) {
    throw new Error(
      'RECONCILE_READER_PUBLIC_KEY is not set. Provide any existing testnet account public ' +
        'key to use as the simulation source (see scripts/.env.example).',
    );
  }
  return key;
}

export { REPO_ROOT };
