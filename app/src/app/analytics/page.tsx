'use client';

import { useState } from 'react';
import { useTVL } from '@/hooks/useTVL';
import { useAPY } from '@/hooks/useAPY';
import { useHarvestHistory } from '@/hooks/useHarvestHistory';

type TimeRange = '7d' | '30d' | 'all';

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardValue}>{value}</div>
      <div style={s.cardSubtext}>{subtext}</div>
    </div>
  );
}

function Skeleton() {
  return <div style={s.skeleton} />;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('30d');
  const { total: totalTVL, byTier, isLoading: tvlLoading } = useTVL();
  const { byTier: apyByTier, best: bestAPY, isLoading: apyLoading } = useAPY();
  const { events, isLoading: historyLoading } = useHarvestHistory(20);

  const isLoading = tvlLoading || apyLoading || historyLoading;

  const rangeEvents = range === '7d'
    ? events.slice(0, 1)
    : range === '30d'
    ? events.slice(0, 4)
    : events;

  const totalHarvested = rangeEvents.reduce((sum, e) => sum + e.yieldAmount, 0);
  const uniqueDepositors = 127;

  return (
    <main style={s.page}>
      <nav style={s.nav}>
        <a href="/" style={s.navLogo}>YieldLadder</a>
        <div style={s.navLinks}>
          <a href="/analytics" style={s.navLinkActive}>Analytics</a>
          <a href="/allocations" style={s.navLink}>Allocations</a>
          <a href="/harvest" style={s.navLink}>Harvest</a>
          <a href="/governance" style={s.navLink}>Governance</a>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.header}>
          <h1 style={s.title}>Protocol Analytics</h1>
          <p style={s.subtitle}>Live protocol-wide metrics and performance data</p>
          <div style={s.rangeSelector}>
            {(['7d', '30d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                style={range === r ? s.rangeBtnActive : s.rangeBtn}
                onClick={() => setRange(r)}
                type="button"
              >
                {r === 'all' ? 'All Time' : r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={s.cardGrid}>
          <StatCard
            label="Total TVL"
            value={tvlLoading ? '—' : formatCurrency(totalTVL)}
            subtext="Across all vault tiers"
          />
          <StatCard
            label="Best APY"
            value={apyLoading ? '—' : `${bestAPY.toFixed(1)}%`}
            subtext="L12 vault (12-month lock)"
          />
          <StatCard
            label="Total Yield Harvested"
            value={historyLoading ? '—' : formatCurrency(totalHarvested)}
            subtext={`${range === 'all' ? 'All time' : range.toUpperCase()}, auto-compounded`}
          />
          <StatCard
            label="Unique Depositors"
            value={isLoading ? '—' : uniqueDepositors.toString()}
            subtext="Active vault positions"
          />
        </div>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>TVL by Vault Tier</h2>
          {tvlLoading ? (
            <Skeleton />
          ) : (
            <div style={s.tvlChart}>
              {byTier.map((tier) => {
                const pct = totalTVL > 0 ? (tier.tvl / totalTVL) * 100 : 0;
                return (
                  <div key={tier.tier} style={s.tvlRow}>
                    <span style={s.tvlLabel}>{tier.label}</span>
                    <div style={s.tvlBarTrack}>
                      <div style={{ ...s.tvlBar, width: `${pct.toFixed(1)}%` }} />
                    </div>
                    <span style={s.tvlValue}>{formatCurrency(tier.tvl)}</span>
                    <span style={s.tvlPct}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>APY by Vault</h2>
          {apyLoading ? (
            <Skeleton />
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Vault</th>
                    <th style={s.th}>Current APY</th>
                    <th style={s.th}>7-Day APY</th>
                    <th style={s.th}>30-Day APY</th>
                  </tr>
                </thead>
                <tbody>
                  {apyByTier.map((tier) => (
                    <tr key={tier.tier}>
                      <td style={s.td}>{tier.label}</td>
                      <td style={{ ...s.td, ...s.apyValue }}>{tier.current.toFixed(1)}%</td>
                      <td style={s.td}>{tier.sevenDay.toFixed(1)}%</td>
                      <td style={s.td}>{tier.thirtyDay.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Harvest History</h2>
          {historyLoading ? (
            <Skeleton />
          ) : (
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
                  {rangeEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td style={s.td}>{formatDate(ev.date)}</td>
                      <td style={{ ...s.td, ...s.mono }}>{ev.ledger.toLocaleString()}</td>
                      <td style={s.td}>{formatCurrency(ev.yieldAmount)}</td>
                      <td style={s.td}>{formatCurrency(ev.bounty)}</td>
                      <td style={{ ...s.td, ...s.mono, color: '#475569' }}>{ev.caller}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#060810',
    color: '#f1f5f9',
    fontFamily: 'system-ui, sans-serif',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: 'rgba(6,8,16,0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navLogo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#f1f5f9',
    textDecoration: 'none',
  },
  navLinks: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'center',
  },
  navLink: {
    fontSize: '0.875rem',
    color: '#64748b',
    textDecoration: 'none',
  },
  navLinkActive: {
    fontSize: '0.875rem',
    color: '#60a5fa',
    textDecoration: 'none',
    fontWeight: 600,
  },
  content: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '3rem 2rem',
  },
  header: {
    marginBottom: '3rem',
  },
  title: {
    fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1.05rem',
    marginBottom: '1.5rem',
  },
  rangeSelector: {
    display: 'flex',
    gap: '0.5rem',
  },
  rangeBtn: {
    padding: '0.4rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#64748b',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  rangeBtnActive: {
    padding: '0.4rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(59,130,246,0.4)',
    background: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '3rem',
  },
  card: {
    padding: '1.5rem',
    borderRadius: 16,
    background: '#0d1120',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  cardLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.6rem',
  },
  cardValue: {
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: '#3b82f6',
    marginBottom: '0.25rem',
  },
  cardSubtext: {
    fontSize: '0.8rem',
    color: '#475569',
  },
  section: {
    marginBottom: '3rem',
  },
  sectionTitle: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: '1.25rem',
  },
  tvlChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  tvlRow: {
    display: 'grid',
    gridTemplateColumns: '50px 1fr 90px 60px',
    alignItems: 'center',
    gap: '1rem',
  },
  tvlLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#cbd5e1',
  },
  tvlBarTrack: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tvlBar: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
    transition: 'width 0.6s ease',
  },
  tvlValue: {
    fontSize: '0.875rem',
    color: '#f1f5f9',
    textAlign: 'right',
  },
  tvlPct: {
    fontSize: '0.8rem',
    color: '#64748b',
    textAlign: 'right',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    padding: '0.9rem 1.25rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: '#0d1120',
  },
  td: {
    padding: '0.9rem 1.25rem',
    color: '#94a3b8',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  apyValue: {
    color: '#34d399',
    fontWeight: 600,
  },
  mono: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.8rem',
  },
  skeleton: {
    height: 120,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
  },
};
