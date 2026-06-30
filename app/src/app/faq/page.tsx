import type { Metadata } from 'next';

import { InfoShell } from '../infoPages';
import styles from '../info-pages.module.css';

export const metadata: Metadata = {
  title: 'FAQ - YieldLadder',
  description: 'Common questions about YieldLadder vaults, wallets, deposits, risk, and taxes.',
};

const faqs = [
  {
    question: 'What is YieldLadder?',
    answer:
      'YieldLadder is a non-custodial Soroban protocol for time-locked USDC vaults on Stellar. Deposits are routed into curated AMM liquidity strategies, and realized trading-fee yield is distributed by share units.',
  },
  {
    question: 'Which vault tiers are planned?',
    answer:
      'The landing page currently presents Flex, 3-month, 6-month, and 12-month vault tiers. Longer locks receive larger share multipliers and may have higher minimum deposits.',
  },
  {
    question: 'What are the current minimum deposits?',
    answer:
      'The current interface shows 1 USDC for Flex, 50 USDC for 3-month, 100 USDC for 6-month, and 250 USDC for 12-month vaults.',
  },
  {
    question: 'Which wallets are supported?',
    answer:
      'The app is built around Stellar-compatible wallets, with Freighter support present in the current interface. Additional wallet support should be verified against the latest release notes before mainnet deposits.',
  },
  {
    question: 'Is yield guaranteed?',
    answer:
      'No. Yield depends on AMM trading fees and market activity. Smart contract risk, impermanent loss, stablecoin depeg risk, network risk, and regulatory risk can all affect outcomes.',
  },
  {
    question: 'Can I exit a locked vault early?',
    answer:
      'Early exit support is part of the vault model, but locked tiers can charge a fee. Users should check the final contract parameters before depositing.',
  },
  {
    question: 'Is this tax advice?',
    answer:
      'No. YieldLadder pages are technical product information only. Users should consult a qualified tax professional for their jurisdiction.',
  },
];

export default function FaqPage() {
  return (
    <InfoShell
      eyebrow="Questions"
      title="FAQ"
      lead="Short answers for users checking the protocol before connecting a wallet or evaluating a vault tier."
    >
      <section className={styles.section}>
        <div className={styles.accordion}>
          {faqs.map((faq) => (
            <details key={faq.question} className={styles.accordionItem}>
              <summary>{faq.question}</summary>
              <div className={styles.accordionBody}>{faq.answer}</div>
            </details>
          ))}
        </div>
      </section>
    </InfoShell>
  );
}
