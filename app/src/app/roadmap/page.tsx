import type { Metadata } from 'next';

import { InfoShell } from '../infoPages';
import styles from '../info-pages.module.css';

export const metadata: Metadata = {
  title: 'Roadmap - YieldLadder',
  description: 'Current YieldLadder roadmap across shipped work, in-progress work, and planned launch milestones.',
};

const columns = [
  {
    title: 'Shipped',
    status: 'Current',
    items: [
      'Landing page, vault tier presentation, legal pages, and dashboard scaffold.',
      'Internal audit report with all listed medium and low findings resolved.',
      'Security and bounty policy published in the repository.',
      'Deployment manifests prepared for testnet and mainnet tracking.',
    ],
  },
  {
    title: 'In progress',
    status: 'Buildout',
    items: [
      'Soroban contract and SDK work for deposits, withdrawals, shares, harvesting, and strategy flows.',
      'Trust pages for learn, FAQ, audit, contracts, and roadmap visibility.',
      'Testnet deployment verification and user-facing contract address publication.',
      'Formal verification and external audit preparation.',
    ],
  },
  {
    title: 'Planned',
    status: 'Next',
    items: [
      'External audit completion before mainnet launch.',
      'Mainnet deployment after audit, verification, and launch controls.',
      'Expanded wallet support and user onboarding improvements.',
      'Post-launch analytics, keeper monitoring, and risk reporting.',
    ],
  },
];

export default function RoadmapPage() {
  return (
    <InfoShell
      eyebrow="Launch plan"
      title="Roadmap"
      lead="YieldLadder is pre-mainnet. The current focus is finishing core protocol implementation, publishing transparent launch materials, and completing audit gates before production deposits."
    >
      <section className={styles.section}>
        <div className={styles.timeline}>
          {columns.map((column) => (
            <article key={column.title} className={styles.card}>
              <span className={styles.pill}>{column.status}</span>
              <h3>{column.title}</h3>
              <ul className={styles.timelineList}>
                {column.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.twoColumn}>
          <article className={styles.finding}>
            <h3>Current state</h3>
            <p>Contracts are not marked as mainnet deployed in the repository manifest. Users should treat YieldLadder as pre-launch until final deployment addresses and audit outcomes are published.</p>
          </article>
          <article className={styles.finding}>
            <h3>Launch gate</h3>
            <p>Mainnet readiness depends on verified contract deployment, external review, and clear risk communication for depositors.</p>
          </article>
        </div>
      </section>
    </InfoShell>
  );
}
