import type { Tier, TierParams } from '../lib/constants';

interface VaultCardProps {
  tier: Tier;
  params: TierParams;
}

export default function VaultCard({ tier, params }: VaultCardProps) {
  return (
    <div>
      <h2>{tier}</h2>
      <dl>
        <dt>Lock multiplier</dt>
        <dd>{params.lockMultiplier}x</dd>
        <dt>Early-exit fee</dt>
        <dd>{(params.earlyExitFee * 100).toFixed(2)}%</dd>
        <dt>Min deposit</dt>
        <dd>{params.minDeposit} USDC</dd>
      </dl>
    </div>
  );
}
