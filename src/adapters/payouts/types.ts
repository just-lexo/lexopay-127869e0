// Payout Provider Adapter Interface
// Defines the contract for bank payout integrations (Paystack, Flutterwave, etc.)

export interface PayoutBank {
  code: string;
  name: string;
  country: string;
}

export interface AccountVerificationResult {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  isValid: boolean;
}

export interface PayoutRecipient {
  recipientCode: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

export interface PayoutInitiation {
  reference: string;
  amount: number; // in kobo for Paystack, smallest unit
  currency: string;
  recipientCode: string;
  narration?: string;
}

export interface PayoutStatus {
  reference: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  providerReference?: string;
  message?: string;
}

export interface PayoutProviderAdapter {
  name: string;

  // Get list of supported banks
  getBanks(country?: string): Promise<PayoutBank[]>;

  // Verify a bank account
  verifyBankAccount(accountNumber: string, bankCode: string): Promise<AccountVerificationResult>;

  // Create a transfer recipient
  createRecipient(accountNumber: string, bankCode: string, accountName: string): Promise<PayoutRecipient>;

  // Initiate a payout transfer
  initiatePayout(params: PayoutInitiation): Promise<PayoutStatus>;

  // Check payout transfer status
  getPayoutStatus(reference: string): Promise<PayoutStatus>;
}

// Metadata shape stored in withdrawals
export interface PayoutMetadata {
  provider_name: string;
  provider_reference?: string;
  recipient_code?: string;
  payout_status_raw?: string;
}
