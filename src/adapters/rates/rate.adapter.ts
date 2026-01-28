// Rate Provider - Mock Implementation
// In Phase 3, this will integrate with real rate APIs (Binance, etc.)

import type { RateProvider, ExchangeRate, ConversionQuote } from './types';
import { CONVERSION_FEE_PERCENTAGE } from './types';

// Mock NGN rates (realistic as of early 2024)
const MOCK_RATES: Record<string, number> = {
  'USDT': 1580, // 1 USDT = ₦1,580
  'USDC': 1578, // 1 USDC = ₦1,578
};

// Add some randomness to simulate market fluctuation
function getFluctuatedRate(baseRate: number): number {
  const fluctuation = (Math.random() - 0.5) * 10; // ±5 NGN
  return Math.round((baseRate + fluctuation) * 100) / 100;
}

function generateQuoteId(): string {
  return `Q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// Store quotes for validation
const quotesCache = new Map<string, { expiresAt: Date }>();

export const mockRateProvider: RateProvider = {
  name: 'Mock Rate Provider',

  async getRate(fromToken: string, toToken: string): Promise<ExchangeRate> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (toToken !== 'NGN') {
      throw new Error('Only NGN conversions are supported');
    }

    const baseRate = MOCK_RATES[fromToken];
    if (!baseRate) {
      throw new Error(`Unsupported token: ${fromToken}`);
    }

    return {
      fromToken,
      toToken,
      rate: getFluctuatedRate(baseRate),
      timestamp: new Date(),
      source: 'mock',
    };
  },

  async getQuote(fromToken: string, fromAmount: number, toToken: string): Promise<ConversionQuote> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    if (toToken !== 'NGN') {
      throw new Error('Only NGN conversions are supported');
    }

    const baseRate = MOCK_RATES[fromToken];
    if (!baseRate) {
      throw new Error(`Unsupported token: ${fromToken}`);
    }

    const rate = getFluctuatedRate(baseRate);
    const toAmount = fromAmount * rate;
    const fee = toAmount * (CONVERSION_FEE_PERCENTAGE / 100);
    const netAmount = toAmount - fee;
    
    const quoteId = generateQuoteId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Cache the quote
    quotesCache.set(quoteId, { expiresAt });

    return {
      fromToken,
      fromAmount,
      toToken,
      toAmount: Math.round(toAmount * 100) / 100,
      rate,
      fee: Math.round(fee * 100) / 100,
      feePercentage: CONVERSION_FEE_PERCENTAGE,
      netAmount: Math.round(netAmount * 100) / 100,
      expiresAt,
      quoteId,
    };
  },

  async isQuoteValid(quoteId: string): Promise<boolean> {
    const quote = quotesCache.get(quoteId);
    if (!quote) return false;
    return new Date() < quote.expiresAt;
  },
};
