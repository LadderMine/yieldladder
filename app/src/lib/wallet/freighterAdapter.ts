import type {
  SignTransactionOptions,
  StellarNetwork,
  WalletAccount,
  WalletAdapter,
} from './types';
import {
  WalletDisconnectedError,
  WalletRejectedError,
  WalletSigningFailedError,
  WalletUnavailableError,
} from './errors';

/**
 * The subset of `window.freighter`'s injected API this adapter uses.
 * Freighter's `signTransaction` has returned both a bare string and a
 * `{ signedTxXdr }` object across versions — `signTransaction` below
 * accepts either rather than assuming one.
 */
export interface FreighterApi {
  isConnected(): Promise<{ isConnected: boolean }>;
  requestAccess(): Promise<{ address: string; error?: string }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  signTransaction(
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string; address?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string } | string>;
}

function getFreighterApi(): FreighterApi {
  if (typeof window === 'undefined') {
    throw new WalletUnavailableError('Freighter');
  }
  const api = (window as typeof window & { freighter?: FreighterApi }).freighter;
  if (!api) {
    throw new WalletUnavailableError('Freighter');
  }
  return api;
}

function toStellarNetwork(network: string): StellarNetwork {
  const upper = network.toUpperCase();
  if (upper === 'TESTNET') return 'testnet';
  if (upper === 'FUTURENET') return 'futurenet';
  return 'mainnet';
}

/**
 * Maps a raw error thrown by the Freighter extension to the app's typed
 * wallet-error taxonomy. Mirrors the TypeScript SDK's identical
 * `TransactionPipeline.classifySignerError` (sdks/typescript/src/
 * transactions.ts) — same regexes, same disconnect-before-reject
 * ordering — since no wallet extension shares a single error shape, this
 * matches on common phrasing rather than a type. Kept in sync by
 * convention, the same way the two packages' error classes are.
 */
export function classifyFreighterError(error: unknown): Error {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (/disconnect|not connected|no wallet|no active/.test(message)) {
    return new WalletDisconnectedError();
  }
  if (/reject|declin|deni|cancel|user closed/.test(message)) {
    return new WalletRejectedError();
  }
  return new WalletSigningFailedError(error instanceof Error ? error.message : String(error));
}

/**
 * Real `WalletAdapter` for Freighter (issue #143) — until now, nothing in
 * the app ever called `signTransaction`; `WalletButton` only invoked
 * Freighter's connect-time methods directly. `signTransaction`'s shape is
 * deliberately identical to the SDK's `Signer` interface
 * (sdks/typescript/src/types.ts) so an instance of this class can be
 * passed straight through as `signer` once the app depends on the SDK
 * directly — see paymentFlow.ts's `requestWalletSignature`.
 */
export class FreighterAdapter implements WalletAdapter {
  async connect(): Promise<WalletAccount> {
    const api = getFreighterApi();
    let address: string;
    try {
      const result = await api.requestAccess();
      if (result.error) throw new Error(result.error);
      address = result.address;
    } catch (error) {
      throw classifyFreighterError(error);
    }
    const { network } = await api.getNetwork();
    return { publicKey: address, network: toStellarNetwork(network) };
  }

  async disconnect(): Promise<void> {
    // Freighter has no programmatic disconnect/revoke call — access is
    // granted and revoked from the extension's own UI. The app's session
    // (wallet/session.ts) is what we actually control; WalletButton clears
    // that alongside calling this.
  }

  async isConnected(): Promise<boolean> {
    try {
      const { isConnected } = await getFreighterApi().isConnected();
      return isConnected;
    } catch {
      return false;
    }
  }

  async signTransaction(
    xdr: string,
    opts: SignTransactionOptions = {},
  ): Promise<string> {
    const api = getFreighterApi();
    let result: { signedTxXdr: string; signerAddress?: string } | string;
    try {
      result = await api.signTransaction(xdr, {
        address: opts.accountToSign,
      });
    } catch (error) {
      throw classifyFreighterError(error);
    }
    return typeof result === 'string' ? result : result.signedTxXdr;
  }

  /**
   * Wallet-set-to-the-wrong-network detection (issue #143's edge case):
   * called before signing, not discovered as an opaque submission
   * failure. `expected` and the wallet's actual network are both
   * lowercase `StellarNetwork` values.
   */
  async checkNetwork(
    expected: StellarNetwork,
  ): Promise<{ matches: boolean; actual: StellarNetwork }> {
    const { network } = await getFreighterApi().getNetwork();
    const actual = toStellarNetwork(network);
    return { matches: actual === expected, actual };
  }
}
