// Bank Payout Adapter Interface
// This defines the contract for bank payout integrations
// In Phase 3, this will be implemented with real payout providers

export interface Bank {
  code: string;
  name: string;
  country: string;
}

export interface AccountVerification {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  isValid: boolean;
}

export interface PayoutRequest {
  reference: string;
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  narration?: string;
}

export interface PayoutResult {
  reference: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  message?: string;
  transactionId?: string;
}

export interface BankPayoutAdapter {
  name: string;
  
  // Get list of supported banks
  getBanks(): Promise<Bank[]>;
  
  // Verify bank account details
  verifyAccount(accountNumber: string, bankCode: string): Promise<AccountVerification>;
  
  // Initiate a payout
  initiatePayout(request: PayoutRequest): Promise<PayoutResult>;
  
  // Check payout status
  getPayoutStatus(reference: string): Promise<PayoutResult>;
}

// Nigerian banks for MVP
export const NIGERIAN_BANKS: Bank[] = [
  { code: '044', name: 'Access Bank', country: 'NG' },
  { code: '023', name: 'Citibank Nigeria', country: 'NG' },
  { code: '063', name: 'Diamond Bank', country: 'NG' },
  { code: '050', name: 'Ecobank Nigeria', country: 'NG' },
  { code: '084', name: 'Enterprise Bank', country: 'NG' },
  { code: '070', name: 'Fidelity Bank', country: 'NG' },
  { code: '011', name: 'First Bank of Nigeria', country: 'NG' },
  { code: '214', name: 'First City Monument Bank', country: 'NG' },
  { code: '058', name: 'Guaranty Trust Bank', country: 'NG' },
  { code: '030', name: 'Heritage Bank', country: 'NG' },
  { code: '301', name: 'Jaiz Bank', country: 'NG' },
  { code: '082', name: 'Keystone Bank', country: 'NG' },
  { code: '526', name: 'Parallex Bank', country: 'NG' },
  { code: '076', name: 'Polaris Bank', country: 'NG' },
  { code: '101', name: 'Providus Bank', country: 'NG' },
  { code: '221', name: 'Stanbic IBTC Bank', country: 'NG' },
  { code: '068', name: 'Standard Chartered Bank', country: 'NG' },
  { code: '232', name: 'Sterling Bank', country: 'NG' },
  { code: '100', name: 'Suntrust Bank', country: 'NG' },
  { code: '032', name: 'Union Bank of Nigeria', country: 'NG' },
  { code: '033', name: 'United Bank for Africa', country: 'NG' },
  { code: '215', name: 'Unity Bank', country: 'NG' },
  { code: '035', name: 'Wema Bank', country: 'NG' },
  { code: '057', name: 'Zenith Bank', country: 'NG' },
  { code: '999', name: 'Opay', country: 'NG' },
  { code: '998', name: 'Palmpay', country: 'NG' },
  { code: '997', name: 'Moniepoint', country: 'NG' },
  { code: '996', name: 'Kuda Bank', country: 'NG' },
];
