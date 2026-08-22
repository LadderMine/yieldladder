import type { WalletAdapter, WalletProvider } from './types';
import { FreighterAdapter } from './freighterAdapter';
import { WalletUnavailableError } from './errors';

const freighterAdapter = new FreighterAdapter();

/**
 * Explicit per-provider adapter resolution (issue #143's multi-extension
 * edge case): which provider's API responds is the user's stated choice,
 * never "whichever extension happened to load first" — WalletButton
 * always calls this with the id the user clicked, not a guess.
 *
 * LOBSTR and xBull have no adapter implementation yet. That's an
 * intentional, explicitly-scoped-out follow-up (see WalletButton's UI and
 * the module README), not a silent "coming soon" — selecting one throws a
 * clear, typed error rather than silently falling back to a different
 * wallet's signature.
 */
export function getWalletAdapter(provider: WalletProvider): WalletAdapter {
  if (provider === 'freighter') {
    return freighterAdapter;
  }
  throw new WalletUnavailableError(
    provider === 'lobstr' ? 'LOBSTR' : 'xBull',
  );
}

export const IMPLEMENTED_WALLET_PROVIDERS: readonly WalletProvider[] = ['freighter'];
