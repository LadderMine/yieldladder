import styles from './page.module.css';
import { StatsBar } from '@/components/StatsBar';

const VAULTS = [
  { name: 'Flex', lock: 'No lock', multiplier: '1.00×', exitFee: '0%', minDeposit: '1 USDC', featured: false, badge: null },
  { name: 'L3', lock: '3 months', multiplier: '1.05×', exitFee: '0.50%', minDeposit: '50 USDC', featured: false, badge: null },
  { name: 'L6', lock: '6 months', multiplier: '1.15×', exitFee: '1.25%', minDeposit: '100 USDC', featured: true, badge: 'Popular' },
  { name: 'L12', lock: '12 months', multiplier: '1.40×', exitFee: '3.00%', minDeposit: '250 USDC', featured: true, badge: 'Max Yield' },
] as const;

const FEATURES = [
  {
    icon: '⛓',
    title: '100% On-Chain Yield',
    body: 'Yield comes exclusively from Stellar AMM trading fees. No CeFi venues, no anchor lending, no rehypothecation.',
  },
  {
    icon: '🔒',
    title: 'Non-Custodial',
    body: 'Contracts are immutable. No admin can modify rules or move funds. Your position is permanently on-chain.',
  },
  {
    icon: '🛡',
    title: 'Hard Exposure Caps',
    body: 'No single pool exceeds 35% of strategy assets. Allocation changes require a 72-hour timelock with Guardian veto.',
  },
  {
    icon: '🔄',
    title: 'Auto-Compounding',
    body: 'Harvested yield re-deploys back into the strategy automatically. Your position grows without any manual action.',
  },
] as const;

export default function Home() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navLogo}>YieldLadder</span>
        <div className={styles.navLinks}>
          <a href="/analytics" className={styles.navLink}>Analytics</a>
          <a href="#vaults" className={styles.navCta}>Explore Vaults</a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          {/* <div className={styles.heroBadge}>Live on Stellar · Soroban</div> */}
          <h1 className={styles.heroTitle}>
            Earn More.<br />Lock Smarter.
          </h1>
          <p className={styles.heroSub}>
            Deposit USDC into time-locked vaults. YieldLadder auto-routes capital into curated
            Stellar AMM pools and compounds yield back into your position, fully on-chain, no middlemen.
          </p>
          <div className={styles.heroCtas}>
            <a href="#vaults" className={styles.btnPrimary}>View Vaults</a>
            <a
              href="https://github.com/LadderMine/yieldladder"
              className={styles.btnSecondary}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read Docs
            </a>
          </div>
        </div>
        <div className={styles.heroBg} aria-hidden="true" />
      </section>

      <StatsBar />

      <section className={styles.vaults} id="vaults">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Choose Your Vault</h2>
          <p className={styles.sectionSub}>
            Longer locks earn higher share-weight multipliers, capturing a larger slice of every harvest.
            Early exit is always available; fees are redistributed to remaining depositors, not the protocol.
          </p>
        </div>
        <div className={styles.vaultGrid}>
          {VAULTS.map((v) => (
            <div
              key={v.name}
              className={`${styles.vaultCard} ${v.featured ? styles.vaultCardFeatured : ''}`}
            >
              {v.badge && <span className={styles.vaultBadge}>{v.badge}</span>}
              <div className={styles.vaultName}>{v.name}</div>
              <div className={styles.vaultMultiplier}>{v.multiplier}</div>
              <div className={styles.vaultMultLabel}>share multiplier</div>
              <div className={styles.vaultMeta}>
                <div className={styles.vaultMetaRow}>
                  <span>Lock duration</span>
                  <span>{v.lock}</span>
                </div>
                <div className={styles.vaultMetaRow}>
                  <span>Early-exit fee</span>
                  <span>{v.exitFee}</span>
                </div>
                <div className={styles.vaultMetaRow}>
                  <span>Min deposit</span>
                  <span>{v.minDeposit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.how}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
        </div>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <h3 className={styles.stepTitle}>Deposit USDC</h3>
            <p className={styles.stepBody}>
              Choose a vault tier and deposit USDC. Your position is non-transferable
              and tied to your wallet, with no position tokens to manage or secure.
            </p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <h3 className={styles.stepTitle}>Yield Accrues</h3>
            <p className={styles.stepBody}>
              Capital is routed to curated Stellar AMM pools. Trading fees compound
              automatically at every harvest cycle, with no manual claiming needed.
            </p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <h3 className={styles.stepTitle}>Withdraw at Maturity</h3>
            <p className={styles.stepBody}>
              After your lock expires, withdraw principal plus accrued yield in full.
              Early exit is available at any time for a fee returned to co-depositors.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Built for Transparency</h2>
          <p className={styles.sectionSub}>
            Every rule is enforced on-chain. No admin keys. No upgrade paths. No trust required.
          </p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>YieldLadder</div>
        <p className={styles.footerTagline}>Time-locked USDC vaults on Soroban · Built on Stellar</p>
        <div className={styles.footerLinks}>
          <a href="https://github.com/LadderMine/yieldladder" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="mailto:security@yieldladder.dev">Security</a>
        </div>
        <p className={styles.footerDisclaimer}>
          Smart contract risk applies. Yield is not guaranteed and may be affected by impermanent loss.{' '}
          Read the full{' '}
          <a href="https://github.com/LadderMine/yieldladder#risk-model" target="_blank" rel="noopener noreferrer">
            risk model
          </a>{' '}
          before depositing.
        </p>
      </footer>
    </div>
  );
}
