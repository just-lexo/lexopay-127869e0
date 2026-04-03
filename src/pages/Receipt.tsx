import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
  Download,
  Share2,
  Check,
  XCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type TransactionKind = Database['public']['Enums']['transaction_kind'];

interface Transaction {
  id: string;
  kind: TransactionKind;
  title: string;
  subtitle: string | null;
  amount_display: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const getTransactionIcon = (kind: string) => {
  switch (kind) {
    case 'DEPOSIT': return <ArrowDownToLine className="w-6 h-6 text-success" />;
    case 'WITHDRAW': return <ArrowUpFromLine className="w-6 h-6 text-warning" />;
    case 'CONVERT': return <RefreshCw className="w-6 h-6 text-primary" />;
    case 'SEND': return <Send className="w-6 h-6 text-warning" />;
    case 'RECEIVE': return <Download className="w-6 h-6 text-success" />;
    default: return <RefreshCw className="w-6 h-6" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'SUCCESS': return <Check className="w-8 h-8 text-success" />;
    case 'PROCESSING': return <Clock className="w-8 h-8 text-warning" />;
    case 'FAILED': return <XCircle className="w-8 h-8 text-destructive" />;
    default: return <Clock className="w-8 h-8 text-muted-foreground" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'SUCCESS': return 'Completed';
    case 'PROCESSING': return 'Processing';
    case 'FAILED': return 'Failed';
    default: return status;
  }
};

const getTypePill = (kind: string) => {
  const labels: Record<string, string> = {
    DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', CONVERT: 'Conversion', SEND: 'Sent', RECEIVE: 'Received',
  };
  return labels[kind] || kind;
};

const Receipt = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!user || !id) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (!error && data) setTransaction(data as Transaction);
      setLoading(false);
    };
    fetchTransaction();
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="glass-card border-b border-border/50 sticky top-0 z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4"><Skeleton className="h-96 w-full rounded-xl" /></main>
        <BottomNav />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="glass-card border-b border-border/50 sticky top-0 z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
              <h1 className="font-semibold text-base">Receipt Not Found</h1>
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4">
          <Card className="glass-card border-destructive/20"><CardContent className="py-6 text-center"><p className="text-sm text-destructive">Receipt not found or access denied.</p></CardContent></Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const metadata = (transaction.metadata as Record<string, unknown>) || {};
  const reference = (metadata.reference as string) || ('LX-' + transaction.id.slice(0, 8).toUpperCase());
  const txDate = new Date(transaction.created_at);

  // Extract amounts based on type
  const sentAmount = metadata.from_amount ? `${metadata.from_amount} ${metadata.from_token || metadata.token || ''}` : null;
  const receivedAmount = metadata.ngn_amount ? `₦${Number(metadata.ngn_amount).toLocaleString()}` : null;
  const rate = metadata.rate ? `₦${Number(metadata.rate).toLocaleString()}/USD` : null;
  const fee = metadata.fee ? `₦${Number(metadata.fee).toLocaleString()}` : null;
  const network = (metadata.network as string) || 'Base';
  const walletAddr = metadata.tx_hash ? `${(metadata.tx_hash as string).slice(0, 10)}...${(metadata.tx_hash as string).slice(-6)}` : null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LexoPay Receipt`,
          text: `${transaction.amount_display} • ${getStatusLabel(transaction.status)}`,
          url: window.location.href,
        });
      } catch { /* cancelled */ }
    }
  };

  const handleDownload = async () => {
    // Use html2canvas-style approach via canvas API
    if (!receiptRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Simple text-based receipt image
      const width = 600;
      const lines: string[] = [
        'LexoPay — Transaction Receipt',
        '',
        `Status: ${getStatusLabel(transaction.status)}`,
        `Amount: ${transaction.amount_display}`,
        `Type: ${getTypePill(transaction.kind)}`,
        `Date: ${format(txDate, 'PPP')}`,
        `Time: ${format(txDate, 'p')}`,
        '',
        `Reference: ${reference}`,
        `Network: ${network}`,
        ...(sentAmount ? [`You Sent: ${sentAmount}`] : []),
        ...(receivedAmount ? [`You Received: ${receivedAmount}`] : []),
        ...(rate ? [`Exchange Rate: ${rate}`] : []),
        ...(fee ? [`Fee: ${fee}`] : []),
        '',
        'Powered by LexoPay',
      ];

      const lineHeight = 28;
      const height = lines.length * lineHeight + 60;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';

      lines.forEach((line, i) => {
        if (i === 0) {
          ctx.font = 'bold 20px monospace';
          ctx.fillStyle = '#6366f1';
        } else if (line.startsWith('Amount:')) {
          ctx.font = 'bold 18px monospace';
          ctx.fillStyle = '#22c55e';
        } else if (line === 'Powered by LexoPay') {
          ctx.font = '12px monospace';
          ctx.fillStyle = '#666666';
        } else {
          ctx.font = '14px monospace';
          ctx.fillStyle = '#cccccc';
        }
        ctx.fillText(line, 30, 40 + i * lineHeight);
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lexopay-receipt-${reference}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      // fallback
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
            <h1 className="font-semibold text-base">Receipt</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <div ref={receiptRef}>
          <Card className="glass-card border-border/50 overflow-hidden">
            {/* Header */}
            <div className="gradient-primary p-5 text-center text-primary-foreground">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <span className="font-bold text-sm">L</span>
                </div>
                <span className="font-bold">LexoPay</span>
              </div>
              <p className="text-xs opacity-80">Transaction Receipt</p>
            </div>

            <CardContent className="py-6 space-y-5">
              {/* Status + Amount */}
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  {getStatusIcon(transaction.status)}
                </div>
                <p className={`text-2xl font-bold break-all ${transaction.amount_display.startsWith('+') ? 'text-success' : ''}`}>
                  {transaction.amount_display}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {transaction.status === 'SUCCESS' ? 'Credited Successfully' : getStatusLabel(transaction.status)}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-dashed border-border/50" />

              {/* Transaction Info */}
              <div className="space-y-2.5">
                <InfoRow label="Transaction ID" value={transaction.id.slice(0, 8).toUpperCase()} mono />
                <InfoRow label="Type" value={getTypePill(transaction.kind)} />
                <InfoRow label="Date" value={format(txDate, 'PPP')} />
                <InfoRow label="Time" value={format(txDate, 'p')} />
              </div>

              {/* Breakdown */}
              {(sentAmount || receivedAmount || rate || fee) && (
                <>
                  <div className="border-t border-dashed border-border/50" />
                  <div className="space-y-2.5">
                    {sentAmount && <InfoRow label="You Sent" value={sentAmount} bold />}
                    {receivedAmount && <InfoRow label="You Received" value={receivedAmount} bold />}
                    {rate && <InfoRow label="Exchange Rate" value={rate} />}
                    {fee && <InfoRow label="Fee" value={fee} />}
                  </div>
                </>
              )}

              {/* Send/Receive specific */}
              {transaction.kind === 'SEND' && metadata.recipient_username && (
                <InfoRow label="Recipient" value={`@${metadata.recipient_username}`} />
              )}
              {transaction.kind === 'RECEIVE' && metadata.sender_username && (
                <InfoRow label="Sender" value={`@${metadata.sender_username}`} />
              )}

              {/* Status + Reference */}
              <div className="border-t border-dashed border-border/50" />
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={transaction.status === 'SUCCESS' ? 'status-success' : transaction.status === 'PROCESSING' ? 'status-pending border' : 'bg-destructive/20 text-destructive'}>
                    {getStatusLabel(transaction.status)}
                  </Badge>
                </div>
                <InfoRow label="Reference" value={reference} mono />
                <InfoRow label="Network" value={network.charAt(0).toUpperCase() + network.slice(1)} />
                {walletAddr && <InfoRow label="TX Hash" value={walletAddr} mono />}
                <InfoRow label="Account" value={`@${profile?.username || 'user'}`} />
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-border/50 pt-3" />
              <div className="text-center text-xs text-muted-foreground">
                <p>Powered by LexoPay</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="glass-card-hover min-h-[44px]" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />Share
          </Button>
          <Button variant="outline" className="glass-card-hover min-h-[44px]" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />Download
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

const InfoRow = ({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={`text-right max-w-[60%] truncate ${mono ? 'font-mono text-xs' : ''} ${bold ? 'font-semibold' : ''}`}>{value}</span>
  </div>
);

export default Receipt;
