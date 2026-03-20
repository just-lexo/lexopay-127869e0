import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_TOKENS, SUPPORTED_NETWORKS, type SupportedToken, type NetworkId } from '@/adapters';
import { generateUserDepositAddress, handleDepositDetected, handleDepositConfirmed } from '@/services/depositPipeline';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Loader2, 
  Copy, 
  Check, 
  QrCode,
  AlertCircle,
  Wrench,
  Clock,
  CheckCircle2,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DepositRecord {
  id: string;
  token: string;
  network: string;
  address: string;
  status: string;
  amount: number | null;
  tx_hash: string | null;
  reference_id: string | null;
  created_at: string;
  detected_at: string | null;
  confirmed_at: string | null;
  confirmations_count: number | null;
}

const statusConfig: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Awaiting Deposit', badge: 'status-pending border', icon: <Clock className="w-3.5 h-3.5" /> },
  DETECTED: { label: 'Detected', badge: 'bg-primary/20 text-primary border-primary/30', icon: <Radio className="w-3.5 h-3.5" /> },
  CONFIRMED: { label: 'Confirmed', badge: 'status-success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  FAILED: { label: 'Failed', badge: 'bg-destructive/20 text-destructive', icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const Deposit = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { refetch } = useWallets();
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDC');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>('base');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [testAmount, setTestAmount] = useState<number>(100);
  const [activeTab, setActiveTab] = useState('deposit');

  const fetchDeposits = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDeposits(data as unknown as DepositRecord[]);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, [user]);

  const pendingDeposits = deposits.filter(d => d.status === 'PENDING' || d.status === 'DETECTED');

  const handleGenerateAddress = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await baseAdapter.generateDepositAddress(user.id, selectedToken);
      const refId = 'LXP-DEP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      
      const { error } = await supabase
        .from('deposits')
        .insert({
          user_id: user.id,
          token: selectedToken,
          network: selectedNetwork,
          address: result.address,
          status: 'PENDING',
          reference_id: refId,
        } as any);

      if (error) throw error;

      setDepositAddress(result.address);
      await fetchDeposits();

      toast({
        title: 'Address generated',
        description: 'Send your crypto to this address to deposit.',
      });
    } catch (err) {
      console.error('Error generating address:', err);
      toast({ title: 'Error', description: 'Failed to generate deposit address.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!depositAddress) return;
    
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({ title: 'Copied!', description: 'Address copied to clipboard.' });
  };

  // DEV TOOL: Simulate deposit detection
  const handleSimulateDetect = async (deposit: DepositRecord) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('deposits')
        .update({ 
          status: 'DETECTED',
          detected_at: new Date().toISOString(),
          amount: testAmount,
          tx_hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
          confirmations_count: 3,
        } as any)
        .eq('id', deposit.id)
        .eq('status', 'PENDING');

      if (error) throw error;

      await createNotification({
        userId: user.id,
        type: 'deposit_detected',
        title: 'Deposit Detected',
        message: `${testAmount} ${deposit.token} deposit detected on Base. Waiting for confirmations.`,
        relatedKind: 'deposit',
      });

      toast({ title: 'Deposit detected', description: `${testAmount} ${deposit.token} detected, awaiting confirmations.` });
      await fetchDeposits();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to simulate detection.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // DEV TOOL: Simulate deposit confirmation
  const handleSimulateConfirm = async (deposit: DepositRecord) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: currentDeposit } = await supabase
        .from('deposits')
        .select('status, amount')
        .eq('id', deposit.id)
        .single();

      if (!currentDeposit || (currentDeposit.status !== 'PENDING' && currentDeposit.status !== 'DETECTED')) {
        toast({ title: 'Already processed', description: 'This deposit has already been confirmed.' });
        await fetchDeposits();
        return;
      }

      const depositAmount = currentDeposit.amount || testAmount;

      const txHash = deposit.tx_hash || `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;

      const { error: depositError } = await supabase
        .from('deposits')
        .update({ 
          status: 'CONFIRMED', 
          amount: depositAmount,
          tx_hash: txHash,
          confirmed_at: new Date().toISOString(),
          confirmations_count: 12,
        } as any)
        .eq('id', deposit.id);

      if (depositError) throw depositError;

      // Credit balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'CRYPTO')
        .single();

      if (wallet) {
        const { data: existingBalance } = await supabase
          .from('crypto_balances')
          .select('balance')
          .eq('wallet_id', wallet.id)
          .eq('token', deposit.token)
          .eq('network', deposit.network)
          .single();

        if (existingBalance) {
          await supabase
            .from('crypto_balances')
            .update({ balance: (Number(existingBalance.balance) || 0) + depositAmount })
            .eq('wallet_id', wallet.id)
            .eq('token', deposit.token)
            .eq('network', deposit.network);
        } else {
          await supabase.from('crypto_balances').insert({
            wallet_id: wallet.id,
            token: deposit.token,
            network: deposit.network,
            balance: depositAmount,
          });
        }
      }

      const refId = (deposit as any).reference_id || 'LX-' + deposit.id.slice(0, 8).toUpperCase();

      // Create transaction record
      await supabase.from('transactions').insert({
        user_id: user.id,
        kind: 'DEPOSIT',
        title: 'Crypto Deposit',
        subtitle: `${deposit.token} on ${deposit.network.charAt(0).toUpperCase() + deposit.network.slice(1)}`,
        amount_display: `+${depositAmount} ${deposit.token}`,
        status: 'SUCCESS',
        metadata: { deposit_id: deposit.id, amount: depositAmount, token: deposit.token, network: deposit.network, tx_hash: txHash, reference: refId },
      });

      await createNotification({
        userId: user.id,
        type: 'deposit_confirmed',
        title: 'Deposit Confirmed',
        message: `${depositAmount} ${deposit.token} has been added to your wallet.`,
        relatedKind: 'deposit',
      });

      toast({ title: 'Deposit confirmed!', description: `${depositAmount} ${deposit.token} added to your wallet.` });
      await Promise.all([fetchDeposits(), refetch()]);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to simulate confirmation.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const activeNetwork = SUPPORTED_NETWORKS.find(n => n.id === selectedNetwork);

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
              <h1 className="font-semibold text-base">Deposit Crypto</h1>
              <p className="text-xs text-muted-foreground">Add funds to your wallet</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="deposit" className="flex-1">New Deposit</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History
              {deposits.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted-foreground/20 px-1.5 rounded-full">{deposits.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            {/* Asset Selector */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Select Asset</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                {SUPPORTED_TOKENS.map((token) => (
                  <Button
                    key={token}
                    variant={selectedToken === token ? 'default' : 'outline'}
                    className={`min-h-[44px] ${selectedToken === token ? 'gradient-primary' : 'glass-card-hover'}`}
                    onClick={() => setSelectedToken(token)}
                  >
                    {token}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Network */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Network</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">B</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">Base</p>
                      <p className="text-[11px] text-muted-foreground">Only send {selectedToken} on Base network.</p>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-primary" />
                </div>
              </CardContent>
            </Card>

            {/* Deposit Address */}
            {!depositAddress ? (
              <Button
                className="w-full touch-target gradient-primary hover:opacity-90"
                onClick={handleGenerateAddress}
                disabled={loading}
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
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      <QRCodeSVG
                        value={depositAddress}
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                    <code className="flex-1 text-xs break-all font-mono">
                      {depositAddress}
                    </code>
                    <Button variant="ghost" size="icon" onClick={handleCopyAddress}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <p className="text-xs text-warning">
                      Sending any other asset or using another network may result in loss of funds.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Deposits */}
            {pendingDeposits.length > 0 && (
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Active Deposits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingDeposits.map((deposit) => {
                    const sc = statusConfig[deposit.status] || statusConfig.PENDING;
                    return (
                      <div
                        key={deposit.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
                        onClick={() => navigate(`/deposit/${deposit.id}`)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {sc.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{deposit.token}</p>
                            <p className="text-xs text-muted-foreground capitalize">{deposit.network}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${sc.badge} text-xs`}>{sc.label}</Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-2 mt-4">
            {deposits.length === 0 ? (
              <Card className="glass-card border-border/50">
                <CardContent className="py-12 text-center">
                  <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No deposits yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Generate a deposit address to get started</p>
                </CardContent>
              </Card>
            ) : (
              deposits.map((dep) => {
                const sc = statusConfig[dep.status] || statusConfig.PENDING;
                return (
                  <Card
                    key={dep.id}
                    className="glass-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/deposit/${dep.id}`)}
                  >
                    <CardContent className="py-3 px-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {sc.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="font-medium text-sm">{dep.token} Deposit</p>
                            <Badge className={`${sc.badge} text-xs`}>{sc.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{dep.network}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}
                            </p>
                            <div className="flex items-center gap-1">
                              {dep.amount && (
                                <span className="text-sm font-mono font-medium text-success">
                                  +{dep.amount} {dep.token}
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </div>
                          {dep.tx_hash && (
                            <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                              TX: {dep.tx_hash.slice(0, 10)}...{dep.tx_hash.slice(-6)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Admin Tools */}
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
                    <div key={deposit.id} className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-mono">{deposit.token} • {deposit.status}</p>
                      <div className="flex gap-2">
                        {deposit.status === 'PENDING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSimulateDetect(deposit)}
                            disabled={loading}
                          >
                            Simulate Detect
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSimulateConfirm(deposit)}
                          disabled={loading}
                        >
                          Simulate Confirm
                        </Button>
                      </div>
                    </div>
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

      <BottomNav />
    </div>
  );
};

export default Deposit;
