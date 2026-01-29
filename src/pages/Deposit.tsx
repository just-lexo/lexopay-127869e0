import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { baseAdapter, SUPPORTED_TOKENS, SUPPORTED_NETWORKS, type SupportedToken, type NetworkId } from '@/adapters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  Copy, 
  Check, 
  QrCode,
  AlertCircle,
  Wrench
} from 'lucide-react';

interface PendingDeposit {
  id: string;
  token: string;
  network: string;
  address: string;
  status: string;
  created_at: string;
}

const Deposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch } = useWallets();
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('base');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(100);

  // Check if we're in dev mode
  const isDev = import.meta.env.DEV;

  const fetchPendingDeposits = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPendingDeposits(data as PendingDeposit[]);
    }
  };

  useEffect(() => {
    fetchPendingDeposits();
  }, [user]);

  const handleGenerateAddress = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Generate address using adapter
      const result = await baseAdapter.generateDepositAddress(user.id, selectedToken);
      
      // Save to database
      const { error } = await supabase
        .from('deposits')
        .insert({
          user_id: user.id,
          token: selectedToken,
          network: selectedNetwork,
          address: result.address,
          status: 'PENDING',
        });

      if (error) throw error;

      setDepositAddress(result.address);
      await fetchPendingDeposits();

      toast({
        title: 'Address generated',
        description: 'Send your crypto to this address to deposit.',
      });
    } catch (err) {
      console.error('Error generating address:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate deposit address.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!depositAddress) return;
    
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: 'Copied!',
      description: 'Address copied to clipboard.',
    });
  };

  // DEV TOOL: Simulate deposit confirmation
  // Prevents double-crediting by checking current status before confirming
  const handleSimulateConfirm = async (deposit: PendingDeposit) => {
    if (!user) return;

    setLoading(true);
    try {
      // First, verify deposit is still PENDING (prevent double-credit)
      const { data: currentDeposit, error: checkError } = await supabase
        .from('deposits')
        .select('status')
        .eq('id', deposit.id)
        .single();

      if (checkError) throw checkError;

      if (currentDeposit?.status !== 'PENDING') {
        toast({
          title: 'Already processed',
          description: 'This deposit has already been confirmed.',
        });
        await fetchPendingDeposits();
        return;
      }

      const depositAmount = testAmount; // Use dev-configurable test amount

      // Update deposit status
      const { error: depositError } = await supabase
        .from('deposits')
        .update({ 
          status: 'CONFIRMED', 
          amount: depositAmount,
          tx_hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
        })
        .eq('id', deposit.id)
        .eq('status', 'PENDING'); // Double-check status in update

      if (depositError) throw depositError;

      // Get user's crypto wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'CRYPTO')
        .single();

      if (walletError) throw walletError;

      // Update crypto balance - add depositAmount to existing balance
      const { data: existingBalance } = await supabase
        .from('crypto_balances')
        .select('balance')
        .eq('wallet_id', wallet.id)
        .eq('token', deposit.token)
        .eq('network', deposit.network)
        .single();

      const newBalance = (Number(existingBalance?.balance) || 0) + depositAmount;

      const { error: balanceError } = await supabase
        .from('crypto_balances')
        .update({ balance: newBalance })
        .eq('wallet_id', wallet.id)
        .eq('token', deposit.token)
        .eq('network', deposit.network);

      if (balanceError) throw balanceError;

      // Create transaction record with correct format
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          kind: 'DEPOSIT',
          title: 'Crypto Deposit',
          subtitle: `${deposit.token} on ${deposit.network.charAt(0).toUpperCase() + deposit.network.slice(1)}`,
          amount_display: `+${depositAmount} ${deposit.token}`,
          status: 'SUCCESS',
          metadata: { deposit_id: deposit.id, amount: depositAmount },
        });

      if (txError) throw txError;

      toast({
        title: 'Deposit confirmed!',
        description: `${depositAmount} ${deposit.token} added to your wallet.`,
      });

      await fetchPendingDeposits();
      await refetch();
    } catch (err) {
      console.error('Error simulating confirm:', err);
      toast({
        title: 'Error',
        description: 'Failed to simulate confirmation.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const activeNetwork = SUPPORTED_NETWORKS.find(n => n.id === selectedNetwork);

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
              <h1 className="font-semibold">Deposit Crypto</h1>
              <p className="text-xs text-muted-foreground">Add funds to your wallet</p>
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
            {SUPPORTED_TOKENS.map((token) => (
              <Button
                key={token}
                variant={selectedToken === token ? 'default' : 'outline'}
                className={selectedToken === token ? 'gradient-primary' : 'glass-card-hover'}
                onClick={() => setSelectedToken(token)}
              >
                {token}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Network Selection */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Network</CardTitle>
            <CardDescription>Choose the blockchain network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {SUPPORTED_NETWORKS.map((network) => (
              <Button
                key={network.id}
                variant="outline"
                className={`w-full justify-between ${
                  selectedNetwork === network.id 
                    ? 'border-primary bg-primary/10' 
                    : 'glass-card-hover'
                } ${!network.isActive && 'opacity-50'}`}
                onClick={() => network.isActive && setSelectedNetwork(network.id)}
                disabled={!network.isActive}
              >
                <span>{network.name}</span>
                {!network.isActive && (
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                )}
                {selectedNetwork === network.id && network.isActive && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Generate Address or Show Address */}
        {!depositAddress ? (
          <Button
            className="w-full touch-target gradient-primary hover:opacity-90"
            onClick={handleGenerateAddress}
            disabled={loading || !activeNetwork?.isActive}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <QrCode className="w-4 h-4 mr-2" />
                Generate Deposit Address
              </>
            )}
          </Button>
        ) : (
          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Your Deposit Address
              </CardTitle>
              <CardDescription>
                Send {selectedToken} on {activeNetwork?.name} to this address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Placeholder */}
              <div className="aspect-square max-w-[200px] mx-auto bg-muted rounded-xl flex items-center justify-center">
                <QrCode className="w-20 h-20 text-muted-foreground" />
              </div>

              {/* Address */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                <code className="flex-1 text-xs break-all font-mono">
                  {depositAddress}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                <p className="text-xs text-warning">
                  Only send {selectedToken} on {activeNetwork?.name}. Sending other tokens or using wrong network may result in permanent loss.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Deposits */}
        {pendingDeposits.length > 0 && (
          <Card className="glass-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending Deposits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <div>
                    <p className="font-medium">{deposit.token}</p>
                    <p className="text-xs text-muted-foreground capitalize">{deposit.network}</p>
                  </div>
                  <Badge className="status-pending border">Pending</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dev Tools */}
        {isDev && (
          <Card className="glass-card border-warning/30 bg-warning/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Dev Tools
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
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Test Amount:</label>
                  <input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-2 py-1 rounded bg-background border border-border text-sm"
                    min="1"
                  />
                </div>
                {pendingDeposits.length > 0 ? (
                  pendingDeposits.map((deposit) => (
                    <Button
                      key={deposit.id}
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => handleSimulateConfirm(deposit)}
                      disabled={loading}
                    >
                      <span>Confirm {deposit.token} deposit</span>
                      <Badge variant="secondary">+{testAmount}</Badge>
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Generate an address and create a pending deposit first
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

export default Deposit;
