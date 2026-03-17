import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Clock,
  Radio,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

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

const DepositDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [deposit, setDeposit] = useState<DepositRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeposit = async () => {
      if (!user || !id) return;
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setDeposit(data as unknown as DepositRecord);
      }
      setLoading(false);
    };
    fetchDeposit();
  }, [user, id]);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const timelineSteps = [
    { key: 'PENDING', label: 'Awaiting Deposit', icon: <Clock className="w-4 h-4" />, time: deposit?.created_at },
    { key: 'DETECTED', label: 'Detected', icon: <Radio className="w-4 h-4" />, time: deposit?.detected_at },
    { key: 'CONFIRMED', label: 'Confirmed', icon: <CheckCircle2 className="w-4 h-4" />, time: deposit?.confirmed_at },
  ];

  const statusOrder = ['PENDING', 'DETECTED', 'CONFIRMED'];
  const currentIndex = deposit ? statusOrder.indexOf(deposit.status) : 0;
  const isFailed = deposit?.status === 'FAILED';

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!deposit) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="font-semibold text-base">Deposit Not Found</h1>
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4">
          <Card className="glass-card border-destructive/20">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-destructive">Deposit not found or access denied.</p>
            </CardContent>
          </Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const refId = deposit.reference_id || 'LX-' + deposit.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />

      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Deposit Details</h1>
              <p className="text-xs text-muted-foreground">{deposit.token} on Base</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Amount & Status */}
        <Card className="glass-card border-primary/20">
          <CardContent className="py-6 text-center">
            {deposit.amount ? (
              <p className="text-3xl font-bold text-success">+{deposit.amount} {deposit.token}</p>
            ) : (
              <p className="text-xl font-medium text-muted-foreground">Awaiting {deposit.token}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1 capitalize">{deposit.network} Network</p>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-4">
            <p className="text-sm font-medium mb-4">Status Timeline</p>
            {isFailed ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Deposit Failed</p>
                  <p className="text-xs text-muted-foreground">This deposit could not be completed.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {timelineSteps.map((step, i) => {
                  const isComplete = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  return (
                    <div key={step.key} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isComplete ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                        } ${isCurrent ? 'ring-2 ring-success/50' : ''}`}>
                          {step.icon}
                        </div>
                        {i < timelineSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${isComplete && i < currentIndex ? 'bg-success/50' : 'bg-border'}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isComplete ? '' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {step.time && (
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(step.time), 'PPpp')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Asset</span>
              <span className="font-medium">{deposit.token}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network</span>
              <span className="capitalize">{deposit.network}</span>
            </div>
            {deposit.amount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{deposit.amount} {deposit.token}</span>
              </div>
            )}
            {deposit.confirmations_count !== null && deposit.confirmations_count > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confirmations</span>
                <span>{deposit.confirmations_count}/12</span>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 space-y-3">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Reference</span>
                <button
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={() => handleCopy(refId, 'ref')}
                >
                  <span className="font-mono text-xs">{refId}</span>
                  {copied === 'ref' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex justify-between text-sm items-start">
                <span className="text-muted-foreground shrink-0">Deposit Address</span>
                <button
                  className="flex items-center gap-1 text-primary hover:underline max-w-[60%]"
                  onClick={() => handleCopy(deposit.address, 'addr')}
                >
                  <span className="font-mono text-xs text-right break-all">{deposit.address.slice(0, 10)}...{deposit.address.slice(-6)}</span>
                  {copied === 'addr' ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                </button>
              </div>

              {deposit.tx_hash && (
                <div className="flex justify-between text-sm items-start">
                  <span className="text-muted-foreground shrink-0">TX Hash</span>
                  <button
                    className="flex items-center gap-1 text-primary hover:underline max-w-[60%]"
                    onClick={() => handleCopy(deposit.tx_hash!, 'tx')}
                  >
                    <span className="font-mono text-xs text-right break-all">{deposit.tx_hash.slice(0, 10)}...{deposit.tx_hash.slice(-6)}</span>
                    {copied === 'tx' ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                  </button>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(deposit.created_at), 'PPpp')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default DepositDetail;
