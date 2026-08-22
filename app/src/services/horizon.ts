// Trustline detection (issue #143) via Horizon's REST API rather than a
// Soroban RPC ledger-entry read: checking a classic trustline by
// `getLedgerEntries` needs an XDR-encoded LedgerKey, which needs
// @stellar/stellar-sdk to build — the same blocked app-level dependency
// documented on placeholderSubmissionHash in app/src/app/deposit/page.tsx.
// Horizon's `/accounts/{id}` returns trustlines as plain JSON, so this is
// genuinely real and dependency-free today, unlike the fee estimate and
// trustline-creation transaction (see feeEstimate.ts and the deposit
// page's trustline step for what's still honestly blocked).

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface HorizonAccountResponse {
  balances: HorizonBalance[];
}

/** The account doesn't exist on-chain yet (unfunded) — distinct from "exists but has no trustline." */
export class AccountNotFoundError extends Error {
  constructor(readonly publicKey: string) {
    super(`Account ${publicKey} was not found on the network — it may be unfunded.`);
    this.name = 'AccountNotFoundError';
  }
}

export class HorizonUnavailableError extends Error {
  constructor(readonly rawError: string) {
    super('Could not reach the Horizon API.');
    this.name = 'HorizonUnavailableError';
  }
}

async function fetchAccount(publicKey: string): Promise<HorizonAccountResponse> {
  let res: Response;
  try {
    res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, { cache: 'no-store' });
  } catch (error) {
    throw new HorizonUnavailableError(error instanceof Error ? error.message : String(error));
  }

  if (res.status === 404) {
    throw new AccountNotFoundError(publicKey);
  }
  if (!res.ok) {
    throw new HorizonUnavailableError(`Horizon HTTP ${res.status}`);
  }
  return res.json() as Promise<HorizonAccountResponse>;
}

export interface TrustlineCheckResult {
  /** False if the asset issuer isn't configured (NEXT_PUBLIC_USDC_ISSUER unset) — see the deposit page for how this is surfaced. */
  configured: boolean;
  hasTrustline: boolean;
}

/**
 * Checks whether `publicKey` already holds a trustline for `assetCode`
 * issued by `issuer`. `configured: false` (not an error) when `issuer`
 * isn't set — callers should treat that as "can't check yet," not "no
 * trustline."
 */
export async function checkUsdcTrustline(
  publicKey: string,
  assetCode: string,
  issuer: string | undefined,
): Promise<TrustlineCheckResult> {
  if (!issuer) {
    return { configured: false, hasTrustline: false };
  }

  const account = await fetchAccount(publicKey);
  const hasTrustline = account.balances.some(
    (b) => b.asset_code === assetCode && b.asset_issuer === issuer,
  );
  return { configured: true, hasTrustline };
}
