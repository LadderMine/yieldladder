import { describe, it, expect } from 'vitest';
import { getWalletAdapter, IMPLEMENTED_WALLET_PROVIDERS } from './adapters';
import { FreighterAdapter } from './freighterAdapter';
import { WalletUnavailableError } from './errors';

describe('getWalletAdapter (issue #143)', () => {
  it('resolves freighter to a FreighterAdapter instance', () => {
    expect(getWalletAdapter('freighter')).toBeInstanceOf(FreighterAdapter);
  });

  it('always resolves freighter to the same instance (no per-call re-creation)', () => {
    expect(getWalletAdapter('freighter')).toBe(getWalletAdapter('freighter'));
  });

  it('throws a clear, typed error for lobstr rather than silently falling back to another wallet', () => {
    expect(() => getWalletAdapter('lobstr')).toThrow(WalletUnavailableError);
    expect(() => getWalletAdapter('lobstr')).toThrow(/LOBSTR/);
  });

  it('throws a clear, typed error for xbull rather than silently falling back to another wallet', () => {
    expect(() => getWalletAdapter('xbull')).toThrow(WalletUnavailableError);
    expect(() => getWalletAdapter('xbull')).toThrow(/xBull/);
  });

  it('lists exactly the implemented providers', () => {
    expect(IMPLEMENTED_WALLET_PROVIDERS).toEqual(['freighter']);
  });
});
