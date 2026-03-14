import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallets } from '@/hooks/useWallets';
import { usePaymentRequests, type PaymentRequest } from '@/hooks/usePaymentRequests';
import { supabase } from '@/integrations/supabase/client';
import { mockRateProvider, CONVERSION_FEE_PERCENTAGE } from '@/adapters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  HandCoins,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const statusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return <Badge className="status-pending border text-xs">Pending</Badge>;
    case 'PAID':
      return <Badge className="status-success text-xs">Paid</Badge>;
    case 'DECLINED':
      return <Badge variant="destructive" className="text-xs">Declined</Badge>;
    case 'EXPIRED':
      return <Badge variant="outline" className="text-xs text-muted-foreground">Expired</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

const formatAsset = (amount: number, asset: string) => {
  if (asset === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${amount} ${asset}`;
};

export function PaymentRequests() {
  const { user } = useAuth();
  const { ngnBalance, cryptoBalances, refetch: refetchWallets } = useWallets();
  const { received, sent, loading, refetch } = usePaymentRequests();
  const { toast } = useToast();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [convertPayReq, setConvertPayReq] = useState<PaymentRequest | null>(null);
  const [convertQuote, setConvertQuote] = useState<{
    token: string;
    amount: number;
    rate: number;
    fee: number;
    netNgn: number;
  } | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const pendingReceived = received.filter(r => r.status === 'PENDING');
  const pendingSent = sent.filter(r => r.status === 'PENDING');

  const handlePay = async (req: PaymentRequest) => {
    if (!user) return;

    // For NGN requests, check balance first
    if (req.asset === 'NGN') {
      const ngnAvailable = ngnBalance?.balance ?? 0;
      if (ngnAvailable < req.amount) {
        // Show convert & pay modal
        await showConvertPayModal(req);
        return;
      }

      // Direct NGN payment via RPC
      setActionLoading(req.id);
      try {
        const { data, error } = await supabase.rpc('pay_payment_request', {
          _request_id: req.id,
        });

        if (error) throw error;
        const result = data as { success: boolean; error?: string; reference?: string };
        if (!result.success) {
          toast({ title: 'Payment failed', description: result.error, variant: 'destructive' });
          return;
        }

        toast({ title: 'Payment sent!', description: `Paid ₦${req.amount.toLocaleString()} to @${req.requester_username}` });
        await Promise.all([refetch(), refetchWallets()]);
      } catch (err) {
        console.error('Pay error:', err);
        toast({ title: 'Error', description: 'Failed to process payment.', variant: 'destructive' });
      } finally {
        setActionLoading(null);
      }
    } else {
      // USDT request - for now just show unsupported
      toast({ title: 'Not supported yet', description: 'USDT payment requests coming soon.', variant: 'destructive' });
    }
  };

  const showConvertPayModal = async (req: PaymentRequest) => {
    setConvertPayReq(req);
    setConvertLoading(true);

    try {
      // Find best crypto balance to convert
      const usdtBalance = cryptoBalances.find(b => b.token === 'USDT')?.balance ?? 0;
      const usdcBalance = cryptoBalances.find(b => b.token === 'USDC')?.balance ?? 0;
      const ngnAvailable = ngnBalance?.balance ?? 0;
      const shortfall = req.amount - ngnAvailable;

      // Get a quote for the shortfall
      const token = usdtBalance >= usdcBalance ? 'USDT' : 'USDC';
      const quote = await mockRateProvider.getQuote(token, 0, 'NGN');
      
      // Calculate how much crypto needed for the shortfall (accounting for 1% fee)
      const cryptoNeeded = Math.ceil((shortfall / (quote.rate * (1 - CONVERSION_FEE_PERCENTAGE / 100))) * 100) / 100;
      const grossNgn = cryptoNeeded * quote.rate;
      const fee = grossNgn * (CONVERSION_FEE_PERCENTAGE / 100);
      const netNgn = grossNgn - fee;

      const bestBalance = token === 'USDT' ? usdtBalance : usdcBalance;
      if (bestBalance < cryptoNeeded) {
        toast({
          title: 'Insufficient balance',
          description: `You need ${cryptoNeeded} ${token} but only have ${bestBalance}.`,
          variant: 'destructive',
        });
        setConvertPayReq(null);
        return;
      }

      setConvertQuote({
        token,
        amount: cryptoNeeded,
        rate: quote.rate,
        fee: Math.round(fee * 100) / 100,
        netNgn: Math.round(netNgn * 100) / 100,
      });
    } catch (err) {
      console.error('Quote error:', err);
      toast({ title: 'Error', description: 'Failed to get conversion quote.', variant: 'destructive' });
      setConvertPayReq(null);
    } finally {
      setConvertLoading(false);
    }
  };

  const handleConvertAndPay = async () => {
    if (!convertPayReq || !convertQuote || !user) return;

    setConvertLoading(true);
    try {
      // Step 1: Convert crypto to NGN
      const { data: convData, error: convError } = await supabase.rpc('convert_crypto_to_ngn', {
        _token: convertQuote.token,
        _network: 'base',
        _amount: convertQuote.amount,
        _rate: convertQuote.rate,
        _fee: convertQuote.fee,
        _net_ngn: convertQuote.netNgn,
      });

      if (convError) throw convError;
      const convResult = convData as { success: boolean; error?: string };
      if (!convResult.success) {
        toast({ title: 'Conversion failed', description: convResult.error, variant: 'destructive' });
        return;
      }

      // Step 2: Pay the request
      const { data: payData, error: payError } = await supabase.rpc('pay_payment_request', {
        _request_id: convertPayReq.id,
      });

      if (payError) throw payError;
      const payResult = payData as { success: boolean; error?: string; reference?: string };
      if (!payResult.success) {
        toast({ title: 'Payment failed after conversion', description: payResult.error, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Convert & Pay complete!',
        description: `Converted ${convertQuote.amount} ${convertQuote.token} and paid ₦${convertPayReq.amount.toLocaleString()}`,
      });

      setConvertPayReq(null);
      setConvertQuote(null);
      await Promise.all([refetch(), refetchWallets()]);
    } catch (err) {
      console.error('Convert & pay error:', err);
      toast({ title: 'Error', description: 'Failed to convert and pay.', variant: 'destructive' });
    } finally {
      setConvertLoading(false);
    }
  };

  const handleDecline = async (req: PaymentRequest) => {
    if (!user) return;
    setActionLoading(req.id);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'DECLINED' as any, updated_at: new Date().toISOString() })
        .eq('id', req.id);

      if (error) throw error;
      toast({ title: 'Request declined' });
      await refetch();
    } catch (err) {
      console.error('Decline error:', err);
      toast({ title: 'Error', description: 'Failed to decline request.', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = pendingReceived.length + pendingSent.length;
  if (!loading && totalPending === 0 && received.length === 0 && sent.length === 0) return null;

  const renderRequestCard = (req: PaymentRequest, type: 'received' | 'sent') => {
    const isPending = req.status === 'PENDING';
    const isExpired = req.status === 'EXPIRED';
    const expiresIn = isPending
      ? formatDistanceToNow(new Date(req.expires_at), { addSuffix: false })
      : null;

    return (
      <div key={req.id} className="p-3 rounded-lg bg-background/50 border border-border/30 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {type === 'received'
                ? `@${req.requester_username} requested`
                : `@${req.recipient_username}`}
            </p>
            <p className="text-lg font-bold font-mono">{formatAsset(req.amount, req.asset)}</p>
            {req.note && <p className="text-xs text-muted-foreground truncate">{req.note}</p>}
          </div>
          {statusBadge(req.status)}
        </div>

        {isPending && expiresIn && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Expires in {expiresIn}</span>
          </div>
        )}

        {type === 'received' && isPending && !isExpired && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 gradient-primary hover:opacity-90"
              onClick={() => handlePay(req)}
              disabled={actionLoading === req.id}
            >
              {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pay'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => handleDecline(req)}
              disabled={actionLoading === req.id}
            >
              Decline
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HandCoins className="w-4 h-4" />
            Payment Requests
            {totalPending > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">{totalPending}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="received" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="received" className="flex-1 text-xs">
                Received {pendingReceived.length > 0 && `(${pendingReceived.length})`}
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1 text-xs">
                Sent {pendingSent.length > 0 && `(${pendingSent.length})`}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="received" className="space-y-2 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : received.length > 0 ? (
                received.slice(0, 5).map(r => renderRequestCard(r, 'received'))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No requests received</p>
              )}
            </TabsContent>
            <TabsContent value="sent" className="space-y-2 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : sent.length > 0 ? (
                sent.slice(0, 5).map(r => renderRequestCard(r, 'sent'))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No requests sent</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Convert & Pay Modal */}
      <Dialog open={!!convertPayReq} onOpenChange={(open) => { if (!open) { setConvertPayReq(null); setConvertQuote(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Convert & Pay
            </DialogTitle>
            <DialogDescription>
              Insufficient NGN balance. Convert crypto to complete payment.
            </DialogDescription>
          </DialogHeader>

          {convertLoading && !convertQuote ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : convertQuote && convertPayReq ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Request amount</span>
                  <span className="font-medium">{formatAsset(convertPayReq.amount, convertPayReq.asset)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">NGN available</span>
                  <span>₦{(ngnBalance?.balance ?? 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3" />
                  Converting crypto to cover shortfall
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Convert</span>
                  <span className="font-medium">{convertQuote.amount} {convertQuote.token}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span>₦{convertQuote.rate.toLocaleString()}/{convertQuote.token}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee ({CONVERSION_FEE_PERCENTAGE}%)</span>
                  <span>₦{convertQuote.fee.toLocaleString()}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between text-sm font-medium">
                  <span>You receive</span>
                  <span className="text-success">₦{convertQuote.netNgn.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setConvertPayReq(null); setConvertQuote(null); }}>
              Cancel
            </Button>
            <Button
              className="gradient-primary"
              onClick={handleConvertAndPay}
              disabled={convertLoading || !convertQuote}
            >
              {convertLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert & Pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
