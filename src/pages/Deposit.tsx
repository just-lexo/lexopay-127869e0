import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_TOKENS, SUPPORTED_NETWORKS, type SupportedToken, type NetworkId } from '@/adapters';
import { generateUserDepositAddress } from '@/services/depositPipeline';
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
  Clock,
  CheckCircle2,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { TransactionGate, useTransactionGate } from '@/components/TransactionGate';

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
  const { user } = useAuth();
  const { refetch } = useWallets();
  const { toast } = useToast();
  const { maintenance } = useMaintenanceMode();
  const { allowed: gateAllowed } = useTransactionGate();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDC');
  const [selectedNetwork] = useState<NetworkId>('base');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('deposit');

  const fetchDeposits = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setDeposits(data as unknown as DepositRecord[]);
  };

  useEffect(() => { fetchDeposits(); }, [user]);

  const pendingDeposits = deposits.filter(d => d.status === 'PENDING' || d.status === 'DETECTED');

  const handleGenerateAddress = async () => {
    if (!user) return;
    if (maintenance) {
      toast({ title: 'Under maintenance', description: 'LexoPay is currently under maintenance. Please try again later.', variant: 'destructive' });
      return;
    }
    if (!gateAllowed) {
      toast({ title: 'Action blocked', description: 'Verify your email and complete KYC to deposit.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const address = generateUserDepositAddress(user.id);
      setDepositAddress(address);
      toast({ title: 'Address generated', description: 'Send your crypto to this address.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to generate address.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!depositAddress) return;
    await navigator.clipboard.writeText(depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!' });
  };

  const activeNetwork = SUPPORTED_NETWORKS.find(n => n.id === selectedNetwork);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
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
              {deposits.length > 0 && <span className="ml-1 text-[10px] bg-muted-foreground/20 px-1.5 rounded-full">{deposits.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            {/* Asset Selector */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Select Asset</CardTitle></CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                {SUPPORTED_TOKENS.map((token) => (
                  <Button key={token} variant={selectedToken === token ? 'default' : 'outline'} className={`min-h-[44px] ${selectedToken === token ? 'gradient-primary' : 'glass-card-hover'}`} onClick={() => setSelectedToken(token)}>
                    {token}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Network */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Network</CardTitle></CardHeader>
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
              <Button className="w-full touch-target gradient-primary hover:opacity-90" onClick={handleGenerateAddress} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><QrCode className="w-4 h-4 mr-2" />Generate Deposit Address</>}
              </Button>
            ) : (
              <Card className="glass-card border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" />Your Deposit Address</CardTitle>
                  <CardDescription>Send {selectedToken} on {activeNetwork?.name} to this address</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-xl">
                      <QRCodeSVG value={depositAddress} size={180} level="H" includeMargin={false} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-background/50">
                    <code className="flex-1 text-xs break-all font-mono">{depositAddress}</code>
                    <Button variant="ghost" size="icon" onClick={handleCopyAddress}>
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Clock className="w-4 h-4 text-primary mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      After sending, your deposit will be automatically detected and confirmed on-chain. This usually takes a few minutes.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                    <p className="text-xs text-warning">
                      Only send {selectedToken} on Base network. Other assets or networks may result in loss of funds.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pending Deposits */}
            {pendingDeposits.length > 0 && (
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Active Deposits</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {pendingDeposits.map((deposit) => {
                    const sc = statusConfig[deposit.status] || statusConfig.PENDING;
                    return (
                      <div key={deposit.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors" onClick={() => navigate(`/deposit/${deposit.id}`)}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">{sc.icon}</div>
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
                  <Card key={dep.id} className="glass-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/deposit/${dep.id}`)}>
                    <CardContent className="py-3 px-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">{sc.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className="font-medium text-sm">{dep.token} Deposit</p>
                            <Badge className={`${sc.badge} text-xs`}>{sc.label}</Badge>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}</p>
                            {dep.amount && <span className="text-sm font-mono font-medium text-success">+{dep.amount} {dep.token}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
};

export default Deposit;
