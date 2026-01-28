// Rate Provider Interface
// This defines the contract for exchange rate providers
// In Phase 3, this will be implemented with real rate APIs

export interface ExchangeRate {
  fromToken: string;
  toToken: string;
  rate: number; // How many NGN per 1 unit of fromToken
  timestamp: Date;
  source: string;
}

export interface ConversionQuote {
  fromToken: string;
  fromAmount: number;
  toToken: string;
  toAmount: number;
  rate: number;
  fee: number;
  feePercentage: number;
  netAmount: number; // toAmount - fee
  expiresAt: Date;
  quoteId: string;
}

export interface RateProvider {
  name: string;
  
  // Get current exchange rate
  getRate(fromToken: string, toToken: string): Promise<ExchangeRate>;
  
  // Get a conversion quote with fees
  getQuote(fromToken: string, fromAmount: number, toToken: string): Promise<ConversionQuote>;
  
  // Check if a quote is still valid
  isQuoteValid(quoteId: string): Promise<boolean>;
}

// Fee structure for conversions
export const CONVERSION_FEE_PERCENTAGE = 1.0; // 1% fee
export const MIN_CONVERSION_AMOUNT = 1; // Minimum 1 USDT/USDC
export const MAX_CONVERSION_AMOUNT = 10000; // Maximum 10,000 USDT/USDC per transaction
