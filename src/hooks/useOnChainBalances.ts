import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnChainBalance {
  token: string;
  balance: string;
  contract: string | null;
  decimals: number;
  isNative: boolean;
}

interface OnChainBalanceData {
  balances: OnChainBalance[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Main tokens that can be converted
export const CONVERTIBLE_TOKENS = ['USDC', 'ETH'];

export function useOnChainBalances(walletAddress: string | null | undefined): OnChainBalanceData {
  const [balances, setBalances] = useState<OnChainBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!walletAddress) {
      setBalances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('read-wallet-balances', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: null,
      });

      // Use query params approach since GET with body is tricky
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/read-wallet-balances?address=${walletAddress}`;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch on-chain balances');
      
      const result = await res.json();
      
      // Filter out zero balances and sort: main tokens first
      const nonZero = (result.balances || []).filter(
        (b: OnChainBalance) => parseFloat(b.balance) > 0
      );

      // Sort: USDC first, ETH second, others after
      nonZero.sort((a: OnChainBalance, b: OnChainBalance) => {
        const order = ['USDC', 'ETH', 'USDT'];
        const aIdx = order.indexOf(a.token);
        const bIdx = order.indexOf(b.token);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });

      setBalances(nonZero);
    } catch (err) {
      console.error('Error fetching on-chain balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, error, refetch: fetchBalances };
}
