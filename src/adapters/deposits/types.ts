// Deposit Watcher Adapter Interface
// Phase 3 will implement real on-chain monitoring

export type DepositWatcherStatus = 'PENDING' | 'DETECTED' | 'CONFIRMED' | 'FAILED';

export interface DepositEvent {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  token: string;
  network: string;
  amount: number;
  confirmations: number;
  detectedAt: string;
  confirmedAt?: string;
}

export interface DepositWatcher {
  name: string;

  // Start watching an address for deposits
  watchAddress(address: string, token: string, network: string): void;

  // Stop watching an address
  unwatchAddress(address: string): void;

  // Check if a tx is confirmed
  getTransactionStatus(txHash: string): Promise<{
    status: DepositWatcherStatus;
    confirmations: number;
    confirmedAt?: string;
  }>;

  // Subscribe to deposit events
  onDeposit(callback: (event: DepositEvent) => void): () => void;
}
