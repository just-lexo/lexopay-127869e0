// Flutterwave Payout Adapter - Placeholder
// Will be implemented in a future phase

import type {
  PayoutProviderAdapter,
  PayoutBank,
  AccountVerificationResult,
  PayoutRecipient,
  PayoutInitiation,
  PayoutStatus,
} from './types';

export const flutterwavePayoutAdapter: PayoutProviderAdapter = {
  name: 'Flutterwave',

  async getBanks(): Promise<PayoutBank[]> {
    throw new Error('Flutterwave adapter not yet implemented');
  },

  async verifyBankAccount(): Promise<AccountVerificationResult> {
    throw new Error('Flutterwave adapter not yet implemented');
  },

  async createRecipient(): Promise<PayoutRecipient> {
    throw new Error('Flutterwave adapter not yet implemented');
  },

  async initiatePayout(): Promise<PayoutStatus> {
    throw new Error('Flutterwave adapter not yet implemented');
  },

  async getPayoutStatus(): Promise<PayoutStatus> {
    throw new Error('Flutterwave adapter not yet implemented');
  },
};
