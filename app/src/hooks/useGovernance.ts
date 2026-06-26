'use client';

import { useState, useEffect } from 'react';

export type ProposalStatus = 'pending' | 'executed' | 'vetoed';

export interface Proposal {
  id: string;
  action: string;
  proposedBy: string;
  proposedAt: string;
  timelockExpiry: string;
  status: ProposalStatus;
}

export interface GovernanceData {
  active: Proposal[];
  history: Proposal[];
  isLoading: boolean;
  error: string | null;
}

export function useGovernance(): GovernanceData {
  const [data, setData] = useState<GovernanceData>({
    active: [],
    history: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // TODO(GF-12): Replace with Governance contract Soroban RPC call
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const active: Proposal[] = [
      {
        id: 'prop-003',
        action: 'Increase XLM/USDC pool allocation cap from 30% to 35%',
        proposedBy: 'GSTRATEGIST001...XXXX',
        proposedAt: new Date(now - 2 * day).toISOString(),
        timelockExpiry: new Date(now + 2 * day).toISOString(),
        status: 'pending',
      },
      {
        id: 'prop-004',
        action: 'Add AQUA/XLM pool to approved strategy list',
        proposedBy: 'GSTRATEGIST001...XXXX',
        proposedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        timelockExpiry: new Date(now + day).toISOString(),
        status: 'pending',
      },
    ];

    const history: Proposal[] = [
      {
        id: 'prop-001',
        action: 'Set harvest cooldown to 7 days',
        proposedBy: 'GSTRATEGIST001...XXXX',
        proposedAt: new Date(now - 30 * day).toISOString(),
        timelockExpiry: new Date(now - 27 * day).toISOString(),
        status: 'executed',
      },
      {
        id: 'prop-002',
        action: 'Remove AQUA/USDC pool from strategy (low liquidity)',
        proposedBy: 'GSTRATEGIST001...XXXX',
        proposedAt: new Date(now - 60 * day).toISOString(),
        timelockExpiry: new Date(now - 57 * day).toISOString(),
        status: 'vetoed',
      },
    ];

    setData({ active, history, isLoading: false, error: null });
  }, []);

  return data;
}
