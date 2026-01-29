import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type TransactionKind = Database['public']['Enums']['transaction_kind'];

interface Transaction {
  id: string;
  kind: TransactionKind;
  title: string;
  subtitle: string | null;
  amount_display: string;
  status: string;
  created_at: string;
}

interface TransactionsData {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTransactions(limit?: number): TransactionsData {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      let query = supabase
        .from('transactions')
        .select('id, kind, title, subtitle, amount_display, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: txError } = await query;

      if (txError) throw txError;
      
      setTransactions(data ?? []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
  };
}
