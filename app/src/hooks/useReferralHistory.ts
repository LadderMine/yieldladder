'use client';

import { useState, useEffect } from 'react';
import type { Tier } from './usePosition';

export interface ReferralEvent {
  id: string;
  referrer: string;
  referred: string;
  tier: Tier;
  amount: number; // in stroops
  ledger: number;
  date: string;
}

export interface TopReferrer {
  referrer: string;
  totalVolume: number; // in USDC
  depositCount: number;
}

export interface DepositSizeComparison {
  /** Average deposit size for referred users, in USDC */
  avgReferredDeposit: number;
  /** Average deposit size for organic (non-referred) users, in USDC */
  avgOrganicDeposit: number;
  /** Number of referred deposits used in the average */
  referredDepositCount: number;
  /** Number of organic deposits used in the average */
  organicDepositCount: number;
  /** Total volume from referred deposits, in USDC */
  referredVolume: number;
  /** Total volume from organic deposits, in USDC */
  organicVolume: number;
}

export interface ReferralHistoryData {
  events: ReferralEvent[];
  isLoading: boolean;
  error: string | null;
  trackedVisits: number;
  confirmedDeposits: number;
  conversionRate: number; // percentage
  topReferrers: TopReferrer[];
  depositSizeComparison: DepositSizeComparison;
}

function getTrackedVisits(): number {
  if (typeof window === 'undefined') return 0;
  const overallVisitKey = 'yieldladder:visits:overall';
  return parseInt(localStorage.getItem(overallVisitKey) || '0', 10);
}

// Convert stroops (7 decimals) to USDC
function stroopsToUsdc(stroops: number): number {
  return stroops / 10_000_000;
}

export function useReferralHistory(limit = 20, topN = 5): ReferralHistoryData {
  const [data, setData] = useState<ReferralHistoryData>({
    events: [],
    isLoading: true,
    error: null,
    trackedVisits: 0,
    confirmedDeposits: 0,
    conversionRate: 0,
    topReferrers: [],
    depositSizeComparison: {
      avgReferredDeposit: 0,
      avgOrganicDeposit: 0,
      referredDepositCount: 0,
      organicDepositCount: 0,
      referredVolume: 0,
      organicVolume: 0,
    },
  });

  useEffect(() => {
    // TODO: Replace with real event indexer queries for ReferralCredited events
    const now = Date.now();
    const tiers: Tier[] = ['Flex', 'L3', 'L6', 'L12'];
    // Use multiple referrers to test top referrers list
    const referrers = ['REF0...ABCD', 'REF1...EFGH', 'REF2...IJKL', 'REF3...MNOP', 'REF4...QRST'];
    const events: ReferralEvent[] = Array.from({ length: limit }, (_, i) => {
      const amount = 100_000_000 + Math.floor(Math.abs(Math.sin(i * 2.1)) * 1_000_000_000); // 10-110 USDC (7 decimals)
      return {
        id: `referral-${i}`,
        referrer: referrers[i % referrers.length],
        referred: `NEW${i}...WXYZ`,
        tier: tiers[i % tiers.length],
        amount,
        ledger: 5_000_000 - i * 17_280,
        date: new Date(now - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });
    
    // Calculate per-referrer stats
    const referrerStats = new Map<string, { totalVolume: number; depositCount: number }>();
    for (const event of events) {
      const volume = stroopsToUsdc(event.amount);
      const current = referrerStats.get(event.referrer) || { totalVolume: 0, depositCount: 0 };
      referrerStats.set(event.referrer, {
        totalVolume: current.totalVolume + volume,
        depositCount: current.depositCount + 1,
      });
    }
    
    // Create top referrers list, sorted by total volume descending
    const topReferrers: TopReferrer[] = Array.from(referrerStats.entries())
      .map(([referrer, stats]) => ({ referrer, ...stats }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, topN);
    
    const trackedVisits = getTrackedVisits();
    const confirmedDeposits = events.length;
    // Conversion rate: (confirmed deposits / tracked visits) * 100, handle division by zero
    const conversionRate = trackedVisits > 0 
      ? (confirmedDeposits / trackedVisits) * 100 
      : 0;

    // --- Referred vs. Organic average deposit size comparison ---
    // Referred deposits: use the referral events (amounts in stroops).
    const referredVolumeUsdc = events.reduce(
      (sum, e) => sum + stroopsToUsdc(e.amount),
      0,
    );
    const referredDepositCount = events.length;
    // Average referred deposit = total referred volume / number of referred deposits
    const avgReferredDeposit = referredDepositCount > 0
      ? referredVolumeUsdc / referredDepositCount
      : 0;

    // Organic deposits: deposits made without a referral link.
    // TODO: Replace with real event indexer queries for non-referred Deposit events.
    // Mock organic deposit amounts in stroops (7 decimals), range ~25-400 USDC.
    // Organic users tend to deposit larger amounts on average since they
    // include institutional / power users who don't need a referral incentive.
    const organicCount = Math.max(1, Math.floor(limit * 3.5));
    const organicAmountsStroops: number[] = Array.from({ length: organicCount }, (_, i) => {
      // 250 USDC (250_000_000 stroops) up to ~400 USDC (4_000_000_000 stroops)
      return 250_000_000 + Math.floor(Math.abs(Math.cos(i * 1.7)) * 3_750_000_000);
    });
    const organicVolumeUsdc = organicAmountsStroops.reduce(
      (sum, amt) => sum + stroopsToUsdc(amt),
      0,
    );
    const organicDepositCount = organicAmountsStroops.length;
    // Average organic deposit = total organic volume / number of organic deposits
    const avgOrganicDeposit = organicDepositCount > 0
      ? organicVolumeUsdc / organicDepositCount
      : 0;

    const depositSizeComparison: DepositSizeComparison = {
      avgReferredDeposit,
      avgOrganicDeposit,
      referredDepositCount,
      organicDepositCount,
      referredVolume: referredVolumeUsdc,
      organicVolume: organicVolumeUsdc,
    };

    setData({ 
      events, 
      isLoading: false, 
      error: null, 
      trackedVisits, 
      confirmedDeposits, 
      conversionRate,
      topReferrers,
      depositSizeComparison,
    });
  }, [limit, topN]);

  return data;
}
