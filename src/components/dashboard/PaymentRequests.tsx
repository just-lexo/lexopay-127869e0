import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { usePaymentRequests, type PaymentRequest } from '@/hooks/usePaymentRequests';
import { supabase } from '@/integrations/supabase/client';
import { mockRateProvider, CONVERSION_FEE_PERCENTAGE } from '@/adapters';
import { createNotification } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTransactionGate } from '@/components/TransactionGate';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  HandCoins, Clock, Loader2, AlertCircle, RefreshCw, ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const formatAsset = (amount: number, asset: string) =>
  asset === 'NGN' ? `₦${amount.toLocaleString()}` : `${amount} ${asset}`;

export function PaymentRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ngnBalance, cryptoBalances, refetch: refetchWallets } = useWallets();
  const { received, sent, loading, refetch } = usePaymentRequests();
  const { toast } = useToast();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [convertPayReq, setConvertPayReq] = useState<PaymentRequest | null>(null);
  const [convertQuote, setConvertQuote] = useState<{ token: string; amount: number; rate: number; fee: number; netNgn: number } | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const pendingReceived = received.filter(r => r.status === 'PENDING');
  const pendingSent = sent.filter(r => r.status === 'PENDING');
  const pending = [
    ...pendingReceived.map(r => ({ req: r, type: 'received' as const })),
    ...pendingSent.map(r => ({ req: r, type: 'sent' as const })),
  ].sort((a, b) => new Date(b.req.created_at).getTime() - new Date(a.req.created_at).getTime());

  // Hide the section entirely if no active requests
  if (loading) return null;
  if (pending.length === 0) return null;

  const handlePay = async (req: PaymentRequest) => {
    if (!user) return;
    if (req.asset === 'NGN') {
      const ngnAvailable = ngnBalance?.balance ?? 0;
      if (ngnAvailable < req.amount) { await showConvertPayModal(req); return; }
      setActionLoading(req.id);
      try {
        const { data, error } = await supabase.rpc('pay_payment_request', { _request_id: req.id });
        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) { toast({ title: 'Payment failed', description: result.error, variant: 'destructive' }); return; }
        toast({ title: 'Payment sent!', description: `Paid ₦${req.amount.toLocaleString()} to @${req.requester_username}` });
        await createNotification({
          userId: req.requester_id, type: 'payment_request_paid', title: 'Request Paid',
          message: `Your request to @${req.recipient_username} for ₦${req.amount.toLocaleString()} was paid.`,
        });
        await Promise.all([refetch(), refetchWallets()]);
      } catch {
        toast({ title: 'Error', description: 'Failed to process payment.', variant: 'destructive' });
      } finally { setActionLoading(null); }
    } else {
      toast({ title: 'Not supported yet', description: 'USDT payment requests coming soon.', variant: 'destructive' });
    }
  };

  const showConvertPayModal = async (req: PaymentRequest) => {
    setConvertPayReq(req);
    setConvertLoading(true);
    try {
      const usdtBalance = cryptoBalances.find(b => b.token === 'USDT')?.balance ?? 0;
      const usdcBalance = cryptoBalances.find(b => b.token === 'USDC')?.balance ?? 0;
      const ngnAvailable = ngnBalance?.balance ?? 0;
      const shortfall = req.amount - ngnAvailable;
      const token = usdtBalance >= usdcBalance ? 'USDT' : 'USDC';
      const quote = await mockRateProvider.getQuote(token, 0, 'NGN');
      const cryptoNeeded = Math.ceil((shortfall / (quote.rate * (1 - CONVERSION_FEE_PERCENTAGE / 100))) * 100) / 100;
      const grossNgn = cryptoNeeded * quote.rate;
      const fee = grossNgn * (CONVERSION_FEE_PERCENTAGE / 100);
      const netNgn = grossNgn - fee;
      const bestBalance = token === 'USDT' ? usdtBalance : usdcBalance;
      if (bestBalance < cryptoNeeded) {
        toast({ title: 'Insufficient balance', description: `Need ${cryptoNeeded} ${token}, have ${bestBalance}.`, variant: 'destructive' });
        setConvertPayReq(null); return;
      }
      setConvertQuote({ token, amount: cryptoNeeded, rate: quote.rate, fee: Math.round(fee * 100) / 100, netNgn: Math.round(netNgn * 100) / 100 });
    } catch {
      toast({ title: 'Error', description: 'Failed to get conversion quote.', variant: 'destructive' });
      setConvertPayReq(null);
    } finally { setConvertLoading(false); }
  };

  const handleConvertAndPay = async () => {
    if (!convertPayReq || !convertQuote || !user) return;
    setConvertLoading(true);
    try {
      const { data: convData, error: convError } = await supabase.rpc('convert_crypto_to_ngn', {
        _token: convertQuote.token, _network: 'base', _amount: convertQuote.amount,
      });
      if (convError) throw convError;
      const convResult = convData as { success: boolean; error?: string };
      if (!convResult.success) { toast({ title: 'Conversion failed', description: convResult.error, variant: 'destructive' }); return; }
      const { data: payData, error: payError } = await supabase.rpc('pay_payment_request', { _request_id: convertPayReq.id });
      if (payError) throw payError;
      const payResult = payData as { success: boolean; error?: string };
      if (!payResult.success) { toast({ title: 'Payment failed', description: payResult.error, variant: 'destructive' }); return; }
      toast({ title: 'Convert & Pay complete!', description: `Paid ₦${convertPayReq.amount.toLocaleString()}` });
      setConvertPayReq(null); setConvertQuote(null);
      await Promise.all([refetch(), refetchWallets()]);
    } catch {
      toast({ title: 'Error', description: 'Failed to convert and pay.', variant: 'destructive' });
    } finally { setConvertLoading(false); }
  };

  const handleDecline = async (req: PaymentRequest) => {
    setActionLoading(req.id);
    try {
      const { error } = await supabase.from('payment_requests')
        .update({ status: 'DECLINED' as any, updated_at: new Date().toISOString() }).eq('id', req.id);
      if (error) throw error;
      await createNotification({
        userId: req.requester_id, type: 'payment_request_declined', title: 'Request Declined',
        message: `@${req.recipient_username} declined your request for ${formatAsset(req.amount, req.asset)}.`,
      });
      toast({ title: 'Request declined' });
      await refetch();
    } catch {
      toast({ title: 'Error', description: 'Failed to decline.', variant: 'destructive' });
    } finally { setActionLoading(null); }
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-primary" />
            Active Requests
            <Badge variant="default" className="text-[10px] px-1.5 py-0">{pending.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/request')}>
            See all <ArrowRight className="w-3 h-3" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.slice(0, 4).map(({ req, type }) => {
            const expiresIn = formatDistanceToNow(new Date(req.expires_at), { addSuffix: false });
            return (
              <div key={req.id} className="p-3 rounded-lg bg-background/50 border border-border/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {type === 'received' ? `From @${req.requester_username}` : `To @${req.recipient_username}`}
                    </p>
                    <p className="text-base font-bold font-mono mt-0.5">{formatAsset(req.amount, req.asset)}</p>
                    {req.note && <p className="text-xs text-muted-foreground truncate mt-0.5">{req.note}</p>}
                  </div>
                  <Badge className={type === 'received' ? 'bg-primary/15 text-primary border-0 text-[10px]' : 'bg-muted text-muted-foreground border-0 text-[10px]'}>
                    {type === 'received' ? 'Incoming' : 'Outgoing'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" /> Expires in {expiresIn}
                </div>
                {type === 'received' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gradient-primary h-8 text-xs" onClick={() => handlePay(req)} disabled={actionLoading === req.id}>
                      {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pay'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleDecline(req)} disabled={actionLoading === req.id}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Convert & Pay Modal */}
      <Dialog open={!!convertPayReq} onOpenChange={(open) => { if (!open) { setConvertPayReq(null); setConvertQuote(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Convert & Pay</DialogTitle>
            <DialogDescription>Insufficient NGN balance. Convert crypto to complete payment.</DialogDescription>
          </DialogHeader>
          {convertLoading && !convertQuote ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : convertQuote && convertPayReq ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Request</span><span className="font-medium">{formatAsset(convertPayReq.amount, convertPayReq.asset)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">NGN available</span><span>₦{(ngnBalance?.balance ?? 0).toLocaleString()}</span></div>
              </div>
              <div className="flex justify-center text-xs text-muted-foreground gap-1"><AlertCircle className="w-3 h-3" /> Converting crypto to cover shortfall</div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Convert</span><span className="font-medium">{convertQuote.amount} {convertQuote.token}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee ({CONVERSION_FEE_PERCENTAGE}%)</span><span>₦{convertQuote.fee.toLocaleString()}</span></div>
                <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-medium"><span>You receive</span><span className="text-success">₦{convertQuote.netNgn.toLocaleString()}</span></div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setConvertPayReq(null); setConvertQuote(null); }}>Cancel</Button>
            <Button className="gradient-primary" onClick={handleConvertAndPay} disabled={convertLoading || !convertQuote}>
              {convertLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert & Pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
