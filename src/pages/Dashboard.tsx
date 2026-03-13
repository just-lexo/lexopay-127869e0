import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { useHideBalances } from '@/hooks/useHideBalances';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TipCard } from '@/components/dashboard/TipCard';
import { TestModeBanner } from '@/components/TestModeBanner';
 import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  ArrowDownToLine, 
  RefreshCw, 
  ArrowUpFromLine, 
  History,
  Shield,
  Loader2,
  Send,
  Eye,
  EyeOff,
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cryptoBalances, ngnBalance, loading } = useWallets();
  const { hidden, toggle, mask } = useHideBalances();

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
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[41px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">L</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Welcome back,</p>
                <p className="font-semibold text-sm truncate">{profile?.display_name || 'User'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {profile?.is_admin && (
                <Badge variant="default" className="gap-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  ADMIN
                </Badge>
              )}
              <Badge variant={kycBadge.variant} className="gap-1 text-[10px] px-1.5 py-0.5 hidden sm:inline-flex">
                <Shield className="w-2.5 h-2.5" />
                {kycBadge.label}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4 pb-6">
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        ≈ {mask(`$${formatCurrency(totalCryptoUSD, 'USD')}`)} USD
                      </p>
                      <button onClick={toggle} className="p-1 rounded-md hover:bg-muted/50 transition-colors" aria-label={hidden ? 'Show balances' : 'Hide balances'}>
                        {hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
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
                          {mask(formatCurrency(balance.balance, 'USD'))}
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
                  <div className="flex items-center justify-between">
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
                    <button onClick={toggle} className="p-1 rounded-md hover:bg-muted/50 transition-colors" aria-label={hidden ? 'Show balances' : 'Hide balances'}>
                      {hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                    <p className="text-xl sm:text-2xl font-bold font-mono break-all">
                      {mask(formatCurrency(ngnBalance?.balance ?? 0))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 glass-card-hover border-border/50 min-h-[72px]"
                onClick={() => navigate('/deposit')}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArrowDownToLine className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium text-xs">Deposit</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 glass-card-hover border-border/50 min-h-[72px]"
                onClick={() => navigate('/send')}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium text-xs">Send</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 glass-card-hover border-border/50 min-h-[72px]"
                onClick={() => navigate('/convert')}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium text-xs">Convert</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 glass-card-hover border-border/50 min-h-[72px]"
                onClick={() => navigate('/withdraw')}
              >
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowUpFromLine className="w-4 h-4 text-success" />
                </div>
                <span className="font-medium text-xs">Withdraw</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 glass-card-hover border-border/50 col-span-2 min-h-[72px]"
                onClick={() => navigate('/transactions')}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <History className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-xs">Transaction History</span>
              </Button>
            </div>

            {/* Recent Activity */}
            <RecentActivity />

          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
