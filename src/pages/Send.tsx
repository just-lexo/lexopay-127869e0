import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_TOKENS, type SupportedToken } from '@/adapters';
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
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDT');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedBalance = cryptoBalances.find(b => b.token === selectedToken);
  const availableBalance = selectedBalance?.balance ?? 0;
  const sendAmount = parseFloat(amount) || 0;
  const canSend = recipient && sendAmount > 0 && availableBalance >= sendAmount;

  // Search for recipient by username
  const handleSearchRecipient = async () => {
    const cleanUsername = recipientUsername.replace('@', '').trim().toLowerCase();
    
    if (!cleanUsername) {
      toast({
        title: 'Enter username',
        description: 'Please enter a valid @username.',
        variant: 'destructive',
      });
      return;
    }

    if (cleanUsername === profile?.username?.toLowerCase()) {
      toast({
        title: 'Invalid recipient',
        description: "You can't send crypto to yourself.",
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .ilike('username', cleanUsername)
        .single();

      if (error || !data) {
        setRecipient(null);
        toast({
          title: 'User not found',
          description: `No user found with username @${cleanUsername}`,
          variant: 'destructive',
        });
      } else {
        setRecipient(data as RecipientProfile);
        toast({
          title: 'User found',
          description: `Sending to ${data.display_name || `@${data.username}`}`,
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      toast({
        title: 'Error',
        description: 'Failed to search for user.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSend = async () => {
    if (!user || !recipient || !canSend || !profile) return;

    setLoading(true);
    try {
      // Get sender's crypto wallet
      const { data: senderWallet, error: senderWalletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'CRYPTO')
        .single();

      if (senderWalletError) throw senderWalletError;

      // Get recipient's crypto wallet
      const { data: recipientWallet, error: recipientWalletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', recipient.user_id)
        .eq('type', 'CRYPTO')
        .single();

      if (recipientWalletError) throw recipientWalletError;

      // Deduct from sender's balance
      const { data: senderBalance } = await supabase
        .from('crypto_balances')
        .select('balance')
        .eq('wallet_id', senderWallet.id)
        .eq('token', selectedToken)
        .eq('network', 'base')
        .single();

      const newSenderBalance = (Number(senderBalance?.balance) || 0) - sendAmount;

      const { error: senderUpdateError } = await supabase
        .from('crypto_balances')
        .update({ balance: newSenderBalance })
        .eq('wallet_id', senderWallet.id)
        .eq('token', selectedToken)
        .eq('network', 'base');

      if (senderUpdateError) throw senderUpdateError;

      // Credit recipient's balance
      const { data: recipientBalance } = await supabase
        .from('crypto_balances')
        .select('balance')
        .eq('wallet_id', recipientWallet.id)
        .eq('token', selectedToken)
        .eq('network', 'base')
        .single();

      const newRecipientBalance = (Number(recipientBalance?.balance) || 0) + sendAmount;

      const { error: recipientUpdateError } = await supabase
        .from('crypto_balances')
        .update({ balance: newRecipientBalance })
        .eq('wallet_id', recipientWallet.id)
        .eq('token', selectedToken)
        .eq('network', 'base');

      if (recipientUpdateError) throw recipientUpdateError;

      const reference = `LXP-SEND-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create sender transaction
      const { error: senderTxError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          kind: 'SEND',
          title: 'Sent Crypto',
          subtitle: `To @${recipient.username}`,
          amount_display: `-${sendAmount} ${selectedToken}`,
          status: 'SUCCESS',
          metadata: {
            reference,
            recipient_user_id: recipient.user_id,
            recipient_username: recipient.username,
            token: selectedToken,
            network: 'base',
            amount: sendAmount,
          },
        });

      if (senderTxError) throw senderTxError;

      // Create recipient transaction
      const { error: recipientTxError } = await supabase
        .from('transactions')
        .insert({
          user_id: recipient.user_id,
          kind: 'RECEIVE',
          title: 'Received Crypto',
          subtitle: `From @${profile.username}`,
          amount_display: `+${sendAmount} ${selectedToken}`,
          status: 'SUCCESS',
          metadata: {
            reference,
            sender_user_id: user.id,
            sender_username: profile.username,
            token: selectedToken,
            network: 'base',
            amount: sendAmount,
          },
        });

      if (recipientTxError) throw recipientTxError;

      toast({
        title: 'Transfer successful!',
        description: `${sendAmount} ${selectedToken} sent to @${recipient.username}`,
      });

      // Reset form
      setAmount('');
      setRecipientUsername('');
      setRecipient(null);
      setShowConfirm(false);
      
      await refetch();
      navigate('/dashboard');
    } catch (err) {
      console.error('Send error:', err);
      toast({
        title: 'Error',
        description: 'Failed to send crypto.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setRecipientUsername(value);
    setRecipient(null);
  };

  if (showConfirm && recipient) {
    return (
      <div className="min-h-screen bg-background">
        <header className="glass-card border-b border-border/50 sticky top-0 z-50">
          <div className="container px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setShowConfirm(false)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold">Confirm Transfer</h1>
                <p className="text-xs text-muted-foreground">Review before sending</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container px-4 py-6 space-y-6">
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
                  <p className="text-xs text-muted-foreground">{recipient.display_name || 'User'}</p>
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
            className="w-full touch-target gradient-primary hover:opacity-90"
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Send Crypto</h1>
              <p className="text-xs text-muted-foreground">Transfer to another LexoPay user</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
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
                  <span className="text-xs opacity-80">{(balance?.balance ?? 0).toFixed(2)}</span>
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
              Available: {availableBalance.toFixed(2)} {selectedToken}
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
          className="w-full touch-target gradient-primary hover:opacity-90"
          onClick={() => setShowConfirm(true)}
          disabled={!canSend}
        >
          <SendIcon className="w-4 h-4 mr-2" />
          Continue
        </Button>
      </main>
    </div>
  );
};

export default Send;