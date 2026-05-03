import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Download, Share2, Check, XCircle, Clock, FileImage, FileText, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Completed',
  PROCESSING: 'Pending',
  FAILED: 'Failed',
};

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: 'Deposit', WITHDRAW: 'Withdrawal', CONVERT: 'Conversion', SEND: 'Sent', RECEIVE: 'Received',
};

const Receipt = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user || !id) return;
      const { data } = await supabase.from('transactions').select('*').eq('id', id).eq('user_id', user.id).single();
      if (data) setTransaction(data as Transaction);
      setLoading(false);
    };
    fetch();
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <SimpleHeader navigate={navigate} title="Receipt" />
        <main className="container max-w-lg mx-auto px-4 py-4"><Skeleton className="h-96 w-full rounded-xl" /></main>
        <BottomNav />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <SimpleHeader navigate={navigate} title="Not found" />
        <main className="container max-w-lg mx-auto px-4 py-4">
          <Card className="glass-card border-destructive/20"><CardContent className="py-6 text-center"><p className="text-sm text-destructive">Receipt not found.</p></CardContent></Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const meta = (transaction.metadata as Record<string, any>) || {};
  const reference = (meta.reference as string) || ('LX-' + transaction.id.slice(0, 8).toUpperCase());
  const txDate = new Date(transaction.created_at);
  const statusLabel = STATUS_LABEL[transaction.status] || transaction.status;
  const typeLabel = TYPE_LABEL[transaction.kind] || transaction.kind;

  // Derive amounts based on transaction kind
  const sentAmount = (() => {
    if (transaction.kind === 'CONVERT' && meta.from_amount) return `${meta.from_amount} ${meta.from_token || ''}`.trim();
    if (transaction.kind === 'SEND' && meta.amount && meta.token) return `${meta.amount} ${meta.token}`;
    if (transaction.kind === 'WITHDRAW' && meta.amount) return `₦${Number(meta.amount).toLocaleString()}`;
    if (transaction.kind === 'SEND' && meta.amount && meta.asset === 'NGN') return `₦${Number(meta.amount).toLocaleString()}`;
    return null;
  })();
  const receivedAmount = (() => {
    if (transaction.kind === 'CONVERT' && meta.ngn_amount) return `₦${Number(meta.ngn_amount).toLocaleString()}`;
    if (transaction.kind === 'RECEIVE' && meta.amount && meta.token) return `${meta.amount} ${meta.token}`;
    if (transaction.kind === 'DEPOSIT' && meta.amount && meta.token) return `${meta.amount} ${meta.token}`;
    return null;
  })();
  const fee = meta.fee ? `₦${Number(meta.fee).toLocaleString()}` : null;
  const network = (meta.network as string) || (transaction.kind === 'WITHDRAW' ? meta.bank_name : 'Base');
  const account = (() => {
    if (transaction.kind === 'WITHDRAW' && meta.account_number) return `${meta.bank_name || ''} • ${meta.account_number}`;
    if (transaction.kind === 'SEND' && meta.recipient_username) return `@${meta.recipient_username}`;
    if (transaction.kind === 'RECEIVE' && meta.sender_username) return `@${meta.sender_username}`;
    return profile?.username ? `@${profile.username}` : null;
  })();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LexoPay Receipt',
          text: `${typeLabel} • ${statusLabel} • ${reference}`,
          url: window.location.href,
        });
      } catch { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: 'Link copied' });
      } catch {
        toast({ title: 'Share unavailable', variant: 'destructive' });
      }
    }
  };

  const captureCanvas = async () => {
    if (!receiptRef.current) return null;
    return await html2canvas(receiptRef.current, {
      backgroundColor: '#0a0a0a',
      scale: 2,
      logging: false,
      useCORS: true,
    });
  };

  const downloadPNG = async () => {
    setExporting('png');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lexopay-${reference}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Image saved' });
      }, 'image/png');
    } catch {
      toast({ title: 'Failed to save image', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const downloadPDF = async () => {
    setExporting('pdf');
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxW = pageW - margin * 2;
      const ratio = canvas.height / canvas.width;
      let imgW = maxW;
      let imgH = imgW * ratio;
      if (imgH > pageH - margin * 2) {
        imgH = pageH - margin * 2;
        imgW = imgH / ratio;
      }
      const x = (pageW - imgW) / 2;
      pdf.addImage(imgData, 'PNG', x, margin, imgW, imgH);
      pdf.save(`lexopay-${reference}.pdf`);
      toast({ title: 'PDF saved' });
    } catch {
      toast({ title: 'Failed to save PDF', variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const StatusIcon =
    transaction.status === 'SUCCESS' ? Check :
    transaction.status === 'FAILED' ? XCircle : Clock;

  const statusColor =
    transaction.status === 'SUCCESS' ? 'bg-success/15 text-success' :
    transaction.status === 'FAILED' ? 'bg-destructive/15 text-destructive' :
    'bg-warning/15 text-warning';

  return (
    <div className="min-h-screen bg-background pb-20">
      <SimpleHeader navigate={navigate} title="Receipt" />

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <div ref={receiptRef} className="bg-background">
          <Card className="border-border/60 overflow-hidden shadow-xl">
            {/* HEADER */}
            <div className="bg-gradient-to-br from-primary to-primary/70 px-5 py-5 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center font-bold">L</div>
                <div>
                  <p className="font-bold text-lg leading-tight">LexoPay</p>
                  <p className="text-[11px] opacity-90 tracking-wide uppercase">Transaction Receipt</p>
                </div>
              </div>
            </div>

            <CardContent className="p-5 space-y-5 bg-card">
              {/* STATUS */}
              <div className="flex flex-col items-center text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${statusColor} mb-2`}>
                  <StatusIcon className="w-7 h-7" />
                </div>
                <p className="text-base font-semibold">{statusLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(txDate, 'PPP')} • {format(txDate, 'p')}
                </p>
              </div>

              {/* SUMMARY */}
              {(sentAmount || receivedAmount) && (
                <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                  {sentAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">You sent</span>
                      <span className="text-base font-bold font-mono">{sentAmount}</span>
                    </div>
                  )}
                  {receivedAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wide">You received</span>
                      <span className="text-base font-bold font-mono text-success">{receivedAmount}</span>
                    </div>
                  )}
                </div>
              )}

              {/* DETAILS */}
              <Section title="Details">
                <Row label="Transaction ID" value={transaction.id.slice(0, 8).toUpperCase()} mono />
                <Row label="Reference" value={reference} mono />
                <Row label="Type" value={typeLabel} />
                <Row label="Date" value={format(txDate, 'PPP')} />
                <Row label="Time" value={format(txDate, 'p')} />
              </Section>

              {/* FINANCIAL */}
              {(sentAmount || receivedAmount || fee) && (
                <Section title="Financial">
                  {sentAmount && <Row label="Amount sent" value={sentAmount} mono />}
                  {receivedAmount && <Row label="Amount received" value={receivedAmount} mono />}
                  {fee && <Row label="Fee" value={fee} mono />}
                </Section>
              )}

              {/* EXTRA */}
              {(network || account) && (
                <Section title="Routing">
                  {network && <Row label="Network" value={String(network).charAt(0).toUpperCase() + String(network).slice(1)} />}
                  {account && <Row label="Account" value={account} />}
                </Section>
              )}

              {/* FOOTER */}
              <div className="border-t border-border/50 pt-3 text-center">
                <p className="text-[11px] text-muted-foreground">Powered by LexoPay</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="min-h-[44px] gap-2" onClick={handleShare} disabled={!!exporting}>
            <Share2 className="w-4 h-4" /> Share
          </Button>
          <Button variant="outline" className="min-h-[44px] gap-2" onClick={downloadPNG} disabled={!!exporting}>
            {exporting === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            <span className="text-xs">PNG</span>
          </Button>
          <Button variant="outline" className="min-h-[44px] gap-2" onClick={downloadPDF} disabled={!!exporting}>
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span className="text-xs">PDF</span>
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

const SimpleHeader = ({ navigate, title }: { navigate: (n: number | string) => void; title: string }) => (
  <header className="glass-card border-b border-border/50 sticky top-0 z-50">
    <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <h1 className="font-semibold text-base">{title}</h1>
    </div>
  </header>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{title}</p>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className={`text-right break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
  </div>
);

export default Receipt;
