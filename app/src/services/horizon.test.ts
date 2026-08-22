import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  checkUsdcTrustline,
  AccountNotFoundError,
  HorizonUnavailableError,
} from './horizon';

function mockFetchOnce(response: Partial<Response> & { ok: boolean; status: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({}),
      ...response,
    }),
  );
}

describe('checkUsdcTrustline (issue #143)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports not-configured without making a network call when no issuer is set', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await checkUsdcTrustline('GADDR', 'USDC', undefined);

    expect(result).toEqual({ configured: false, hasTrustline: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports hasTrustline: true when a matching balance line is present', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          { asset_type: 'native', balance: '10' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '0' },
        ],
      }),
    });

    const result = await checkUsdcTrustline('GADDR', 'USDC', 'GISSUER');

    expect(result).toEqual({ configured: true, hasTrustline: true });
  });

  it('reports hasTrustline: false when no matching balance line is present', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ balances: [{ asset_type: 'native', balance: '10' }] }),
    });

    const result = await checkUsdcTrustline('GADDR', 'USDC', 'GISSUER');

    expect(result).toEqual({ configured: true, hasTrustline: false });
  });

  it('does not match a same-code balance from a different issuer', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        balances: [
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GDIFFERENT', balance: '5' },
        ],
      }),
    });

    const result = await checkUsdcTrustline('GADDR', 'USDC', 'GISSUER');

    expect(result.hasTrustline).toBe(false);
  });

  it('throws AccountNotFoundError for an unfunded account', async () => {
    mockFetchOnce({ ok: false, status: 404 });

    await expect(checkUsdcTrustline('GADDR', 'USDC', 'GISSUER')).rejects.toThrow(
      AccountNotFoundError,
    );
  });

  it('throws HorizonUnavailableError on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    await expect(checkUsdcTrustline('GADDR', 'USDC', 'GISSUER')).rejects.toThrow(
      HorizonUnavailableError,
    );
  });

  it('throws HorizonUnavailableError on a non-404 error status', async () => {
    mockFetchOnce({ ok: false, status: 503 });

    await expect(checkUsdcTrustline('GADDR', 'USDC', 'GISSUER')).rejects.toThrow(
      HorizonUnavailableError,
    );
  });
});
