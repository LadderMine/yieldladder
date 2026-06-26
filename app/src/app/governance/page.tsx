'use client';

import { useState, useEffect } from 'react';
import { useGovernance, type Proposal } from '@/hooks/useGovernance';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelockCountdown({ expiry }: { expiry: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiry).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  if (remaining <= 0) {
    return <span style={{ color: '#22c55e' }}>Timelock elapsed — executable</span>;
  }

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return (
    <span>
      {d > 0 ? `${d}d ` : ''}
      {h > 0 ? `${h}h ` : ''}
      {m}m remaining
    </span>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const isExpired = new Date(proposal.timelockExpiry).getTime() < Date.now();

  return (
    <div style={s.proposalCard}>
      <div style={s.proposalAction}>{proposal.action}</div>
      <div style={s.proposalMeta}>
        <span>
          Proposed by <code style={s.address}>{proposal.proposedBy}</code>
        </span>
        <span style={s.metaDot}>·</span>
        <span>{formatDate(proposal.proposedAt)}</span>
      </div>
      <div style={s.timelockRow}>
        <span style={s.timelockLabel}>Timelock expiry:</span>
        <span style={s.timelockValue}>
          <TimelockCountdown expiry={proposal.timelockExpiry} />
        </span>
      </div>
      <div style={s.proposalActions}>
        <button
          style={s.vetoBtn}
          disabled
          type="button"
          title="Connect Guardian Multisig wallet to veto"
        >
          Veto
        </button>
        {isExpired && (
          <button style={s.executeBtn} type="button">
            Execute
          </button>
        )}
      </div>
    </div>
  );
}

export default function GovernancePage() {
  const { active, history, isLoading } = useGovernance();

  return (
    <main style={s.page}>
      <nav style={s.nav}>
        <a href="/" style={s.navLogo}>YieldLadder</a>
        <div style={s.navLinks}>
          <a href="/analytics" style={s.navLink}>Analytics</a>
          <a href="/allocations" style={s.navLink}>Allocations</a>
          <a href="/harvest" style={s.navLink}>Harvest</a>
          <a href="/governance" style={s.navLinkActive}>Governance</a>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.header}>
          <h1 style={s.title}>Governance</h1>
          <p style={s.subtitle}>
            All strategy changes require a 72-hour timelock. Guardian Multisig members can veto
            within the window; anyone can execute after it elapses.
          </p>
        </div>

        {isLoading ? (
          <div style={s.skeleton} />
        ) : (
          <>
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Active Proposals</h2>
              {active.length === 0 ? (
                <p style={s.emptyState}>No active proposals.</p>
              ) : (
                <div style={s.proposalList}>
                  {active.map((p) => (
                    <ProposalCard key={p.id} proposal={p} />
                  ))}
                </div>
              )}
            </section>

            <section style={s.section}>
              <h2 style={s.sectionTitle}>Proposal History</h2>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>ID</th>
                      <th style={s.th}>Action</th>
                      <th style={s.th}>Proposed</th>
                      <th style={s.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p) => (
                      <tr key={p.id}>
                        <td style={{ ...s.td, ...s.mono }}>{p.id}</td>
                        <td style={s.td}>{p.action}</td>
                        <td style={s.td}>{formatDate(p.proposedAt)}</td>
                        <td style={s.td}>
                          <span style={p.status === 'executed' ? s.badgeExecuted : s.badgeVetoed}>
                            {p.status === 'executed' ? 'Executed' : 'Vetoed'}
                          </span>
                        </td>
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
  subtitle: { color: '#94a3b8', fontSize: '1rem', maxWidth: 680, lineHeight: 1.6 },
  skeleton: { height: 300, borderRadius: 12, background: 'rgba(255,255,255,0.04)' },
  section: { marginBottom: '3rem' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
  emptyState: { color: '#475569', fontSize: '0.9rem' },
  proposalList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  proposalCard: { background: '#0d1120', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' },
  proposalAction: { fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.75rem', lineHeight: 1.4 },
  proposalMeta: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' },
  address: { fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 4 },
  metaDot: { color: '#334155' },
  timelockRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' },
  timelockLabel: { fontWeight: 600 },
  timelockValue: { color: '#94a3b8' },
  proposalActions: { display: 'flex', gap: '0.75rem' },
  vetoBtn: { padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#64748b', fontSize: '0.875rem', fontWeight: 600, cursor: 'not-allowed' },
  executeBtn: { padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d1120' },
  td: { padding: '0.9rem 1.25rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  mono: { fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' },
  badgeExecuted: { display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', color: '#86efac', fontSize: '0.75rem', fontWeight: 600 },
  badgeVetoed: { display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 600 },
};
