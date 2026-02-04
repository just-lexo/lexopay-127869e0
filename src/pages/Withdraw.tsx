import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { mockPayoutAdapter, NIGERIAN_BANKS, type Bank } from '@/adapters';
import { TestModeBanner } from '@/components/TestModeBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  Check,
  AlertCircle,
  Wrench,
  Building2,
  User,
  Banknote
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WITHDRAWAL_FEE = 20; // Flat ₦20 fee

interface PendingWithdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_name: string;
  status: string;
  created_at: string;
}

const Withdraw = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { ngnBalance, refetch } = useWallets();
  const { toast } = useToast();

  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);

  const isDev = import.meta.env.DEV;
  const availableBalance = ngnBalance?.balance ?? 0;
  const withdrawAmount = parseFloat(amount) || 0;
  const totalDeduction = withdrawAmount + WITHDRAWAL_FEE;
  const canWithdraw = isVerified && withdrawAmount > 0 && availableBalance >= totalDeduction;

  const fetchPendingWithdrawals = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PROCESSING')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPendingWithdrawals(data as PendingWithdrawal[]);
    }
  };

  useEffect(() => {
    fetchPendingWithdrawals();
  }, [user]);

  const handleVerifyAccount = async () => {
    if (!selectedBank || accountNumber.length !== 10) {
      toast({
        title: 'Invalid input',
        description: 'Please select a bank and enter a valid 10-digit account number.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await mockPayoutAdapter.verifyAccount(accountNumber, selectedBank.code);
      
      if (result.isValid) {
        setAccountName(result.accountName);
        setIsVerified(true);
        toast({
          title: 'Account verified',
          description: `Account belongs to ${result.accountName}`,
        });
      } else {
        setAccountName(null);
        setIsVerified(false);
        toast({
          title: 'Verification failed',
          description: 'Could not verify this account. Please check the details.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast({
        title: 'Error',
        description: 'Failed to verify account.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !selectedBank || !accountName || !canWithdraw) return;

    setLoading(true);
    try {
      const reference = `LXP-WD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create withdrawal record
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          amount: withdrawAmount,
          bank_code: selectedBank.code,
          bank_name: selectedBank.name,
          account_number: accountNumber,
          account_name: accountName,
          reference,
          status: 'PROCESSING',
        })
        .select()
        .single();

      if (withdrawalError) throw withdrawalError;

      // Get user's NGN wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'NGN')
        .single();

      if (walletError) throw walletError;

      // Deduct from NGN balance
      const newBalance = availableBalance - totalDeduction;
      const { error: balanceError } = await supabase
        .from('ngn_balances')
        .update({ balance: newBalance })
        .eq('wallet_id', wallet.id);

      if (balanceError) throw balanceError;

      // Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          kind: 'WITHDRAW',
          title: 'Bank Transfer',
          subtitle: `${selectedBank.name} • ${accountName}`,
          amount_display: `-₦${totalDeduction.toLocaleString()} (sent ₦${withdrawAmount.toLocaleString()}, fee ₦${WITHDRAWAL_FEE})`,
          status: 'PROCESSING',
          metadata: {
            withdrawal_id: withdrawal.id,
            bank_code: selectedBank.code,
            bank_name: selectedBank.name,
            account_number: accountNumber,
            account_name: accountName,
            amount: withdrawAmount,
            fee: WITHDRAWAL_FEE,
            reference,
          },
        });

      if (txError) throw txError;

      toast({
        title: 'Withdrawal initiated',
        description: `₦${withdrawAmount.toLocaleString()} is being sent to ${accountName}.`,
      });

      // Reset form
      setAmount('');
      setAccountNumber('');
      setAccountName(null);
      setIsVerified(false);
      setSelectedBank(null);
      
      await fetchPendingWithdrawals();
      await refetch();
    } catch (err) {
      console.error('Withdrawal error:', err);
      toast({
        title: 'Error',
        description: 'Failed to process withdrawal.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // DEV TOOL: Simulate withdrawal paid
  const handleSimulatePaid = async (withdrawal: PendingWithdrawal) => {
    if (!user) return;

    setLoading(true);
    try {
      // Update withdrawal status
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({ status: 'SUCCESS' })
        .eq('id', withdrawal.id);

      if (withdrawalError) throw withdrawalError;

      // Find and update the related transaction
      const { data: transactions, error: txFindError } = await supabase
        .from('transactions')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('kind', 'WITHDRAW');

      if (txFindError) throw txFindError;

      const relatedTx = transactions?.find(tx => {
        const metadata = tx.metadata as { withdrawal_id?: string } | null;
        return metadata?.withdrawal_id === withdrawal.id;
      });

      if (relatedTx) {
        // Note: transactions table doesn't allow UPDATE per RLS, so we'll skip this
        // In a real app, this would be handled by a backend function
      }

      toast({
        title: 'Withdrawal completed!',
        description: `₦${withdrawal.amount.toLocaleString()} sent to ${withdrawal.account_name}.`,
      });

      await fetchPendingWithdrawals();
    } catch (err) {
      console.error('Error simulating paid:', err);
      toast({
        title: 'Error',
        description: 'Failed to simulate payment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBankChange = (bankCode: string) => {
    const bank = NIGERIAN_BANKS.find(b => b.code === bankCode);
    setSelectedBank(bank || null);
    setIsVerified(false);
    setAccountName(null);
  };

  const handleAccountNumberChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(cleaned);
    setIsVerified(false);
    setAccountName(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[41px] z-50">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Withdraw to Bank</h1>
              <p className="text-xs text-muted-foreground">Send NGN to your bank account</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {/* Available Balance */}
        <Card className="glass-card border-success/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold font-mono">{formatCurrency(availableBalance)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                <span className="text-xl text-success">₦</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Selection */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Bank</Label>
              <Select onValueChange={handleBankChange} value={selectedBank?.code || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your bank" />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIAN_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="10-digit account number"
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  maxLength={10}
                />
                <Button
                  variant="outline"
                  onClick={handleVerifyAccount}
                  disabled={!selectedBank || accountNumber.length !== 10 || isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </div>

            {/* Verified Account Name */}
            {isVerified && accountName && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <User className="w-4 h-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="font-medium text-success">{accountName}</p>
                </div>
                <Check className="w-4 h-4 text-success ml-auto" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Withdrawal Amount (NGN)</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!isVerified}
              />
            </div>

            {/* Fee Breakdown */}
            {withdrawAmount > 0 && (
              <div className="space-y-2 p-3 rounded-lg bg-background/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to send</span>
                  <span>{formatCurrency(withdrawAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transfer fee</span>
                  <span>{formatCurrency(WITHDRAWAL_FEE)}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between font-medium">
                  <span>Total deduction</span>
                  <span className={totalDeduction > availableBalance ? 'text-destructive' : ''}>
                    {formatCurrency(totalDeduction)}
                  </span>
                </div>
              </div>
            )}

            {totalDeduction > availableBalance && withdrawAmount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                <p className="text-xs text-destructive">
                  Insufficient balance. You need {formatCurrency(totalDeduction - availableBalance)} more.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm Button */}
        <Button
          className="w-full touch-target gradient-primary hover:opacity-90"
          onClick={handleWithdraw}
          disabled={!canWithdraw || loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            `Confirm Withdrawal`
          )}
        </Button>

        {/* Pending Withdrawals */}
        {pendingWithdrawals.length > 0 && (
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Processing Withdrawals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(withdrawal.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {withdrawal.bank_name} • {withdrawal.account_name}
                    </p>
                  </div>
                  <Badge className="status-pending border">Processing</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dev Tools - Admin Only */}
        {profile?.is_admin && (
          <Card className="glass-card border-warning/30 bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Admin Tools
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDevTools(!showDevTools)}
                >
                  {showDevTools ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showDevTools && (
              <CardContent className="space-y-3">
                {pendingWithdrawals.length > 0 ? (
                  pendingWithdrawals.map((withdrawal) => (
                    <Button
                      key={withdrawal.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => handleSimulatePaid(withdrawal)}
                      disabled={loading}
                    >
                      <span>Simulate Paid: {formatCurrency(withdrawal.amount)}</span>
                      <Badge variant="secondary">→ SUCCESS</Badge>
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No pending withdrawals to simulate
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default Withdraw;