import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wrench, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useWallets } from '@/hooks/useWallets';

interface PendingDeposit {
  id: string;
  token: string;
  network: string;
  status: string;
}

interface PendingWithdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_name: string;
  status: string;
}

export function DevToolsButton() {
  const { user } = useAuth();
  const { refetch } = useWallets();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testAmount, setTestAmount] = useState(100);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [showDeposits, setShowDeposits] = useState(true);
  const [showWithdrawals, setShowWithdrawals] = useState(true);

  const fetchPending = async () => {
    if (!user) return;

    const [depositsRes, withdrawalsRes] = await Promise.all([
      supabase
        .from('deposits')
        .select('id, token, network, status')
        .eq('user_id', user.id)
        .eq('status', 'PENDING'),
      supabase
        .from('withdrawals')
        .select('id, amount, bank_name, account_name, status')
        .eq('user_id', user.id)
        .eq('status', 'PROCESSING'),
    ]);

    if (!depositsRes.error) setPendingDeposits(depositsRes.data || []);
    if (!withdrawalsRes.error) setPendingWithdrawals(withdrawalsRes.data || []);
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchPending();
    }
  }, [isOpen, user]);

  const handleSimulateDeposit = async (deposit: PendingDeposit) => {
    if (!user) return;
    setLoading(true);

    try {
      // Verify still pending
      const { data: current } = await supabase
        .from('deposits')
        .select('status')
        .eq('id', deposit.id)
        .single();

      if (current?.status !== 'PENDING') {
        toast({ title: 'Already processed', description: 'This deposit has been confirmed.' });
        await fetchPending();
        return;
      }

      // Update deposit
      await supabase
        .from('deposits')
        .update({
          status: 'CONFIRMED',
          amount: testAmount,
          tx_hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
        })
        .eq('id', deposit.id)
        .eq('status', 'PENDING');

      // Get wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'CRYPTO')
        .single();

      if (!wallet) throw new Error('No wallet found');

      // Update balance
      const { data: existing } = await supabase
        .from('crypto_balances')
        .select('balance')
        .eq('wallet_id', wallet.id)
        .eq('token', deposit.token)
        .eq('network', deposit.network)
        .single();

      const newBalance = (Number(existing?.balance) || 0) + testAmount;

      await supabase
        .from('crypto_balances')
        .update({ balance: newBalance })
        .eq('wallet_id', wallet.id)
        .eq('token', deposit.token)
        .eq('network', deposit.network);

      // Create transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        kind: 'DEPOSIT',
        title: 'Crypto Deposit',
        subtitle: `${deposit.token} on ${deposit.network.charAt(0).toUpperCase() + deposit.network.slice(1)}`,
        amount_display: `+${testAmount} ${deposit.token}`,
        status: 'SUCCESS',
        metadata: { deposit_id: deposit.id, amount: testAmount },
      });

      toast({ title: 'Deposit confirmed!', description: `+${testAmount} ${deposit.token}` });
      await fetchPending();
      await refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to simulate', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateWithdrawal = async (withdrawal: PendingWithdrawal) => {
    if (!user) return;
    setLoading(true);

    try {
      await supabase
        .from('withdrawals')
        .update({ status: 'SUCCESS' })
        .eq('id', withdrawal.id);

      toast({
        title: 'Withdrawal paid!',
        description: `₦${withdrawal.amount.toLocaleString()} to ${withdrawal.account_name}`,
      });

      await fetchPending();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to simulate', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-warning text-warning-foreground shadow-lg flex items-center justify-center hover:bg-warning/90 transition-colors"
        aria-label="Dev Tools"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl">
          <Card className="border-warning/30 bg-card">
            <CardHeader className="pb-2 bg-warning/10">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Dev Tools (Tester Mode)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Test Amount */}
              <div className="space-y-1">
                <Label className="text-xs">Deposit Amount</Label>
                <Input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(Math.max(1, Number(e.target.value)))}
                  className="h-8 text-sm"
                  min="1"
                />
              </div>

              {/* Pending Deposits */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowDeposits(!showDeposits)}
                  className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
                >
                  <span>Pending Deposits ({pendingDeposits.length})</span>
                  {showDeposits ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showDeposits && (
                  <div className="space-y-2">
                    {pendingDeposits.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No pending deposits
                      </p>
                    ) : (
                      pendingDeposits.map((d) => (
                        <Button
                          key={d.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between text-xs h-8"
                          onClick={() => handleSimulateDeposit(d)}
                          disabled={loading}
                        >
                          <span>Confirm {d.token}</span>
                          <Badge variant="secondary" className="text-xs">+{testAmount}</Badge>
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Pending Withdrawals */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowWithdrawals(!showWithdrawals)}
                  className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground"
                >
                  <span>Processing Withdrawals ({pendingWithdrawals.length})</span>
                  {showWithdrawals ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showWithdrawals && (
                  <div className="space-y-2">
                    {pendingWithdrawals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No pending withdrawals
                      </p>
                    ) : (
                      pendingWithdrawals.map((w) => (
                        <Button
                          key={w.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between text-xs h-8"
                          onClick={() => handleSimulateWithdrawal(w)}
                          disabled={loading}
                        >
                          <span>Pay ₦{w.amount.toLocaleString()}</span>
                          <Badge variant="secondary" className="text-xs">→ {w.bank_name.slice(0, 8)}</Badge>
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {loading && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Use this panel to simulate backend events for testing
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
