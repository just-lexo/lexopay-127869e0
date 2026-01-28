import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CryptoBalance {
  id: string;
  token: string;
  network: string;
  balance: number;
}

interface NGNBalance {
  id: string;
  balance: number;
}

interface WalletData {
  cryptoWalletId: string | null;
  ngnWalletId: string | null;
  cryptoBalances: CryptoBalance[];
  ngnBalance: NGNBalance | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWallets(): WalletData {
  const { user } = useAuth();
  const [cryptoWalletId, setCryptoWalletId] = useState<string | null>(null);
  const [ngnWalletId, setNgnWalletId] = useState<string | null>(null);
  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalance[]>([]);
  const [ngnBalance, setNgnBalance] = useState<NGNBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallets = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Fetch wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('id, type')
        .eq('user_id', user.id);

      if (walletsError) throw walletsError;

      const cryptoWallet = wallets?.find(w => w.type === 'CRYPTO');
      const ngnWallet = wallets?.find(w => w.type === 'NGN');

      setCryptoWalletId(cryptoWallet?.id ?? null);
      setNgnWalletId(ngnWallet?.id ?? null);

      // Fetch crypto balances
      if (cryptoWallet) {
        const { data: cryptoData, error: cryptoError } = await supabase
          .from('crypto_balances')
          .select('id, token, network, balance')
          .eq('wallet_id', cryptoWallet.id);

        if (cryptoError) throw cryptoError;
        
        setCryptoBalances(
          (cryptoData ?? []).map(b => ({
            ...b,
            balance: Number(b.balance),
          }))
        );
      }

      // Fetch NGN balance
      if (ngnWallet) {
        const { data: ngnData, error: ngnError } = await supabase
          .from('ngn_balances')
          .select('id, balance')
          .eq('wallet_id', ngnWallet.id)
          .maybeSingle();

        if (ngnError) throw ngnError;
        
        setNgnBalance(ngnData ? { ...ngnData, balance: Number(ngnData.balance) } : null);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [user]);

  return {
    cryptoWalletId,
    ngnWalletId,
    cryptoBalances,
    ngnBalance,
    loading,
    error,
    refetch: fetchWallets,
  };
}
