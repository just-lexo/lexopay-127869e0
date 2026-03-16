import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { useHideBalances } from '@/hooks/useHideBalances';
import { useSavedBankAccounts, type SavedBankAccount } from '@/hooks/useSavedBankAccounts';
import { supabase } from '@/integrations/supabase/client';
import { mockPayoutAdapter, NIGERIAN_BANKS, type Bank } from '@/adapters';
import { createNotification } from '@/hooks/useNotifications';
import { FaceVerificationModal } from '@/components/FaceVerificationModal';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Banknote,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WITHDRAWAL_FEE = 20;

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
  const { mask } = useHideBalances();
  const { toast } = useToast();
  const { accounts: savedAccounts, defaultAccount, loading: loadingSaved } = useSavedBankAccounts();

  const [mode, setMode] = useState<'default' | 'other'>('default');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  
  // Face verification
  const [faceVerifyOpen, setFaceVerifyOpen] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);

  const isDev = import.meta.env.DEV;
  const availableBalance = ngnBalance?.balance ?? 0;
  const withdrawAmount = parseFloat(amount) || 0;
  const totalDeduction = withdrawAmount + WITHDRAWAL_FEE;

  // For default mode, auto-fill from saved account
  const usingDefault = mode === 'default' && defaultAccount;
  const effectiveBank = usingDefault ? defaultAccount.bank_name : selectedBank?.name;
  const effectiveBankCode = usingDefault ? defaultAccount.bank_code : selectedBank?.code;
  const effectiveAccountNumber = usingDefault ? defaultAccount.account_number : accountNumber;
  const effectiveAccountName = usingDefault ? defaultAccount.account_name : accountName;
  const effectiveVerified = usingDefault ? true : isVerified;

  const canWithdraw = effectiveVerified && withdrawAmount > 0 && availableBalance >= totalDeduction 
    && (mode === 'default' || faceVerified);

  // Auto-set mode based on saved accounts
  useEffect(() => {
    if (!loadingSaved) {
      setMode(defaultAccount ? 'default' : 'other');
    }
  }, [loadingSaved, defaultAccount]);

  const fetchPendingWithdrawals = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PROCESSING')
      .order('created_at', { ascending: false });
    if (!error && data) setPendingWithdrawals(data as PendingWithdrawal[]);
  };

  useEffect(() => { fetchPendingWithdrawals(); }, [user]);

  const handleVerifyAccount = async () => {
    if (!selectedBank || accountNumber.length !== 10) {
      toast({ title: 'Invalid input', description: 'Please select a bank and enter a valid 10-digit account number.', variant: 'destructive' });
      return;
    }
    setIsVerifying(true);
    try {
      const result = await mockPayoutAdapter.verifyAccount(accountNumber, selectedBank.code);
      if (result.isValid) {
        setAccountName(result.accountName);
        setIsVerified(true);
        toast({ title: 'Account verified', description: `Account belongs to ${result.accountName}` });
      } else {
        setAccountName(null);
        setIsVerified(false);
        toast({ title: 'Verification failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to verify account.', variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !effectiveBankCode || !effectiveAccountName || !canWithdraw) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('withdraw_ngn', {
        _amount: withdrawAmount,
        _fee: WITHDRAWAL_FEE,
        _bank_code: effectiveBankCode,
        _bank_name: effectiveBank!,
        _account_number: effectiveAccountNumber,
        _account_name: effectiveAccountName,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string; reference?: string };
      if (!result.success) {
        toast({ title: 'Withdrawal failed', description: result.error, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Withdrawal initiated',
        description: `₦${withdrawAmount.toLocaleString()} is being sent to ${effectiveAccountName}.`,
      });

      await createNotification({
        userId: user.id,
        type: 'withdrawal_completed',
        title: 'Withdrawal Initiated',
        message: `₦${withdrawAmount.toLocaleString()} withdrawal to ${effectiveBank} • ${effectiveAccountName} is processing.`,
      });

      setAmount('');
      if (mode === 'other') {
        setAccountNumber('');
        setAccountName(null);
        setIsVerified(false);
        setSelectedBank(null);
        setFaceVerified(false);
      }
      await Promise.all([fetchPendingWithdrawals(), refetch()]);
    } catch {
      toast({ title: 'Error', description: 'Failed to process withdrawal.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePaid = async (withdrawal: PendingWithdrawal) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: withdrawalError } = await supabase
        .from('withdrawals')
        .update({ status: 'SUCCESS' })
        .eq('id', withdrawal.id);
      if (withdrawalError) throw withdrawalError;

      const { data: transactions, error: txFindError } = await supabase
        .from('transactions')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('kind', 'WITHDRAW')
        .eq('status', 'PROCESSING');
      if (txFindError) throw txFindError;

      const relatedTx = transactions?.find(tx => {
        const metadata = tx.metadata as { withdrawal_id?: string } | null;
        return metadata?.withdrawal_id === withdrawal.id;
      });

      if (relatedTx) {
        await supabase.from('transactions').update({ status: 'SUCCESS' }).eq('id', relatedTx.id);
      }

      toast({ title: 'Withdrawal completed!', description: `₦${withdrawal.amount.toLocaleString()} sent to ${withdrawal.account_name}.` });
      await Promise.all([fetchPendingWithdrawals(), refetch()]);
    } catch {
      toast({ title: 'Error', description: 'Failed to simulate payment.', variant: 'destructive' });
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
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(amount);
  };

  const handleProceedWithdraw = () => {
    if (mode === 'other' && !faceVerified) {
      setFaceVerifyOpen(true);
      return;
    }
    handleWithdraw();
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />

      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Withdraw to Bank</h1>
              <p className="text-xs text-muted-foreground">Send NGN to your bank</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Available Balance */}
        <Card className="glass-card border-success/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Available Balance</p>
                <p className="text-xl sm:text-2xl font-bold font-mono truncate">{mask(formatCurrency(availableBalance))}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                <span className="text-lg text-success">₦</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Mode Selection */}
        {defaultAccount && (
          <Card className="glass-card border-border/50">
            <CardContent className="py-3">
              <div className="flex gap-2">
                <Button
                  variant={mode === 'default' ? 'default' : 'outline'}
                  className={`flex-1 text-xs ${mode === 'default' ? 'gradient-primary' : ''}`}
                  onClick={() => { setMode('default'); setFaceVerified(false); }}
                >
                  <Star className="w-3.5 h-3.5 mr-1" />
                  Default Account
                </Button>
                <Button
                  variant={mode === 'other' ? 'default' : 'outline'}
                  className={`flex-1 text-xs ${mode === 'other' ? 'gradient-primary' : ''}`}
                  onClick={() => { setMode('other'); setFaceVerified(false); }}
                >
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  Other Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Account Display */}
        {mode === 'default' && defaultAccount && (
          <Card className="glass-card border-success/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Withdraw to Default Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <User className="w-4 h-4 text-success" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{defaultAccount.bank_name}</p>
                  <p className="text-xs text-muted-foreground">{defaultAccount.account_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{defaultAccount.account_number}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] gap-0.5">
                  <Star className="w-2.5 h-2.5" />
                  Default
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-success/5">
                <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  Withdrawals to your default account are processed securely.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Account - Bank Details */}
        {(mode === 'other' || !defaultAccount) && (
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === 'other' && defaultAccount && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    This withdrawal requires identity verification for security.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Select Bank</Label>
                <Select onValueChange={handleBankChange} value={selectedBank?.code || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
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
                  <Button variant="outline" onClick={handleVerifyAccount} disabled={!selectedBank || accountNumber.length !== 10 || isVerifying}>
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
              </div>

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
        )}

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
                disabled={!effectiveVerified}
              />
            </div>

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

        {/* Face verification status for other account */}
        {mode === 'other' && defaultAccount && faceVerified && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <ShieldCheck className="w-4 h-4 text-success" />
            <p className="text-sm text-success font-medium">Identity verified for this withdrawal</p>
          </div>
        )}

        {/* Confirm Button */}
        <Button
          className="w-full touch-target gradient-primary hover:opacity-90"
          onClick={handleProceedWithdraw}
          disabled={
            loading ||
            !effectiveVerified ||
            withdrawAmount <= 0 ||
            totalDeduction > availableBalance
          }
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mode === 'other' && defaultAccount && !faceVerified ? (
            'Verify Identity & Withdraw'
          ) : (
            'Confirm Withdrawal'
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
                <div key={withdrawal.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div>
                    <p className="font-medium">{formatCurrency(withdrawal.amount)}</p>
                    <p className="text-xs text-muted-foreground">{withdrawal.bank_name} • {withdrawal.account_name}</p>
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
                <Button variant="ghost" size="sm" onClick={() => setShowDevTools(!showDevTools)}>
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

      <BottomNav />

      <FaceVerificationModal
        open={faceVerifyOpen}
        onOpenChange={setFaceVerifyOpen}
        onVerified={() => {
          setFaceVerified(true);
          // After verification, proceed with withdrawal
          handleWithdraw();
        }}
      />
    </div>
  );
};

export default Withdraw;
