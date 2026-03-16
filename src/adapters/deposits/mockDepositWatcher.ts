// Mock Deposit Watcher - Simulates on-chain deposit detection
// In Phase 3, replace with real Base chain monitoring

import type { DepositWatcher, DepositEvent, DepositWatcherStatus } from './types';

type DepositCallback = (event: DepositEvent) => void;

export const mockDepositWatcher: DepositWatcher = {
  name: 'Mock Deposit Watcher',

  watchAddress(_address: string, _token: string, _network: string): void {
    // No-op in mock — dev tools trigger simulated deposits
    console.log(`[MockWatcher] Watching ${_address} for ${_token} on ${_network}`);
  },

  unwatchAddress(_address: string): void {
    console.log(`[MockWatcher] Unwatching ${_address}`);
  },

  async getTransactionStatus(txHash: string): Promise<{
    status: DepositWatcherStatus;
    confirmations: number;
    confirmedAt?: string;
  }> {
    // Mock: always returns confirmed after a simulated delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'CONFIRMED',
      confirmations: 12,
      confirmedAt: new Date().toISOString(),
    };
  },

  onDeposit(callback: DepositCallback): () => void {
    // In mock mode, this does nothing — deposits are triggered via dev tools
    // Return unsubscribe function
    return () => {};
  },
};
