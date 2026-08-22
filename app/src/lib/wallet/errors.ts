import type { RetryClassification } from '../retryClassification';

/**
 * The connected wallet declined to sign — a user action, not a network or
 * contract failure. Trivially retryable: nothing was built that can't be
 * rebuilt, the user can simply approve next time (issue #142).
 */
export class WalletRejectedError extends Error {
  readonly retryClassification: RetryClassification = 'retryable-safely';
  constructor() {
    super('You declined the request in your wallet.');
    this.name = 'WalletRejectedError';
  }
}

/**
 * The wallet dropped its connection partway through signing (extension
 * locked, session expired) — distinct from a rejection: the user didn't
 * decline, the connection itself was lost.
 */
export class WalletDisconnectedError extends Error {
  readonly retryClassification: RetryClassification = 'retryable-safely';
  constructor() {
    super('Wallet disconnected before it could sign. Reconnect and try again.');
    this.name = 'WalletDisconnectedError';
  }
}

/** No supported wallet extension was detected in the browser. */
export class WalletUnavailableError extends Error {
  readonly retryClassification: RetryClassification = 'retryable-safely';
  constructor(provider = 'wallet') {
    super(`No ${provider} extension detected. Install it and reconnect.`);
    this.name = 'WalletUnavailableError';
  }
}

/**
 * The wallet's `signTransaction` rejected for a reason that's neither a
 * recognized decline nor a recognized disconnect (e.g. the extension
 * itself errored internally). Mirrors the SDK's identical class
 * (sdks/typescript/src/errors.ts) — nothing was ever submitted, so
 * retrying is safe.
 */
export class WalletSigningFailedError extends Error {
  readonly retryClassification: RetryClassification = 'retryable-safely';
  constructor(readonly rawError: string) {
    super('Signing failed. Please try again.');
    this.name = 'WalletSigningFailedError';
  }
}

/**
 * The connected wallet's network doesn't match what the app targets
 * (e.g. Freighter set to mainnet while the app targets testnet, or vice
 * versa) — surfaced before the user attempts to sign, not discovered as
 * an opaque submission failure (issue #143).
 */
export class WalletNetworkMismatchError extends Error {
  readonly retryClassification: RetryClassification = 'retryable-safely';
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `Your wallet is set to ${actual}, but this app runs on ${expected}. Switch networks in your wallet and reconnect.`,
    );
    this.name = 'WalletNetworkMismatchError';
  }
}
