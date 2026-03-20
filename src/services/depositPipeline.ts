// Deposit Pipeline Service
// Structures automated deposit detection, confirmation, and crediting.
// In production, this will be driven by real on-chain watchers.

import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/hooks/useNotifications';

interface DepositDetectionEvent {
  depositId: string;
  userId: string;
  token: string;
  network: string;
  amount: number;
  txHash: string;
}

interface DepositConfirmationEvent {
  depositId: string;
  userId: string;
  token: string;
  network: string;
  amount: number;
  txHash: string;
}

/**
 * Stage 1: Mark deposit as DETECTED
 * Called when an incoming transaction is spotted on-chain (or simulated).
 */
export async function handleDepositDetected(event: DepositDetectionEvent) {
  const { error } = await supabase
    .from('deposits')
    .update({
      status: 'DETECTED',
      detected_at: new Date().toISOString(),
      amount: event.amount,
      tx_hash: event.txHash,
      confirmations_count: 3,
    } as any)
    .eq('id', event.depositId)
    .eq('status', 'PENDING');

  if (error) throw error;

  await createNotification({
    userId: event.userId,
    type: 'deposit_detected',
    title: 'Deposit Detected',
    message: `${event.amount} ${event.token} deposit detected on ${event.network}. Waiting for confirmations.`,
    relatedKind: 'deposit',
  });
}

/**
 * Stage 2: Mark deposit as CONFIRMED and credit balance
 * Called after sufficient on-chain confirmations (or simulated).
 */
export async function handleDepositConfirmed(event: DepositConfirmationEvent) {
  // Verify deposit is still confirmable
  const { data: currentDeposit } = await supabase
    .from('deposits')
    .select('status, amount')
    .eq('id', event.depositId)
    .single();

  if (!currentDeposit || (currentDeposit.status !== 'PENDING' && currentDeposit.status !== 'DETECTED')) {
    return { alreadyProcessed: true };
  }

  const depositAmount = currentDeposit.amount || event.amount;

  // Update deposit status
  const { error: depositError } = await supabase
    .from('deposits')
    .update({
      status: 'CONFIRMED',
      amount: depositAmount,
      tx_hash: event.txHash,
      confirmed_at: new Date().toISOString(),
      confirmations_count: 12,
    } as any)
    .eq('id', event.depositId);

  if (depositError) throw depositError;

  // Credit crypto balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id')
    .eq('user_id', event.userId)
    .eq('type', 'CRYPTO')
    .single();

  if (wallet) {
    const { data: existingBalance } = await supabase
      .from('crypto_balances')
      .select('balance')
      .eq('wallet_id', wallet.id)
      .eq('token', event.token)
      .eq('network', event.network)
      .single();

    if (existingBalance) {
      await supabase
        .from('crypto_balances')
        .update({ balance: (Number(existingBalance.balance) || 0) + depositAmount })
        .eq('wallet_id', wallet.id)
        .eq('token', event.token)
        .eq('network', event.network);
    } else {
      await supabase.from('crypto_balances').insert({
        wallet_id: wallet.id,
        token: event.token,
        network: event.network,
        balance: depositAmount,
      });
    }
  }

  const refId = 'LXP-DEP-' + event.depositId.slice(0, 8).toUpperCase();

  // Create transaction record
  await supabase.from('transactions').insert({
    user_id: event.userId,
    kind: 'DEPOSIT',
    title: 'Crypto Deposit',
    subtitle: `${event.token} on ${event.network.charAt(0).toUpperCase() + event.network.slice(1)}`,
    amount_display: `+${depositAmount} ${event.token}`,
    status: 'SUCCESS',
    metadata: {
      deposit_id: event.depositId,
      amount: depositAmount,
      token: event.token,
      network: event.network,
      tx_hash: event.txHash,
      reference: refId,
    },
  });

  // Notify user
  await createNotification({
    userId: event.userId,
    type: 'deposit_confirmed',
    title: 'Deposit Confirmed',
    message: `${depositAmount} ${event.token} has been added to your wallet.`,
    relatedKind: 'deposit',
  });

  return { alreadyProcessed: false, credited: depositAmount };
}

/**
 * Generate a deterministic EVM address for a user.
 * In production, this would use a proper HD wallet derivation.
 */
export function generateUserDepositAddress(userId: string): string {
  // Create a deterministic hex string from user ID
  let hash = 0;
  const input = `lexopay-deposit-${userId}`;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit int
  }

  // Generate a realistic-looking 0x address using the user ID
  const hexChars = '0123456789abcdef';
  let address = '0x';
  const seed = userId.replace(/-/g, '');
  for (let i = 0; i < 40; i++) {
    const charCode = seed.charCodeAt(i % seed.length) + i + hash;
    address += hexChars[Math.abs(charCode) % 16];
  }
  return address;
}
