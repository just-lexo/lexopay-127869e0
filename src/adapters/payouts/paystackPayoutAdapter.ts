// Paystack Payout Adapter
// Production-ready structure. Currently runs in mock/test mode.
// In production, methods will call Paystack Transfer API via Edge Functions.

import type {
  PayoutProviderAdapter,
  PayoutBank,
  AccountVerificationResult,
  PayoutRecipient,
  PayoutInitiation,
  PayoutStatus,
  PayoutMetadata,
} from './types';
import { NIGERIAN_BANKS } from '../banks/types';

const PROVIDER_NAME = 'paystack';

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
  name: PROVIDER_NAME,

  async getBanks(country = 'NG'): Promise<PayoutBank[]> {
    // Production: GET https://api.paystack.co/bank
    await new Promise(r => setTimeout(r, 200));
    return NIGERIAN_BANKS.filter(b => b.country === country);
  },

  async verifyBankAccount(accountNumber: string, bankCode: string): Promise<AccountVerificationResult> {
    // Production: GET https://api.paystack.co/bank/resolve?account_number=...&bank_code=...
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
    // Production: POST https://api.paystack.co/transferrecipient
    // Body: { type: "nuban", name, account_number, bank_code, currency: "NGN" }
    await new Promise(r => setTimeout(r, 300));
    return {
      recipientCode: `RCP_${PROVIDER_NAME}_${Date.now()}`,
      accountNumber,
      bankCode,
      accountName,
    };
  },

  async initiatePayout(params: PayoutInitiation): Promise<PayoutStatus> {
    // Production: POST https://api.paystack.co/transfer
    // Body: { source: "balance", reason, amount (kobo), recipient, reference }
    await new Promise(r => setTimeout(r, 500));
    return {
      reference: params.reference,
      status: 'processing',
      providerReference: `PSK_TRF_${Date.now()}`,
      message: 'Transfer queued for processing',
    };
  },

  async getPayoutStatus(reference: string): Promise<PayoutStatus> {
    // Production: GET https://api.paystack.co/transfer/verify/:reference
    await new Promise(r => setTimeout(r, 300));
    return {
      reference,
      status: 'processing',
      message: 'Transfer is being processed',
    };
  },
};

/**
 * Build metadata object for storing in withdrawals table.
 */
export function buildPayoutMetadata(
  providerReference?: string,
  recipientCode?: string,
  rawStatus?: string
): PayoutMetadata {
  return {
    provider_name: PROVIDER_NAME,
    provider_reference: providerReference,
    recipient_code: recipientCode,
    payout_status_raw: rawStatus,
  };
}
