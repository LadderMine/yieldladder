import type { Metadata } from 'next';

import { InfoShell } from '../infoPages';
import ContractsClient from './ContractsClient';

export const metadata: Metadata = {
  title: 'Contracts - YieldLadder',
  description: 'YieldLadder contract deployment registry with testnet explorer links and mainnet status.',
};

export default function ContractsPage() {
  return (
    <InfoShell
      eyebrow="Registry"
      title="Contracts"
      lead="A transparent deployment registry for users who want to verify contract roles, addresses, and network status before interacting with YieldLadder."
    >
      <ContractsClient />
    </InfoShell>
  );
}
