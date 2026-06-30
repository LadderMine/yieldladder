import type { Metadata } from 'next';

import { InfoShell } from '../infoPages';
import styles from '../info-pages.module.css';

export const metadata: Metadata = {
  title: 'Learn - YieldLadder',
  description: 'How YieldLadder time-locked USDC vaults, share units, harvesting, and early exits work.',
};

export default function LearnPage() {
  return (
    <InfoShell
      eyebrow="Protocol guide"
      title="How YieldLadder works"
      lead="YieldLadder routes USDC deposits into Stellar AMM liquidity, assigns weighted share units by lock tier, and compounds realized trading-fee yield back into vault positions."
    >
      <section className={styles.section}>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h3>Deposit USDC</h3>
            <p>Choose a vault tier, connect a Stellar wallet, and deposit USDC into the non-custodial Soroban contracts.</p>
          </article>
          <article className={styles.card}>
            <h3>Receive share units</h3>
            <p>Each deposit mints internal accounting shares. Longer lock tiers receive a higher multiplier and therefore a larger claim on harvested yield.</p>
          </article>
          <article className={styles.card}>
            <h3>Harvest AMM fees</h3>
            <p>Harvests realize trading-fee yield from the underlying Stellar AMM strategy and compound it back into vault accounting.</p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Worked share-unit example</h2>
          <span className={styles.pill}>Example numbers</span>
        </div>
        <div className={styles.example}>
          <article className={styles.metric}>
            <span className={styles.metricValue}>100</span>
            <h3>Flex shares</h3>
            <p>A 100 USDC Flex deposit uses a 1.00x multiplier, so it receives 100 share units.</p>
          </article>
          <div className={styles.operator}>vs</div>
          <article className={styles.metric}>
            <span className={styles.metricValue}>140</span>
            <h3>12-month shares</h3>
            <p>A 100 USDC 12-month deposit uses a 1.40x multiplier, so it receives 140 share units.</p>
          </article>
        </div>
        <p>
          If a harvest distributes 24 USDC across 240 total share units, the Flex position receives 10 USDC and the 12-month position receives 14 USDC. Both deposited the same principal, but the longer lock receives the larger yield allocation because it contributed more weighted shares.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.twoColumn}>
          <article className={styles.card}>
            <h3>Why the harvest bounty exists</h3>
            <p>Harvesting costs time and network fees. A small 10 bps bounty gives any keeper a reason to execute harvests promptly instead of relying on a single operator.</p>
          </article>
          <article className={styles.card}>
            <h3>Early exits</h3>
            <p>Locked tiers can include an early-exit fee. The fee is redistributed by the protocol rules instead of becoming a discretionary protocol revenue stream.</p>
          </article>
        </div>
      </section>
    </InfoShell>
  );
}
