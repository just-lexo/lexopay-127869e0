import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHideBalances } from '@/hooks/useHideBalances';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_TOKENS, type SupportedToken } from '@/adapters';
import { createNotification } from '@/hooks/useNotifications';
import { TestModeBanner } from '@/components/TestModeBanner';
 import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  Check,
  AlertCircle,
  User,
  Send as SendIcon,
  ArrowRight
} from 'lucide-react';

interface RecipientProfile {
  user_id: string;
  username: string;
  display_name: string | null;
}

const Send = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { cryptoBalances, refetch } = useWallets();
  const { mask } = useHideBalances();
  const { toast } = useToast();

  // Pre-fill recipient from URL query param
  const searchParams = new URLSearchParams(window.location.search);
  const prefillTo = searchParams.get('to') || '';

  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDT');
  const [recipientUsername, setRecipientUsername] = useState(prefillTo ? `@${prefillTo}` : '');
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedBalance = cryptoBalances.find(b => b.token === selectedToken);
  const availableBalance = selectedBalance?.balance ?? 0;
  const sendAmount = parseFloat(amount) || 0;
  const canSend = recipient && sendAmount > 0 && availableBalance >= sendAmount;

  // Auto-search prefilled recipient
  useEffect(() => {
    if (prefillTo && !recipient && !isSearching) {
      handleSearchRecipient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTo]);

  // Normalize username: remove @, trim, lowercase
  const normalizeUsername = (input: string): string => {
    return input.replace('@', '').trim().toLowerCase();
  };

  // Search for recipient by username
  const handleSearchRecipient = async () => {
    const cleanUsername = normalizeUsername(recipientUsername);
    
    if (!cleanUsername) {
      setRecipientError('Please enter a valid @username');
      setRecipient(null);
      return;
    }

    // Prevent self-transfer
    if (profile?.username && cleanUsername === normalizeUsername(profile.username)) {
      setRecipientError("You can't send crypto to yourself");
      setRecipient(null);
      return;
    }

    setIsSearching(true);
    setRecipientError(null);
    
    try {
      const { data, error } = await supabase.rpc('lookup_username', {
        _username: cleanUsername,
      });

      if (error) {
        console.error('Search error:', error);
        setRecipientError('Failed to search for user');
        setRecipient(null);
        return;
      }

      const results = data as RecipientProfile[] | null;
      if (!results || results.length === 0) {
        setRecipientError(`User @${cleanUsername} not found`);
        setRecipient(null);
      } else {
        setRecipient(results[0]);
        setRecipientError(null);
      }
    } catch (err) {
      console.error('Search error:', err);
      setRecipientError('Failed to search for user');
      setRecipient(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSend = async () => {
    if (!user || !recipient || !canSend || !profile) return;

    setLoading(true);
    try {
      // Call atomic transfer function
      const { data, error } = await supabase.rpc('transfer_crypto', {
        _recipient_username: recipient.username,
        _token: selectedToken,
        _network: 'base',
        _amount: sendAmount,
      });

      if (error) {
        console.error('Transfer RPC error:', error);
        toast({
          title: 'Transfer failed',
          description: error.message || 'An unexpected error occurred',
          variant: 'destructive',
        });
        return;
      }

      const result = data as { success: boolean; error?: string; reference?: string };

      if (!result.success) {
        toast({
          title: 'Transfer failed',
          description: result.error || 'An unexpected error occurred',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Transfer successful!',
        description: `${sendAmount} ${selectedToken} sent to @${recipient.username}`,
      });

      // Reset form
      setAmount('');
      setRecipientUsername('');
      setRecipient(null);
      setRecipientError(null);
      setShowConfirm(false);
      
      await refetch();
      navigate('/dashboard');
    } catch (err) {
      console.error('Send error:', err);
      toast({
        title: 'Error',
        description: 'Failed to send crypto. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setRecipientUsername(value);
    setRecipient(null);
    setRecipientError(null);
  };

  if (showConfirm && recipient) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TestModeBanner />
        
        <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowConfirm(false)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="font-semibold text-base">Confirm Transfer</h1>
                <p className="text-xs text-muted-foreground">Review before sending</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
          <Card className="glass-card border-primary/20">
            <CardContent className="py-6 space-y-6">
              {/* Transfer visualization */}
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">@{profile?.username}</p>
                  <p className="text-xs text-muted-foreground">You</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-2">
                    <User className="w-6 h-6 text-success" />
                  </div>
                  <p className="text-sm font-medium">@{recipient.username}</p>
                  <p className="text-xs text-muted-foreground">{recipient.display_name || 'LexoPay User'}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="text-center py-4 border-y border-border/50">
                <p className="text-3xl font-bold">{sendAmount} {selectedToken}</p>
                <p className="text-sm text-muted-foreground mt-1">on Base network</p>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network Fee</span>
                  <span className="text-success">Free (Internal)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{sendAmount} {selectedToken}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full min-h-[48px] gradient-primary hover:opacity-90"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <SendIcon className="w-4 h-4 mr-2" />
                Confirm & Send
              </>
            )}
          </Button>
        </main>

        <BottomNav />
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
              <h1 className="font-semibold text-base">Send Crypto</h1>
              <p className="text-xs text-muted-foreground">Transfer to another LexoPay user</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Token Selection */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Token</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {SUPPORTED_TOKENS.map((token) => {
              const balance = cryptoBalances.find(b => b.token === token);
              return (
                <Button
                  key={token}
                  variant={selectedToken === token ? 'default' : 'outline'}
                  className={`flex-1 flex-col h-auto py-3 ${
                    selectedToken === token ? 'gradient-primary' : 'glass-card-hover'
                  }`}
                  onClick={() => setSelectedToken(token)}
                >
                  <span className="font-medium">{token}</span>
                  <span className="text-xs opacity-80">{mask((balance?.balance ?? 0).toFixed(2))}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Recipient */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Recipient
            </CardTitle>
            <CardDescription>Enter the recipient's @username</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="@username"
                value={recipientUsername}
                onChange={(e) => handleUsernameChange(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleSearchRecipient}
                disabled={!recipientUsername.trim() || isSearching}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Find'
                )}
              </Button>
            </div>

            {/* Error state */}
            {recipientError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{recipientError}</p>
              </div>
            )}

            {/* Verified Recipient */}
            {recipient && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <User className="w-4 h-4 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-success">@{recipient.username}</p>
                  <p className="text-xs text-muted-foreground">{recipient.display_name || 'LexoPay User'}</p>
                </div>
                <Check className="w-4 h-4 text-success" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Amount</CardTitle>
            <CardDescription>
              Available: {mask(availableBalance.toFixed(2))} {selectedToken}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Amount to send</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!recipient}
              />
            </div>

            {sendAmount > availableBalance && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                <p className="text-xs text-destructive">
                  Insufficient balance. You only have {availableBalance.toFixed(2)} {selectedToken}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Continue Button */}
        <Button
          className="w-full min-h-[48px] gradient-primary hover:opacity-90"
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
        >
          <SendIcon className="w-4 h-4 mr-2" />
          Continue
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Send;
