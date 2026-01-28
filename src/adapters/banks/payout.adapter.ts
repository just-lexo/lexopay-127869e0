// Bank Payout Adapter - Mock Implementation
// In Phase 3, this will integrate with real payout providers (Flutterwave, Paystack, etc.)

import type { 
  BankPayoutAdapter, 
  Bank, 
  AccountVerification, 
  PayoutRequest, 
  PayoutResult 
} from './types';
import { NIGERIAN_BANKS } from './types';

// Mock name generator for account verification
const mockNames = [
  'John Adebayo Okonkwo',
  'Amina Bello Ibrahim',
  'Chukwuemeka David Nwosu',
  'Fatima Yusuf Mohammed',
  'Oluwaseun Grace Adeyemi',
  'Emeka Paul Okafor',
  'Ngozi Mary Eze',
  'Abdullahi Musa Sani',
];

function getRandomName(): string {
  return mockNames[Math.floor(Math.random() * mockNames.length)];
}

function generateReference(): string {
  return `LXP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export const mockPayoutAdapter: BankPayoutAdapter = {
  name: 'Mock Payout Provider',

  async getBanks(): Promise<Bank[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return NIGERIAN_BANKS;
  },

  async verifyAccount(accountNumber: string, bankCode: string): Promise<AccountVerification> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Basic validation
    if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      return {
        accountNumber,
        bankCode,
        accountName: '',
        isValid: false,
      };
    }

    return {
      accountNumber,
      bankCode,
      accountName: getRandomName(),
      isValid: true,
    };
  },

  async initiatePayout(request: PayoutRequest): Promise<PayoutResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      reference: request.reference || generateReference(),
      status: 'processing',
      message: 'Payout initiated successfully',
    };
  },

  async getPayoutStatus(reference: string): Promise<PayoutResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock: Always returns processing - use dev tools to change status
    return {
      reference,
      status: 'processing',
      message: 'Payout is being processed',
    };
  },
};
