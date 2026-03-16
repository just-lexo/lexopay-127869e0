// Paystack Payout Adapter - Mock Implementation
// In Phase 3, this will call real Paystack Transfer API via Edge Functions

import type {
  PayoutProviderAdapter,
  PayoutBank,
  AccountVerificationResult,
  PayoutRecipient,
  PayoutInitiation,
  PayoutStatus,
} from './types';
import { NIGERIAN_BANKS } from '../banks/types';

const mockNames = [
  'John Adebayo Okonkwo',
  'Amina Bello Ibrahim',
  'Chukwuemeka David Nwosu',
  'Fatima Yusuf Mohammed',
  'Oluwaseun Grace Adeyemi',
];

function getRandomName(): string {
  return mockNames[Math.floor(Math.random() * mockNames.length)];
}

export const paystackPayoutAdapter: PayoutProviderAdapter = {
  name: 'Paystack',

  async getBanks(country = 'NG'): Promise<PayoutBank[]> {
    await new Promise(r => setTimeout(r, 200));
    return NIGERIAN_BANKS.filter(b => b.country === country);
  },

  async verifyBankAccount(accountNumber: string, bankCode: string): Promise<AccountVerificationResult> {
    await new Promise(r => setTimeout(r, 800));

    if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      return { accountNumber, bankCode, accountName: '', isValid: false };
    }

    return {
      accountNumber,
      bankCode,
      accountName: getRandomName(),
      isValid: true,
    };
  },

  async createRecipient(accountNumber: string, bankCode: string, accountName: string): Promise<PayoutRecipient> {
    await new Promise(r => setTimeout(r, 300));
    return {
      recipientCode: `RCP_mock_${Date.now()}`,
      accountNumber,
      bankCode,
      accountName,
    };
  },

  async initiatePayout(params: PayoutInitiation): Promise<PayoutStatus> {
    await new Promise(r => setTimeout(r, 500));
    return {
      reference: params.reference,
      status: 'processing',
      providerReference: `PSK_${Date.now()}`,
      message: 'Transfer queued for processing',
    };
  },

  async getPayoutStatus(reference: string): Promise<PayoutStatus> {
    await new Promise(r => setTimeout(r, 300));
    return {
      reference,
      status: 'processing',
      message: 'Transfer is being processed',
    };
  },
};
