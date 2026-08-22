import { describe, it, expect, vi, afterEach } from 'vitest';
import { estimateNetworkFee } from './feeEstimate';

function jsonRpcResponse(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: '2.0', id: 1, result }),
  };
}

function stubFetchOnce(response: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('estimateNetworkFee (issue #143)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an "up to" ceiling in XLM derived from the p99 inclusion fee', async () => {
    stubFetchOnce(
      jsonRpcResponse({
        sorobanInclusionFee: {
          max: '2000000',
          min: '100',
          mode: '100',
          p10: '100',
          p99: '1000000', // 0.1 XLM in stroops
          transactionCount: '500',
          ledgerCount: 10,
        },
        inclusionFee: {
          max: '100',
          min: '100',
          mode: '100',
          p10: '100',
          p99: '100',
          transactionCount: '500',
          ledgerCount: 10,
        },
        latestLedger: 123,
      }),
    );

    const estimate = await estimateNetworkFee();

    expect(estimate.available).toBe(true);
    expect(estimate.display).toBe('up to ~0.10000 XLM');
    expect(estimate.note).toMatch(/network fee/i);
    // Must clarify this is a network fee, not a YieldLadder fee — the
    // whole point of replacing the hardcoded string (issue #143).
    expect(estimate.note).toMatch(/not a yieldladder fee/i);
  });

  it('falls back to the classic inclusionFee distribution when sorobanInclusionFee is absent', async () => {
    stubFetchOnce(
      jsonRpcResponse({
        inclusionFee: {
          max: '500000',
          min: '100',
          mode: '100',
          p10: '100',
          p99: '500000', // 0.05 XLM
          transactionCount: '10',
          ledgerCount: 5,
        },
        latestLedger: 123,
      }),
    );

    const estimate = await estimateNetworkFee();

    expect(estimate.available).toBe(true);
    expect(estimate.display).toBe('up to ~0.05000 XLM');
  });

  it('reports unavailable (never a fabricated number) when the response has no usable distribution', async () => {
    stubFetchOnce(jsonRpcResponse({ latestLedger: 123 }));

    const estimate = await estimateNetworkFee();

    expect(estimate).toEqual({
      available: false,
      display: 'Fee estimate unavailable',
      note: expect.stringContaining('wallet before you sign'),
    });
  });

  it('reports unavailable rather than throwing when the RPC call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const estimate = await estimateNetworkFee();

    expect(estimate.available).toBe(false);
  });

  it('reports unavailable rather than throwing on a malformed p99 value', async () => {
    stubFetchOnce(
      jsonRpcResponse({
        inclusionFee: {
          max: '0',
          min: '0',
          mode: '0',
          p10: '0',
          p99: 'not-a-number',
          transactionCount: '0',
          ledgerCount: 0,
        },
        latestLedger: 123,
      }),
    );

    const estimate = await estimateNetworkFee();

    expect(estimate.available).toBe(false);
  });
});
