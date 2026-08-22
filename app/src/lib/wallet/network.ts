import type { StellarNetwork } from './types';

/**
 * The network this app targets — used to detect a wallet pointed at a
 * different one (issue #143) before the user attempts to sign. Mirrors
 * services/rpc.ts's NEXT_PUBLIC_SOROBAN_RPC_URL default (the public
 * testnet endpoint), so the default here is 'testnet' too.
 */
export const TARGET_NETWORK: StellarNetwork =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetwork | undefined) ??
  'testnet';
