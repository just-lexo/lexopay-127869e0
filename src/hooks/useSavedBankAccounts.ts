import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SavedBankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_default: boolean;
  is_verified_owner: boolean;
  created_at: string;
}

export function useSavedBankAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SavedBankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('saved_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (!error && data) {
      setAccounts(data as unknown as SavedBankAccount[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const defaultAccount = accounts.find(a => a.is_default) || null;

  const addAccount = async (params: {
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    setAsDefault?: boolean;
  }) => {
    if (!user) return { error: new Error('Not authenticated') };

    // If setting as default, unset existing defaults
    if (params.setAsDefault) {
      await supabase
        .from('saved_bank_accounts')
        .update({ is_default: false } as any)
        .eq('user_id', user.id);
    }

    const { error } = await supabase
      .from('saved_bank_accounts')
      .insert({
        user_id: user.id,
        bank_name: params.bankName,
        bank_code: params.bankCode,
        account_number: params.accountNumber,
        account_name: params.accountName,
        is_default: params.setAsDefault || accounts.length === 0,
      } as any);

    if (!error) await fetchAccounts();
    return { error };
  };

  const setDefault = async (id: string) => {
    if (!user) return;

    await supabase
      .from('saved_bank_accounts')
      .update({ is_default: false } as any)
      .eq('user_id', user.id);

    await supabase
      .from('saved_bank_accounts')
      .update({ is_default: true } as any)
      .eq('id', id);

    await fetchAccounts();
  };

  const removeAccount = async (id: string) => {
    if (!user) return;

    await supabase
      .from('saved_bank_accounts')
      .delete()
      .eq('id', id);

    await fetchAccounts();
  };

  return {
    accounts,
    defaultAccount,
    loading,
    addAccount,
    setDefault,
    removeAccount,
    refetch: fetchAccounts,
  };
}
