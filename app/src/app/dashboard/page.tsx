import VaultCard from '../../components/VaultCard';
import { VAULT_TIERS, type Tier } from '../../lib/constants';

export default function DashboardPage() {
  const tiers = Object.keys(VAULT_TIERS) as Tier[];

  return (
    <main>
      <h1>Dashboard</h1>
      <div>
        {tiers.map((tier) => (
          <VaultCard key={tier} tier={tier} params={VAULT_TIERS[tier]} />
        ))}
      </div>
    </main>
  );
}
