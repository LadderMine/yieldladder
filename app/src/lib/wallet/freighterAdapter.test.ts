import { describe, it, expect, vi, afterEach } from 'vitest';
import { FreighterAdapter, classifyFreighterError } from './freighterAdapter';
import {
  WalletDisconnectedError,
  WalletRejectedError,
  WalletSigningFailedError,
  WalletUnavailableError,
} from './errors';
import type { FreighterApi } from './freighterAdapter';

function stubFreighter(api: Partial<FreighterApi>) {
  vi.stubGlobal('window', { freighter: api });
}

describe('classifyFreighterError (issue #143)', () => {
  it('maps a decline/reject-phrased message to WalletRejectedError', () => {
    expect(classifyFreighterError(new Error('User rejected access'))).toBeInstanceOf(
      WalletRejectedError,
    );
    expect(classifyFreighterError(new Error('User declined the request'))).toBeInstanceOf(
      WalletRejectedError,
    );
  });

  it('maps a disconnect-phrased message to WalletDisconnectedError', () => {
    expect(
      classifyFreighterError(new Error('Wallet is not connected')),
    ).toBeInstanceOf(WalletDisconnectedError);
  });

  it('prioritizes disconnect over reject when a message matches both, mirroring the SDK ordering', () => {
    // "not connected" would also loosely read as a decline in casual
    // phrasing — the SDK's classifySignerError checks disconnect first,
    // and this must match it exactly (see this file's doc comment).
    expect(
      classifyFreighterError(new Error('no active session, request rejected')),
    ).toBeInstanceOf(WalletDisconnectedError);
  });

  it('falls back to WalletSigningFailedError for an unrecognized message', () => {
    const result = classifyFreighterError(new Error('internal extension error'));
    expect(result).toBeInstanceOf(WalletSigningFailedError);
    expect((result as WalletSigningFailedError).rawError).toBe(
      'internal extension error',
    );
  });
});

describe('FreighterAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('connect', () => {
    it('throws WalletUnavailableError when no Freighter extension is present', async () => {
      vi.stubGlobal('window', {});
      const adapter = new FreighterAdapter();

      await expect(adapter.connect()).rejects.toThrow(WalletUnavailableError);
    });

    it('returns the connected account on success', async () => {
      stubFreighter({
        requestAccess: vi.fn().mockResolvedValue({ address: 'GADDR' }),
        getNetwork: vi
          .fn()
          .mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'x' }),
      });
      const adapter = new FreighterAdapter();

      const account = await adapter.connect();

      expect(account).toEqual({ publicKey: 'GADDR', network: 'testnet' });
    });

    it('maps a requestAccess rejection to a typed wallet error', async () => {
      stubFreighter({
        requestAccess: vi.fn().mockRejectedValue(new Error('User declined access')),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.connect()).rejects.toThrow(WalletRejectedError);
    });

    it('maps an error field on a resolved requestAccess response the same way', async () => {
      stubFreighter({
        requestAccess: vi.fn().mockResolvedValue({ address: '', error: 'User declined access' }),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.connect()).rejects.toThrow(WalletRejectedError);
    });
  });

  describe('isConnected', () => {
    it('returns the extension-reported value', async () => {
      stubFreighter({ isConnected: vi.fn().mockResolvedValue({ isConnected: true }) });
      const adapter = new FreighterAdapter();

      await expect(adapter.isConnected()).resolves.toBe(true);
    });

    it('returns false rather than throwing when no extension is present', async () => {
      vi.stubGlobal('window', {});
      const adapter = new FreighterAdapter();

      await expect(adapter.isConnected()).resolves.toBe(false);
    });
  });

  describe('signTransaction', () => {
    it('unwraps a { signedTxXdr } response', async () => {
      stubFreighter({
        signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'AAAAsigned' }),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.signTransaction('AAAAunsigned')).resolves.toBe(
        'AAAAsigned',
      );
    });

    it('accepts a bare string response', async () => {
      stubFreighter({ signTransaction: vi.fn().mockResolvedValue('AAAAsigned') });
      const adapter = new FreighterAdapter();

      await expect(adapter.signTransaction('AAAAunsigned')).resolves.toBe(
        'AAAAsigned',
      );
    });

    it('maps a signing rejection to WalletRejectedError', async () => {
      stubFreighter({
        signTransaction: vi.fn().mockRejectedValue(new Error('User cancelled')),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.signTransaction('AAAAunsigned')).rejects.toThrow(
        WalletRejectedError,
      );
    });
  });

  describe('checkNetwork', () => {
    it('reports a match when the wallet network equals expected', async () => {
      stubFreighter({
        getNetwork: vi.fn().mockResolvedValue({ network: 'TESTNET', networkPassphrase: 'x' }),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.checkNetwork('testnet')).resolves.toEqual({
        matches: true,
        actual: 'testnet',
      });
    });

    it('reports a mismatch with the actual network', async () => {
      stubFreighter({
        getNetwork: vi.fn().mockResolvedValue({ network: 'PUBLIC', networkPassphrase: 'x' }),
      });
      const adapter = new FreighterAdapter();

      await expect(adapter.checkNetwork('testnet')).resolves.toEqual({
        matches: false,
        actual: 'mainnet',
      });
    });
  });
});
