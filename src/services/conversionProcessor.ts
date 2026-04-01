import { supabase } from '@/integrations/supabase/client';

/**
 * Triggers the background conversion processor edge function.
 * This is called periodically or on-demand to process PROCESSING conversions.
 */
export async function triggerConversionProcessor(): Promise<{
  processed: number;
  failed: number;
  total: number;
}> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/process-conversions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({ time: new Date().toISOString() }),
  });

  if (!res.ok) {
    throw new Error('Failed to trigger conversion processor');
  }

  return res.json();
}

/**
 * Creates a delayed conversion record.
 * Locks the crypto amount immediately but NGN is credited later by the processor.
 */
export async function createDelayedConversion(params: {
  token: string;
  network: string;
  amount: number;
  estimatedRate: number;
  estimatedFee: number;
  estimatedNgn: number;
}): Promise<{ success: boolean; error?: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { success: false, error: 'Not authenticated' };

  const userId = user.user.id;

  // Get crypto wallet
  const { data: cryptoWallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'CRYPTO')
    .single();

  if (!cryptoWallet) return { success: false, error: 'Crypto wallet not found' };

  // Check and deduct crypto balance (lock funds)
  const { data: balance } = await supabase
    .from('crypto_balances')
    .select('balance')
    .eq('wallet_id', cryptoWallet.id)
    .eq('token', params.token)
    .eq('network', params.network)
    .single();

  if (!balance || balance.balance < params.amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  // Deduct crypto (lock it)
  const { error: deductError } = await supabase
    .from('crypto_balances')
    .update({
      balance: balance.balance - params.amount,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_id', cryptoWallet.id)
    .eq('token', params.token)
    .eq('network', params.network);

  if (deductError) return { success: false, error: 'Failed to lock funds' };

  // Create conversion record with PROCESSING status
  const { error: insertError } = await supabase.from('conversions').insert({
    user_id: userId,
    from_token: params.token,
    from_network: params.network,
    from_amount: params.amount,
    rate: params.estimatedRate,
    fee: params.estimatedFee,
    ngn_amount: params.estimatedNgn,
    status: 'PROCESSING',
  });

  if (insertError) {
    // Refund on failure
    await supabase
      .from('crypto_balances')
      .update({
        balance: balance.balance,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_id', cryptoWallet.id)
      .eq('token', params.token)
      .eq('network', params.network);

    return { success: false, error: 'Failed to create conversion record' };
  }

  return { success: true };
}
