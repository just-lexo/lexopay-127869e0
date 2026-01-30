import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  ArrowDownToLine, 
  RefreshCw, 
  ArrowUpFromLine, 
  History,
  LogOut,
  Shield,
  Loader2,
  Send
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { cryptoBalances, ngnBalance, loading } = useWallets();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getKYCBadge = (tier: number) => {
    const tiers = [
      { label: 'Unverified', variant: 'outline' as const },
      { label: 'Basic', variant: 'secondary' as const },
      { label: 'Verified', variant: 'default' as const },
      { label: 'Premium', variant: 'default' as const },
    ];
    return tiers[tier] || tiers[0];
  };

  const kycBadge = getKYCBadge(profile?.kyc_tier ?? 0);

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    if (currency === 'NGN') {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
      }).format(amount);
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalCryptoUSD = cryptoBalances.reduce((sum, b) => sum + b.balance, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">L</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Welcome back,</p>
                <p className="font-semibold">{profile?.display_name || 'User'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={kycBadge.variant} className="gap-1">
                <Shield className="w-3 h-3" />
                {kycBadge.label}
              </Badge>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Wallet Cards */}
            <div className="grid gap-4">
              {/* Crypto Wallet */}
              <Card className="glass-card border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Crypto Wallet</CardTitle>
                        <p className="text-xs text-muted-foreground">Your raw holdings</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ≈ ${formatCurrency(totalCryptoUSD, 'USD')} USD
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cryptoBalances.length > 0 ? (
                    cryptoBalances.map((balance) => (
                      <div
                        key={balance.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-success">$</span>
                          </div>
                          <div>
                            <p className="font-medium">{balance.token}</p>
                            <p className="text-xs text-muted-foreground capitalize">{balance.network}</p>
                          </div>
                        </div>
                        <p className="font-mono font-medium">
                          {formatCurrency(balance.balance, 'USD')}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No crypto balances yet. Deposit to get started!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* NGN Wallet */}
              <Card className="glass-card border-success/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                      <span className="text-xl text-success">₦</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">NGN Wallet</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {(ngnBalance?.balance ?? 0) > 0 ? 'Ready to withdraw' : 'No funds yet'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                    <p className="text-2xl font-bold font-mono">
                      {formatCurrency(ngnBalance?.balance ?? 0)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 glass-card-hover border-border/50"
                onClick={() => navigate('/deposit')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Deposit</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 glass-card-hover border-border/50"
                onClick={() => navigate('/send')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Send</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 glass-card-hover border-border/50"
                onClick={() => navigate('/convert')}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Convert</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 glass-card-hover border-border/50"
                onClick={() => navigate('/withdraw')}
              >
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <ArrowUpFromLine className="w-5 h-5 text-success" />
                </div>
                <span className="font-medium text-sm">Withdraw</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 glass-card-hover border-border/50 col-span-2"
                onClick={() => navigate('/transactions')}
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <History className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm">Transaction History</span>
              </Button>
            </div>

            {/* Recent Activity */}
            <RecentActivity />

            {/* Username Display */}
            <Card className="glass-card border-border/50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your LexoPay ID</p>
                    <p className="font-mono text-primary">@{profile?.username}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Share for P2P
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
