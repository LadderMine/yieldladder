'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { WalletProvider, WalletSession } from '@/lib/wallet/types';
import {
  loadSession,
  clearSession,
  createSession,
  saveSession,
} from '@/lib/wallet/session';
import { getWalletAdapter, IMPLEMENTED_WALLET_PROVIDERS } from '@/lib/wallet/adapters';
import { TARGET_NETWORK } from '@/lib/wallet/network';

const PROVIDERS: { id: WalletProvider; label: string }[] = [
  { id: 'freighter', label: 'Freighter' },
  { id: 'lobstr', label: 'LOBSTR' },
  { id: 'xbull', label: 'xBull' },
];

export function WalletButton() {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkWarning, setNetworkWarning] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (stored) setSession(stored);
  }, []);

  async function connect(provider: WalletProvider): Promise<void> {
    setIsConnecting(true);
    setError(null);
    setNetworkWarning(null);
    setShowPicker(false);
    try {
      const adapter = getWalletAdapter(provider);
      const account = await adapter.connect();
      const s = createSession(account.publicKey, provider, account.network);
      saveSession(s);
      setSession(s);

      // Surfaced here, before the user ever reaches a signing prompt —
      // not discovered as an opaque submission failure later (issue #143).
      if (account.network !== TARGET_NETWORK) {
        setNetworkWarning(
          `Your wallet is set to ${account.network}, but this app runs on ${TARGET_NETWORK}. Switch networks in your wallet before depositing.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnect(): Promise<void> {
    if (session) {
      await getWalletAdapter(session.provider).disconnect();
    }
    clearSession();
    setSession(null);
    setError(null);
    setNetworkWarning(null);
  }

  const short = session
    ? `${session.account.publicKey.slice(0, 4)}…${session.account.publicKey.slice(-4)}`
    : null;

  return (
    <div style={styles.wrapper}>
      {error && <p style={styles.error}>{error}</p>}
      {networkWarning && <p style={styles.warning}>{networkWarning}</p>}

      {session ? (
        <div style={styles.connected}>
          <span style={styles.address}>{short}</span>
          <button style={styles.secondaryBtn} onClick={disconnect} type="button">
            Disconnect
          </button>
        </div>
      ) : (
        <>
          {showPicker && (
            <div style={styles.picker}>
              {PROVIDERS.map(({ id, label }) => {
                const implemented = IMPLEMENTED_WALLET_PROVIDERS.includes(id);
                return (
                  <button
                    key={id}
                    style={implemented ? styles.providerBtn : styles.providerBtnDisabled}
                    onClick={() => connect(id)}
                    type="button"
                    disabled={isConnecting || !implemented}
                    title={implemented ? undefined : `${label} support is planned — not yet available`}
                  >
                    {label}
                    {!implemented && <span style={styles.comingSoon}>Coming soon</span>}
                  </button>
                );
              })}
              <p style={styles.pickerNote}>
                Freighter is fully supported today. LOBSTR and xBull support is planned.
              </p>
            </div>
          )}
          <button
            style={styles.primaryBtn}
            onClick={() => setShowPicker((v) => !v)}
            type="button"
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  connected: { display: 'flex', alignItems: 'center', gap: 8 },
  address: { fontSize: '0.85rem', fontWeight: 600, color: '#1d4ed8' },
  error: { color: '#dc2626', fontSize: '0.8rem', margin: 0, maxWidth: 220 },
  warning: { color: '#b45309', fontSize: '0.8rem', margin: 0, maxWidth: 260 },
  picker: {
    position: 'absolute',
    top: '110%',
    right: 0,
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    zIndex: 10,
    minWidth: 200,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  primaryBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#1d4ed8',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  secondaryBtn: {
    padding: '0.4rem 0.8rem',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    color: '#374151',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  providerBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    backgroundColor: '#f9fafb',
    color: '#111827',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 500,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerBtnDisabled: {
    padding: '0.5rem 1rem',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    cursor: 'not-allowed',
    textAlign: 'left',
    fontWeight: 500,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comingSoon: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: '#9ca3af',
    background: '#e5e7eb',
    padding: '1px 6px',
    borderRadius: 10,
  },
  pickerNote: {
    fontSize: '0.72rem',
    color: '#6b7280',
    margin: '4px 2px 0',
    maxWidth: 220,
  },
};
