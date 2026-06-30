import type { Metadata } from 'next';

import { ExternalLink, InfoShell } from '../infoPages';
import styles from '../info-pages.module.css';

export const metadata: Metadata = {
  title: 'Audit - YieldLadder',
  description: 'YieldLadder internal audit status, findings, resolutions, and security resources.',
};

const findings = [
  {
    id: 'M-01',
    severity: 'Medium',
    title: 'Share checkpoint gap on compounding deposits',
    resolution: 'Resolved in a3f1c2d',
  },
  {
    id: 'M-02',
    severity: 'Medium',
    title: 'Early-exit fee precision loss on small deposits',
    resolution: 'Resolved in b7e4a91',
  },
  {
    id: 'M-03',
    severity: 'Medium',
    title: 'Governance timelock could be reset during pending parameter change',
    resolution: 'Resolved in c2d8f05',
  },
  {
    id: 'L-01',
    severity: 'Low',
    title: 'Strategy allocation cap re-check missing after rebalance',
    resolution: 'Resolved in d9a3b12',
  },
  {
    id: 'L-02',
    severity: 'Low',
    title: 'Harvester cooldown used ledger timestamp instead of ledger sequence',
    resolution: 'Resolved in e5c7f44',
  },
];

export default function AuditPage() {
  return (
    <InfoShell
      eyebrow="Security"
      title="Audit status"
      lead="The current repository documents an internal review with no critical or high findings, plus a bug bounty program for responsible security disclosures."
    >
      <section className={styles.section}>
        <div className={styles.grid}>
          <article className={styles.metric}>
            <span className={styles.metricValue}>0</span>
            <h3>Critical or high findings</h3>
            <p>Internal audit summary reports no critical or high severity findings.</p>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>5</span>
            <h3>Resolved findings</h3>
            <p>Three medium and two low findings are listed with resolution commits.</p>
          </article>
          <article className={styles.metric}>
            <span className={styles.metricValue}>Q2</span>
            <h3>External audit window</h3>
            <p>The roadmap targets an external audit before mainnet launch.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Internal audit findings</h2>
          <span className={styles.pill}>All resolved</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Severity</th>
                <th>Finding</th>
                <th>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.id}>
                  <td>{finding.id}</td>
                  <td>{finding.severity}</td>
                  <td>{finding.title}</td>
                  <td>{finding.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Security resources</h2>
        <p>
          YieldLadder keeps review notes and bounty scope in the public repository so users can inspect the protocol status before interacting with contracts.
        </p>
        <div className={styles.linkList}>
          <ExternalLink href="https://github.com/LadderMine/yieldladder/blob/main/audit/internal-2026-01.md">
            Internal audit report
          </ExternalLink>
          <ExternalLink href="https://github.com/LadderMine/yieldladder/blob/main/security/bounty.md">
            Bug bounty policy
          </ExternalLink>
        </div>
      </section>
    </InfoShell>
  );
}
