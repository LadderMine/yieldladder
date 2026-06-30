'use client';

import { useState } from 'react';

import { ExternalLink } from '../infoPages';
import styles from '../info-pages.module.css';

const contracts = {
  testnet: [
    { name: 'Vault Factory', address: 'CC_PENDING_TESTNET', role: 'Creates and configures vault tiers' },
    { name: 'Strategy', address: 'CC_PENDING_TESTNET', role: 'Routes liquidity into the Stellar AMM strategy' },
    { name: 'Share Token', address: 'CC_PENDING_TESTNET', role: 'Tracks weighted vault share accounting' },
    { name: 'Bounty Harvester', address: 'CC_PENDING_TESTNET', role: 'Executes harvests and applies keeper bounty rules' },
  ],
  mainnet: [
    { name: 'Vault Factory', address: 'Pending mainnet deployment', role: 'Awaiting audit and launch approval' },
    { name: 'Strategy', address: 'Pending mainnet deployment', role: 'Awaiting audit and launch approval' },
    { name: 'Share Token', address: 'Pending mainnet deployment', role: 'Awaiting audit and launch approval' },
    { name: 'Bounty Harvester', address: 'Pending mainnet deployment', role: 'Awaiting audit and launch approval' },
  ],
};

type Network = keyof typeof contracts;

function stellarExpertUrl(network: Network, address: string) {
  return `https://stellar.expert/explorer/${network}/contract/${address}`;
}

export default function ContractsClient() {
  const [network, setNetwork] = useState<Network>('testnet');

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Deployment registry</h2>
            <p className={styles.muted}>Default view shows testnet contract identifiers from the deployment manifest.</p>
          </div>
          <div className={styles.toggle} role="tablist" aria-label="Network">
            {(['testnet', 'mainnet'] as Network[]).map((item) => (
              <button
                key={item}
                type="button"
                className={network === item ? styles.activeToggle : styles.toggleButton}
                onClick={() => setNetwork(item)}
                aria-pressed={network === item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Address</th>
                <th>Role</th>
                <th>Explorer</th>
              </tr>
            </thead>
            <tbody>
              {contracts[network].map((contract) => (
                <tr key={`${network}-${contract.name}`}>
                  <td>{contract.name}</td>
                  <td>
                    <span className={styles.code}>{contract.address}</span>
                  </td>
                  <td>{contract.role}</td>
                  <td>
                    {network === 'testnet' ? (
                      <ExternalLink href={stellarExpertUrl(network, contract.address)}>
                        Open in Stellar Expert
                      </ExternalLink>
                    ) : (
                      <span className={styles.muted}>Explorer pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.twoColumn}>
          <article className={styles.card}>
            <h3>Testnet status</h3>
            <p>Testnet deployment slots are reserved in the manifest and should be verified on Stellar Expert when concrete contract IDs are published.</p>
          </article>
          <article className={styles.card}>
            <h3>Mainnet status</h3>
            <p>Mainnet deployment remains pending until audit, formal verification, and final launch controls are complete.</p>
          </article>
        </div>
      </section>
    </>
  );
}
