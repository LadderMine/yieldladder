'use client';

import { useState, useEffect } from 'react';
import { useLastHarvest } from '@/hooks/useLastHarvest';

type TxState = 'idle' | 'pending' | 'confirmed' | 'failed';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Ready to harvest';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sec > 0 || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(' ');
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HarvestPage() {
  const { timestamp, ledger, cooldownRemaining, estimatedYield, history, isLoading } = useLastHarvest();
  const [remaining, setRemaining] = useState(cooldownRemaining);
  const [txState, setTxState] = useState<TxState>('idle');

  useEffect(() => {
    setRemaining(cooldownRemaining);
  }, [cooldownRemaining]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const canHarvest = remaining === 0;
  const estimatedBounty = estimatedYield * 0.001;

  function handleHarvest() {
    if (!canHarvest || txState !== 'idle') return;
    setTxState('pending');
    // TODO(GF-08): Call sdk.harvest() once SDK is implemented
    setTimeout(() => setTxState('confirmed'), 2000);
  }

  return (
    <main style={s.page}>
      <nav style={s.nav}>
        <a href="/" style={s.navLogo}>YieldLadder</a>
        <div style={s.navLinks}>
          <a href="/analytics" style={s.navLink}>Analytics</a>
          <a href="/allocations" style={s.navLink}>Allocations</a>
          <a href="/harvest" style={s.navLinkActive}>Harvest</a>
          <a href="/governance" style={s.navLink}>Governance</a>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.header}>
          <h1 style={s.title}>Harvest Yield</h1>
          <p style={s.subtitle}>
            Anyone can trigger a harvest once the cooldown elapses and earn 10 bps of harvested yield.
          </p>
        </div>

        {isLoading ? (
          <div style={s.skeleton} />
        ) : (
          <>
            <div style={s.statusCard}>
              <div style={s.statusGrid}>
                <div style={s.statusItem}>
                  <div style={s.statusLabel}>Last Harvest</div>
                  <div style={s.statusValue}>
                    {timestamp
                      ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </div>
                  {ledger && <div style={s.statusSub}>Ledger #{ledger.toLocaleString()}</div>}
                </div>

                <div style={s.statusItem}>
                  <div style={s.statusLabel}>Cooldown Remaining</div>
                  <div style={{ ...s.statusValue, color: canHarvest ? '#22c55e' : '#f1f5f9' }}>
                    {canHarvest ? 'Ready to harvest' : formatDuration(remaining)}
                  </div>
                </div>

                <div style={s.statusItem}>
                  <div style={s.statusLabel}>Estimated Harvestable Yield</div>
                  <div style={s.statusValue}>{formatCurrency(estimatedYield)}</div>
                </div>

                <div style={s.statusItem}>
                  <div style={s.statusLabel}>Your Estimated Bounty</div>
                  <div style={{ ...s.statusValue, color: '#34d399' }}>{formatCurrency(estimatedBounty)}</div>
                  <div style={s.statusSub}>10 bps of yield</div>
                </div>
              </div>

              <div style={s.harvestAction}>
                {txState === 'confirmed' ? (
                  <div style={s.successBox}>
                    Harvest confirmed! You earned approximately {formatCurrency(estimatedBounty)}.
                  </div>
                ) : (
                  <>
                    <button
                      style={canHarvest && txState === 'idle' ? s.harvestBtn : s.harvestBtnDisabled}
                      onClick={handleHarvest}
                      disabled={!canHarvest || txState === 'pending'}
                      type="button"
                    >
                      {txState === 'pending'
                        ? 'Confirming...'
                        : canHarvest
                        ? 'Harvest Now'
                        : `Cooldown: ${formatDuration(remaining)}`}
                    </button>
                    {txState === 'failed' && (
                      <p style={s.errorText}>Transaction failed. Please try again.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <section style={s.section}>
              <h2 style={s.sectionTitle}>Harvest History</h2>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Ledger</th>
                      <th style={s.th}>Yield Harvested</th>
                      <th style={s.th}>Bounty Paid</th>
                      <th style={s.th}>Caller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, i) => (
                      <tr key={i}>
                        <td style={s.td}>{formatDate(record.date)}</td>
                        <td style={{ ...s.td, ...s.mono }}>{record.ledger.toLocaleString()}</td>
                        <td style={s.td}>{formatCurrency(record.yieldAmount)}</td>
                        <td style={s.td}>{formatCurrency(record.bounty)}</td>
                        <td style={{ ...s.td, ...s.mono, color: '#475569' }}>{record.caller}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#060810', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 100 },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
  navLink: { fontSize: '0.875rem', color: '#64748b', textDecoration: 'none' },
  navLinkActive: { fontSize: '0.875rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 },
  content: { maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' },
  header: { marginBottom: '2rem' },
  title: { fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' },
  subtitle: { color: '#94a3b8', fontSize: '1rem', marginBottom: 0 },
  skeleton: { height: 300, borderRadius: 12, background: 'rgba(255,255,255,0.04)' },
  statusCard: { background: '#0d1120', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '2rem', marginBottom: '3rem' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2rem' },
  statusItem: {},
  statusLabel: { fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' },
  statusValue: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9' },
  statusSub: { fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' },
  harvestAction: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' },
  harvestBtn: { padding: '0.8rem 2.5rem', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' },
  harvestBtnDisabled: { padding: '0.8rem 2.5rem', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#475569', fontSize: '1rem', fontWeight: 700, cursor: 'not-allowed' },
  successBox: { padding: '1rem 1.5rem', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac', fontSize: '0.95rem', fontWeight: 600 },
  errorText: { marginTop: '0.75rem', color: '#f87171', fontSize: '0.875rem' },
  section: { marginBottom: '3rem' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d1120', whiteSpace: 'nowrap' },
  td: { padding: '0.9rem 1.25rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' },
};
