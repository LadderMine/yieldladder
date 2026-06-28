'use client';

import { useAllocations } from '@/hooks/useAllocations';

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function ExposureBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#ef4444' : pct >= 25 ? '#f59e0b' : '#22c55e';
  return (
    <div style={s.barTrack}>
      <div style={{ ...s.bar, width: `${Math.min((pct / 35) * 100, 100)}%`, background: color }} />
      <div style={s.capLine} />
    </div>
  );
}

export default function AllocationsPage() {
  const { pools, totalAllocated, isLoading } = useAllocations();

  return (
    <main style={s.page}>
      <nav style={s.nav}>
        <a href="/" style={s.navLogo}>YieldLadder</a>
        <div style={s.navLinks}>
          <a href="/analytics" style={s.navLink}>Analytics</a>
          <a href="/allocations" style={s.navLinkActive}>Allocations</a>
          <a href="/harvest" style={s.navLink}>Harvest</a>
          <a href="/governance" style={s.navLink}>Governance</a>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.header}>
          <h1 style={s.title}>Pool Allocations</h1>
          <p style={s.subtitle}>
            Live strategy allocation across AMM pools. No single pool may exceed 35% of strategy assets.
          </p>
          {!isLoading && (
            <p style={s.totalLine}>
              Total allocated: <strong style={s.totalValue}>{formatCurrency(totalAllocated)}</strong>
            </p>
          )}
        </div>

        {isLoading ? (
          <div style={s.skeleton} />
        ) : (
          <>
            <div style={s.legend}>
              <span><span style={dot('#22c55e')} />Normal (&lt;25%)</span>
              <span><span style={dot('#f59e0b')} />Approaching cap (25–30%)</span>
              <span><span style={dot('#ef4444')} />Near cap (&ge;30%)</span>
              <span style={s.legendNote}>Bar width scaled to 35% cap · dashed line = cap</span>
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Pair</th>
                    <th style={s.th}>Allocated (USDC)</th>
                    <th style={s.th}>% of Strategy</th>
                    <th style={s.th}>vs 35% Cap</th>
                    <th style={s.th}>Exposure</th>
                    <th style={s.th}>30d Fee APY</th>
                    <th style={s.th}>IL %</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((pool) => {
                    const ilColor = pool.ilPct > 2 ? '#f59e0b' : '#64748b';
                    return (
                      <tr key={pool.id}>
                        <td style={{ ...s.td, fontWeight: 600, color: '#f1f5f9' }}>{pool.pair}</td>
                        <td style={s.td}>{formatCurrency(pool.allocatedUSDC)}</td>
                        <td style={s.td}>{pool.strategyPct.toFixed(1)}%</td>
                        <td style={{ ...s.td, color: '#22c55e' }}>+{pool.capHeadroom.toFixed(1)}%</td>
                        <td style={{ ...s.td, minWidth: 160 }}>
                          <ExposureBar pct={pool.strategyPct} />
                        </td>
                        <td style={{ ...s.td, color: '#34d399' }}>{pool.feeAPY30d.toFixed(1)}%</td>
                        <td style={{ ...s.td, color: ilColor }}>
                          {pool.ilPct > 2 ? '⚠ ' : ''}{pool.ilPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function dot(color: string): React.CSSProperties {
  return { display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 4 };
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#060810', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 100 },
  navLogo: { fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' },
  navLinks: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
  navLink: { fontSize: '0.875rem', color: '#64748b', textDecoration: 'none' },
  navLinkActive: { fontSize: '0.875rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 },
  content: { maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem' },
  header: { marginBottom: '2rem' },
  title: { fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' },
  subtitle: { color: '#94a3b8', fontSize: '1rem', marginBottom: '0.75rem' },
  totalLine: { fontSize: '0.9rem', color: '#64748b', margin: 0 },
  totalValue: { color: '#f1f5f9' },
  skeleton: { height: 300, borderRadius: 12, background: 'rgba(255,255,255,0.04)' },
  legend: { display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' },
  legendNote: { color: '#475569' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { padding: '0.9rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d1120', whiteSpace: 'nowrap' },
  td: { padding: '0.9rem 1.25rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  barTrack: { position: 'relative', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 999, transition: 'width 0.5s ease' },
  capLine: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, borderRight: '2px dashed rgba(255,255,255,0.3)' },
};
