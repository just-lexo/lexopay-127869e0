// Rate Provider - Live Coinbase Price Feed
// Fetches real prices from the get-crypto-prices edge function

import type { RateProvider, ExchangeRate, ConversionQuote } from './types';
import { CONVERSION_FEE_PERCENTAGE } from './types';
import { supabase } from '@/integrations/supabase/client';

// Cache prices for 30 seconds
let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL = 30_000;

async function fetchLivePrices(): Promise<Record<string, number>> {
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return priceCache.prices;
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-crypto-prices', {
      method: 'GET',
    });

    if (error) throw error;

    const prices: Record<string, number> = {};
    for (const p of data.prices) {
      prices[p.token] = p.ngnRate;
    }

    priceCache = { prices, timestamp: Date.now() };
    return prices;
  } catch (err) {
    console.error('Failed to fetch live prices, using fallback:', err);
    // Fallback rates
    return {
      USDT: 1580,
      USDC: 1578,
      ETH: 5_200_000,
    };
  }
}

function generateQuoteId(): string {
  return `Q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

const quotesCache = new Map<string, { expiresAt: Date }>();

export const liveRateProvider: RateProvider = {
  name: 'Coinbase Live Rate Provider',

  async getRate(fromToken: string, toToken: string): Promise<ExchangeRate> {
    if (toToken !== 'NGN') {
      throw new Error('Only NGN conversions are supported');
    }

    const prices = await fetchLivePrices();
    const rate = prices[fromToken];
    if (!rate) {
      throw new Error(`Unsupported token: ${fromToken}`);
    }

    return {
      fromToken,
      toToken,
      rate,
      timestamp: new Date(),
      source: 'coinbase',
    };
  },

  async getQuote(fromToken: string, fromAmount: number, toToken: string): Promise<ConversionQuote> {
    if (toToken !== 'NGN') {
      throw new Error('Only NGN conversions are supported');
    }

    const prices = await fetchLivePrices();
    const rate = prices[fromToken];
    if (!rate) {
      throw new Error(`Unsupported token: ${fromToken}`);
    }

    const toAmount = fromAmount * rate;
    const fee = toAmount * (CONVERSION_FEE_PERCENTAGE / 100);
    const netAmount = toAmount - fee;

    const quoteId = generateQuoteId();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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

// Keep mock as fallback export
export { liveRateProvider as mockRateProvider };
