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
  // All balance mutations are performed server-side via the
  // request_crypto_conversion RPC (SECURITY DEFINER). The client
  // is no longer trusted to update balances or insert conversions
  // directly. The estimated values are stored for display only —
  // the background processor recomputes the authoritative rate.
  const { data, error } = await supabase.rpc('request_crypto_conversion', {
    _token: params.token,
    _network: params.network,
    _amount: params.amount,
    _estimated_rate: params.estimatedRate,
    _estimated_fee: params.estimatedFee,
    _estimated_ngn: params.estimatedNgn,
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  if (!result?.success) return { success: false, error: result?.error || 'Failed to create conversion' };
  return { success: true };
}
