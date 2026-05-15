import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHideBalances } from '@/hooks/useHideBalances';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/hooks/useNotifications';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ArrowDown,
  Check,
  Info,
  Clock,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { TransactionGate, useTransactionGate } from '@/components/TransactionGate';

interface LockedQuote {
  id: string;
  token: string;
  network: string;
  from_amount: number;
  market_rate: number;
  display_rate: number;
  spread_pct: number;
  fee_pct: number;
  fee: number;
  ngn_amount: number;
  expires_at: string;
  ttl_seconds: number;
}

const Convert = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cryptoBalances, refetch, cryptoWalletId, ngnWalletId } = useWallets();
  const { mask } = useHideBalances();
  const { toast } = useToast();
  const { maintenance } = useMaintenanceMode();
  const { allowed: gateAllowed } = useTransactionGate();

  const [selectedToken, setSelectedToken] = useState<string>('USDT');
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<LockedQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const requestIdRef = useRef(0);

  const selectedBalance = cryptoBalances.find(
    (b) => b.token === selectedToken && b.network === 'base',
  );
  const availableBalance = selectedBalance?.balance ?? 0;

  const fetchQuote = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setQuote(null);
      return;
    }
    setLoading(true);
    const reqId = ++requestIdRef.current;
    try {
      const { data, error } = await supabase.functions.invoke('create-conversion-quote', {
        body: { token: selectedToken, network: 'base', amount: numAmount },
      });
      if (reqId !== requestIdRef.current) return; // stale
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Quote failed');
      setQuote(data.quote as LockedQuote);
    } catch (err: any) {
      console.error('Quote error:', err);
      setQuote(null);
      toast({ title: 'Could not fetch rate', description: err?.message || 'Try again', variant: 'destructive' });
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  // Debounced quote fetch on amount/token change
  useEffect(() => {
    const t = setTimeout(fetchQuote, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, selectedToken]);

  // Countdown + auto-refresh on expiry
  useEffect(() => {
    if (!quote) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const ms = new Date(quote.expires_at).getTime() - Date.now();
      const s = Math.max(0, Math.ceil(ms / 1000));
      setSecondsLeft(s);
      if (s === 0) fetchQuote();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  const handleMaxClick = () => setAmount(availableBalance.toString());

  const handleConvert = async () => {
    if (!user || !quote || !cryptoWalletId || !ngnWalletId) return;
    if (maintenance) {
      toast({ title: 'Under maintenance', description: 'LexoPay is currently under maintenance.', variant: 'destructive' });
      return;
    }
    if (!gateAllowed) {
      toast({ title: 'Action blocked', description: 'Verify your email and complete KYC to convert.', variant: 'destructive' });
      return;
    }
    if (secondsLeft <= 0) {
      toast({ title: 'Quote expired', description: 'Refreshing rate…' });
      fetchQuote();
      return;
    }

    setConverting(true);
    try {
      const { data, error } = await supabase.rpc('consume_conversion_quote', { _quote_id: quote.id });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; conversion_id?: string };
      if (!result.success) {
        toast({ title: 'Conversion failed', description: result.error || 'Try again', variant: 'destructive' });
        return;
      }
      setShowSuccess(true);
      await refetch();
      await createNotification({
        userId: user.id,
        type: 'conversion_processing',
        title: 'Conversion Processing',
        message: `Your conversion of ${quote.from_amount} ${quote.token} is being processed.`,
      });
      // Trigger background processor
      supabase.functions.invoke('process-conversions').catch(console.error);
    } catch (err: any) {
      console.error('Convert error:', err);
      toast({ title: 'Conversion failed', description: err?.message || 'Try again', variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  const formatNGN = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(value);

  if (showSuccess && quote) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="glass-card border-b border-border/50">
          <div className="container px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold">Conversion Submitted</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="glass-card border-success/30 w-full max-w-md text-center">
            <CardContent className="pt-8 pb-6 space-y-6">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" />
              </div>
              <div>
                <p className="text-muted-foreground mb-2">Converting</p>
                <p className="text-2xl font-bold">
                  {quote.from_amount} {quote.token}
                </p>
              </div>
              <div className="space-y-3 text-left px-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <span className="text-sm">Rate locked & funds reserved</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary animate-pulse shrink-0" />
                  <span className="text-sm">Converting to NGN…</span>
                </div>
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Crediting wallet</span>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-sm">You'll receive</p>
                <p className="text-2xl font-bold text-success">{formatNGN(quote.ngn_amount)}</p>
                <p className="text-xs text-muted-foreground mt-1">Usually takes a few minutes</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSuccess(false);
                    setAmount('');
                    setQuote(null);
                  }}
                >
                  Convert More
                </Button>
                <Button className="flex-1 gradient-primary" onClick={() => navigate('/dashboard')}>
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const numAmount = parseFloat(amount) || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Convert to NGN</h1>
              <p className="text-xs text-muted-foreground">Live rate • Locked for 60s</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <TransactionGate feature="conversions" />

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">From</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary h-auto py-1" onClick={handleMaxClick}>
                Max
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {cryptoBalances.map((balance) => (
                <Button
                  key={`${balance.token}-${balance.network}`}
                  variant={selectedToken === balance.token ? 'default' : 'outline'}
                  className={selectedToken === balance.token ? 'gradient-primary' : 'glass-card-hover'}
                  onClick={() => setSelectedToken(balance.token)}
                >
                  {balance.token}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <span className="text-xs text-muted-foreground">
                  Balance: {mask(availableBalance.toFixed(2))} {selectedToken}
                </span>
              </div>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xl font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-primary" />
          </div>
        </div>

        <Card className="glass-card border-success/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">To</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-lg text-success">₦</span>
                </div>
                <span className="font-medium">NGN</span>
              </div>
              <div className="text-right">
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : quote ? (
                  <p className="text-xl font-mono font-medium">{formatNGN(quote.ngn_amount)}</p>
                ) : (
                  <p className="text-xl font-mono text-muted-foreground">₦0.00</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {quote && (
          <Card className="glass-card border-border/50">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate (locked)</span>
                <span className="font-mono">
                  1 {quote.token} = {formatNGN(quote.display_rate)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Spread</span>
                <span className="font-mono">{quote.spread_pct}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fee ({quote.fee_pct}%)</span>
                <span className="font-mono">{formatNGN(quote.fee)}</span>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="font-medium">You receive</span>
                <span className="font-mono font-bold text-success">{formatNGN(quote.ngn_amount)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={secondsLeft <= 10 ? 'text-destructive' : 'text-muted-foreground'}>
                  {secondsLeft > 0 ? `Refreshes in ${secondsLeft}s` : 'Refreshing rate…'}
                </span>
                <Button variant="ghost" size="sm" className="h-auto py-1" onClick={fetchQuote} disabled={loading}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {availableBalance === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Deposit crypto to enable conversion.</p>
          </div>
        )}

        {availableBalance > 0 && numAmount > availableBalance && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Amount exceeds your balance of {availableBalance.toFixed(2)} {selectedToken}.
            </p>
          </div>
        )}

        {(() => {
          const isDisabled =
            converting ||
            availableBalance === 0 ||
            !quote ||
            !amount ||
            numAmount <= 0 ||
            numAmount > availableBalance ||
            !gateAllowed ||
            secondsLeft <= 0;

          return (
            <Button
              className={`w-full min-h-[48px] gradient-primary hover:opacity-90 transition-opacity ${
                isDisabled && !converting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={handleConvert}
              disabled={isDisabled}
            >
              {converting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Convert at locked rate
                </>
              )}
            </Button>
          );
        })()}

        <p className="text-xs text-muted-foreground text-center">
          Quote locked for 60 seconds. Funds are reserved on confirm and credited once conversion completes.
        </p>
      </main>

      <BottomNav />
    </div>
  );
};

export default Convert;
