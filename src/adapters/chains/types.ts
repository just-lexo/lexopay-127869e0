// Chain Adapter Interface
// This defines the contract for blockchain integrations
// In Phase 3, this will be implemented with real blockchain providers

export interface DepositAddress {
  address: string;
  network: string;
  token: string;
  expiresAt?: Date;
}

export interface TransactionStatus {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  requiredConfirmations: number;
  amount?: string;
  token?: string;
}

export interface ChainAdapter {
  name: string;
  chainId: number;
  
  // Generate a deposit address for a user
  generateDepositAddress(userId: string, token: string): Promise<DepositAddress>;
  
  // Check transaction status
  getTransactionStatus(txHash: string): Promise<TransactionStatus>;
  
  // Get token balance for an address
  getBalance(address: string, token: string): Promise<string>;
  
  // Validate an address format
  isValidAddress(address: string): boolean;
}

// Supported tokens
export const SUPPORTED_TOKENS = ['USDT', 'USDC'] as const;
export type SupportedToken = typeof SUPPORTED_TOKENS[number];

// Supported networks
export const SUPPORTED_NETWORKS = [
  { id: 'base', name: 'Base', chainId: 8453, isActive: true },
  { id: 'ethereum', name: 'Ethereum', chainId: 1, isActive: false },
  { id: 'polygon', name: 'Polygon', chainId: 137, isActive: false },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, isActive: false },
] as const;

export type NetworkId = typeof SUPPORTED_NETWORKS[number]['id'];
