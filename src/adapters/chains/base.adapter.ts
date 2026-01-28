// Base Chain Adapter - Mock Implementation
// In Phase 3, this will integrate with actual Base network

import type { ChainAdapter, DepositAddress, TransactionStatus } from './types';

// Generate a mock deposit address
function generateMockAddress(): string {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

export const baseAdapter: ChainAdapter = {
  name: 'Base',
  chainId: 8453,

  async generateDepositAddress(userId: string, token: string): Promise<DepositAddress> {
    // Mock: In production, this would call a wallet service to generate a unique address
    return {
      address: generateMockAddress(),
      network: 'base',
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  },

  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    // Mock: Returns pending status - use dev tools to simulate confirmation
    return {
      txHash,
      status: 'pending',
      confirmations: 0,
      requiredConfirmations: 12,
    };
  },

  async getBalance(address: string, token: string): Promise<string> {
    // Mock: Always returns 0 - balances are managed in Supabase
    return '0';
  },

  isValidAddress(address: string): boolean {
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },
};
