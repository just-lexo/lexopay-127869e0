import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { mockRateProvider, CONVERSION_FEE_PERCENTAGE, type ConversionQuote } from '@/adapters';
import { TestModeBanner } from '@/components/TestModeBanner';
 import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw,
  ArrowDown,
  Check,
  AlertCircle,
  Info
} from 'lucide-react';

const Convert = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cryptoBalances, ngnBalance, refetch, cryptoWalletId, ngnWalletId } = useWallets();
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState<string>('USDT');
  const [amount, setAmount] = useState<string>('');
  const [quote, setQuote] = useState<ConversionQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedBalance = cryptoBalances.find(
    b => b.token === selectedToken && b.network === 'base'
  );
  const availableBalance = selectedBalance?.balance ?? 0;

  // Fetch quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        setQuote(null);
        return;
      }

      setLoading(true);
      try {
        const result = await mockRateProvider.getQuote(selectedToken, numAmount, 'NGN');
        setQuote(result);
      } catch (err) {
        console.error('Error fetching quote:', err);
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, selectedToken]);

  const handleMaxClick = () => {
    setAmount(availableBalance.toString());
  };

  const handleConvert = async () => {
    if (!user || !quote || !cryptoWalletId || !ngnWalletId) return;

    const numAmount = parseFloat(amount);
    if (numAmount > availableBalance) {
      toast({
        title: 'Insufficient balance',
        description: `You only have ${availableBalance} ${selectedToken} available.`,
        variant: 'destructive',
      });
      return;
    }

    setConverting(true);
    try {
      // 1. Deduct from crypto balance
      const newCryptoBalance = availableBalance - numAmount;
      const { error: cryptoError } = await supabase
        .from('crypto_balances')
        .update({ balance: newCryptoBalance })
        .eq('wallet_id', cryptoWalletId)
        .eq('token', selectedToken)
        .eq('network', 'base');

      if (cryptoError) throw cryptoError;

      // 2. Add to NGN balance
      const currentNgnBalance = ngnBalance?.balance ?? 0;
      const newNgnBalance = currentNgnBalance + quote.netAmount;
      const { error: ngnError } = await supabase
        .from('ngn_balances')
        .update({ balance: newNgnBalance })
        .eq('wallet_id', ngnWalletId);

      if (ngnError) throw ngnError;

      // 3. Create conversion record
      const { error: conversionError } = await supabase
        .from('conversions')
        .insert({
          user_id: user.id,
          from_token: selectedToken,
          from_network: 'base',
          from_amount: numAmount,
          rate: quote.rate,
          fee: quote.fee,
          ngn_amount: quote.netAmount,
          status: 'SUCCESS',
        });

      if (conversionError) throw conversionError;

      // 4. Create transaction record with correct format
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          kind: 'CONVERT',
          title: 'Crypto Conversion',
          subtitle: `${selectedToken} to NGN`,
          amount_display: `-${numAmount} ${selectedToken} → +₦${quote.netAmount.toLocaleString()} (fee: ₦${quote.fee.toLocaleString()})`,
          status: 'SUCCESS',
          metadata: {
            from_amount: numAmount,
            from_token: selectedToken,
            from_network: 'base',
            rate: quote.rate,
            fee: quote.fee,
            ngn_amount: quote.netAmount,
          },
        });

      if (txError) throw txError;

      setShowSuccess(true);
      await refetch();

      toast({
        title: 'Conversion successful!',
        description: `${numAmount} ${selectedToken} → ₦${quote.netAmount.toLocaleString()}`,
      });
    } catch (err) {
      console.error('Error converting:', err);
      toast({
        title: 'Conversion failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
    }
  };

  const formatNGN = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (showSuccess && quote) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="glass-card border-b border-border/50">
          <div className="container px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold">Conversion Complete</h1>
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
                <p className="text-muted-foreground mb-2">You converted</p>
                <p className="text-2xl font-bold">{amount} {selectedToken}</p>
              </div>

              <ArrowDown className="w-6 h-6 text-muted-foreground mx-auto" />

              <div>
                <p className="text-muted-foreground mb-2">You received</p>
                <p className="text-3xl font-bold text-success">{formatNGN(quote.netAmount)}</p>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span>{formatNGN(quote.rate)} / {selectedToken}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee ({CONVERSION_FEE_PERCENTAGE}%)</span>
                  <span>{formatNGN(quote.fee)}</span>
                </div>
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
                <Button
                  className="flex-1 gradient-primary"
                  onClick={() => navigate('/dashboard')}
                >
                  Done
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Convert to NGN</h1>
              <p className="text-xs text-muted-foreground">Exchange crypto for Naira</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* From Token */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">From</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary h-auto py-1"
                onClick={handleMaxClick}
              >
                Max
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token Selector */}
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

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                <span className="text-xs text-muted-foreground">
                  Balance: {availableBalance.toFixed(2)} {selectedToken}
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

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* To NGN */}
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
                  <p className="text-xl font-mono font-medium">
                    {formatNGN(quote.netAmount)}
                  </p>
                ) : (
                  <p className="text-xl font-mono text-muted-foreground">₦0.00</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Details */}
        {quote && (
          <Card className="glass-card border-border/50">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-3 h-3" />
                  <span>Exchange Rate</span>
                </div>
                <span className="font-mono">
                  1 {selectedToken} = {formatNGN(quote.rate)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-3 h-3" />
                  <span>Fee ({CONVERSION_FEE_PERCENTAGE}%)</span>
                </div>
                <span className="font-mono">{formatNGN(quote.fee)}</span>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="font-medium">You receive</span>
                <span className="font-mono font-bold text-success">
                  {formatNGN(quote.netAmount)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Helper Text - show when conversion is not possible */}
        {availableBalance === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Deposit crypto to enable conversion.
            </p>
          </div>
        )}

        {availableBalance > 0 && parseFloat(amount) > availableBalance && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Amount exceeds your balance of {availableBalance.toFixed(2)} {selectedToken}.
            </p>
          </div>
        )}

        {/* Convert Button */}
        {(() => {
          const numAmount = parseFloat(amount) || 0;
          const isDisabled = 
            converting || 
            availableBalance === 0 ||
            !quote || 
            !amount || 
            numAmount <= 0 || 
            numAmount > availableBalance;

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
                  Convert to NGN
                </>
              )}
            </Button>
          );
        })()}

        {/* Info Note */}
        <p className="text-xs text-muted-foreground text-center">
          Conversion is instant. NGN will be added to your wallet immediately.
        </p>
      </main>

      <BottomNav />
    </div>
  );
};

export default Convert;
