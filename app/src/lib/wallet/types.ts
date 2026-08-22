export type WalletProvider = 'freighter' | 'lobstr' | 'xbull';
export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

export interface WalletAccount {
  publicKey: string;
  network: StellarNetwork;
}

export interface WalletSession {
  account: WalletAccount;
  provider: WalletProvider;
  connectedAt: number;
  expiresAt?: number;
}

export interface SignTransactionOptions {
  network?: StellarNetwork;
  accountToSign?: string;
}

export interface WalletAdapter {
  connect(): Promise<WalletAccount>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  signTransaction(xdr: string, opts?: SignTransactionOptions): Promise<string>;
  /**
   * Reports whether the wallet's currently-selected network matches
   * `expected`, so a mismatch (issue #143) can be surfaced before the
   * user attempts to sign rather than discovered as an opaque submission
   * failure. Optional: an adapter that can't cheaply check this (or has
   * only one possible network) may omit it.
   */
  checkNetwork?(
    expected: StellarNetwork,
  ): Promise<{ matches: boolean; actual: StellarNetwork }>;
}