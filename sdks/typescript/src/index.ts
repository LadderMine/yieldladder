export type { Tier, Network, YieldLadderOptions, Position } from './types';

export class YieldLadder {
  constructor(_options: import('./types').YieldLadderOptions) {
    // Full implementation in subsequent commits.
  }

  async deposit(_params: { tier: import('./types').Tier; amount: string }): Promise<void> {
    throw new Error('Not implemented');
  }

  async withdraw(_params: { tier: import('./types').Tier }): Promise<void> {
    throw new Error('Not implemented');
  }

  async earlyExit(_params: { tier: import('./types').Tier }): Promise<void> {
    throw new Error('Not implemented');
  }

  async position(_address: string): Promise<import('./types').Position> {
    throw new Error('Not implemented');
  }
}
