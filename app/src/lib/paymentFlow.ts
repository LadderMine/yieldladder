// Shared payment-flow helpers used by both app/src/app/deposit/page.tsx and
// app/src/components/EarlyExitModal.tsx: the error taxonomy/classification
// (issue #142), the submit -> sign -> wait orchestration, and the real
// wallet-signing step (issue #143, see requestWalletSignature's doc for
// what's still blocked and why) — "give every payment operation a
// complete, typed failure taxonomy and well-defined retry/recovery
// behavior."

import {
  RpcTimeoutError,
  RpcUnavailableError,
  TransactionFailedError,
  TransactionTimedOutError,
  waitForTransaction,
} from '../services/rpc';
import {
  WalletDisconnectedError,
  WalletNetworkMismatchError,
  WalletRejectedError,
  WalletSigningFailedError,
  WalletUnavailableError,
} from './wallet/errors';
import { getWalletAdapter } from './wallet/adapters';
import { loadSession } from './wallet/session';
import { TARGET_NETWORK } from './wallet/network';
import type { RetryClassification } from './retryClassification';
import {
  markConfirmed,
  markExpired,
  markFailed,
  markPending,
  markSubmitted,
  type PaymentIntent,
  type StorageLike,
} from './paymentIntent';

export interface ClassifiedPaymentError {
  message: string;
  retryClassification: RetryClassification;
}

/**
 * Maps any error a payment submission can throw to a user-facing message
 * and a retry classification, so the UI branches on one typed decision
 * instead of ad hoc `instanceof`/string checks scattered per component.
 */
export function classifyPaymentError(error: unknown): ClassifiedPaymentError {
  if (
    error instanceof WalletRejectedError ||
    error instanceof WalletDisconnectedError ||
    error instanceof WalletUnavailableError ||
    error instanceof WalletSigningFailedError ||
    error instanceof WalletNetworkMismatchError ||
    error instanceof RpcUnavailableError ||
    error instanceof RpcTimeoutError ||
    error instanceof TransactionFailedError ||
    error instanceof TransactionTimedOutError
  ) {
    return {
      message: error.message,
      retryClassification: error.retryClassification,
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Transaction failed',
    // Unknown shape — safest default is to let the user try again rather
    // than silently blocking retry on an error we don't recognize.
    retryClassification: 'retryable-safely',
  };
}

/**
 * Real wallet-signing step (issue #143) — resolves the connected wallet's
 * adapter (FreighterAdapter today; see wallet/adapters.ts) and asks it to
 * sign `xdr`, checking the wallet's network first so a mismatch is
 * surfaced as a typed WalletNetworkMismatchError rather than an opaque
 * submission failure. Throws WalletUnavailableError/
 * WalletNetworkMismatchError/WalletRejectedError/WalletDisconnectedError/
 * WalletSigningFailedError — all real, reachable through this exact call
 * site (paymentFlow.test.ts injects each via a mocked adapter/session).
 *
 * `xdr` is optional and a no-op when omitted: building the actual deposit/
 * early-exit transaction (via sdks/typescript's YieldLadder, issue #139)
 * is still blocked on the app depending on the SDK directly, which needs a
 * `pnpm install` to regenerate app/pnpm-lock.yaml correctly — this
 * environment can't safely run that (see placeholderSubmissionHash in
 * app/src/app/deposit/page.tsx for the identical, already-documented
 * blocker). The no-op path preserves today's callers unchanged; the moment
 * a caller has a real XDR to pass, this exercises the complete real
 * signing pipeline instead.
 */
export async function requestWalletSignature(xdr?: string): Promise<void> {
  if (!xdr) return;

  const session = loadSession();
  if (!session) {
    throw new WalletUnavailableError();
  }

  const adapter = getWalletAdapter(session.provider);
  if (adapter.checkNetwork) {
    const { matches, actual } = await adapter.checkNetwork(TARGET_NETWORK);
    if (!matches) {
      throw new WalletNetworkMismatchError(TARGET_NETWORK, actual);
    }
  }

  await adapter.signTransaction(xdr, {
    network: session.account.network,
    accountToSign: session.account.publicKey,
  });
}

export interface PaymentSubmissionDeps {
  requestWalletSignature: () => Promise<void>;
  /** Submits the payment and resolves with the transaction hash. */
  submit: (idempotencyKey: string) => Promise<string>;
  waitForTransaction: typeof waitForTransaction;
  storage?: StorageLike;
}

export const defaultPaymentSubmissionDeps: Pick<
  PaymentSubmissionDeps,
  'requestWalletSignature' | 'waitForTransaction'
> = {
  requestWalletSignature,
  waitForTransaction,
};

export interface PaymentSubmissionResult {
  intent: PaymentIntent;
  status: 'confirmed' | 'failed' | 'expired';
  message: string | null;
}

/**
 * Runs one payment attempt — deposit, withdraw, or early-exit; the
 * orchestration is identical for all three — from `awaiting` (an intent
 * already transitioned to `awaiting_signature`) through to a terminal
 * outcome, persisting each transition via paymentIntent.ts exactly as the
 * two components' previous separate inline versions did.
 *
 * `deps` is injected so tests can supply a signer/submit/wait that throws a
 * specific, real error and assert the resulting classification — see
 * paymentFlow.test.ts. This is what makes the deposit and early-exit
 * failure UI states reachable via real, injected failures rather than only
 * a hardcoded/manual trigger (issue #142 acceptance criteria).
 */
export async function runPaymentSubmission(
  awaiting: PaymentIntent,
  deps: PaymentSubmissionDeps,
  timeoutMs = 20_000,
): Promise<PaymentSubmissionResult> {
  try {
    await deps.requestWalletSignature();

    const txHash = await deps.submit(awaiting.key);
    const submitted = markSubmitted(awaiting, txHash, deps.storage);
    const pending = markPending(submitted, deps.storage);

    await deps.waitForTransaction(txHash, { timeoutMs });

    const confirmed = markConfirmed(pending, deps.storage);
    return { intent: confirmed, status: 'confirmed', message: null };
  } catch (error) {
    if (error instanceof TransactionTimedOutError) {
      // Friendlier than the raw classified message ("Timed out waiting for
      // transaction <hash> to confirm") — this is the ambiguous, ongoing-
      // uncertainty case (see TransactionTimedOutError's own doc comment),
      // worth explaining rather than just restating the hash.
      const message =
        'Could not confirm this transaction in time. It may still complete — check back before retrying.';
      const expired = markExpired(awaiting, message, deps.storage);
      return { intent: expired, status: 'expired', message };
    }

    const classified = classifyPaymentError(error);
    const failed = markFailed(awaiting, classified.message, deps.storage);
    return { intent: failed, status: 'failed', message: classified.message };
  }
}
