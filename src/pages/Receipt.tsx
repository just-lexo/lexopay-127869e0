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
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
  Download,
  Share2,
  Check
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
    case 'DEPOSIT':
      return <ArrowDownToLine className="w-8 h-8 text-success" />;
    case 'WITHDRAW':
      return <ArrowUpFromLine className="w-8 h-8 text-warning" />;
    case 'CONVERT':
      return <RefreshCw className="w-8 h-8 text-primary" />;
    case 'SEND':
      return <Send className="w-8 h-8 text-warning" />;
    case 'RECEIVE':
      return <Download className="w-8 h-8 text-success" />;
    default:
      return <RefreshCw className="w-8 h-8" />;
  }
};

const getTypePill = (kind: string) => {
  const labels: Record<string, string> = {
    DEPOSIT: 'Crypto Deposit',
    WITHDRAW: 'Bank Transfer',
    CONVERT: 'Conversion',
    SEND: 'Sent',
    RECEIVE: 'Received',
  };
  return labels[kind] || kind;
};

const Receipt = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!user || !id) return;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setTransaction(data as Transaction);
      }
      setLoading(false);
    };

    fetchTransaction();
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4">
          <Skeleton className="h-96 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
          <div className="container max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="font-semibold text-base">Receipt Not Found</h1>
            </div>
          </div>
        </header>
        <main className="container max-w-lg mx-auto px-4 py-4">
          <Card className="glass-card border-destructive/20">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-destructive">Receipt not found or access denied.</p>
            </CardContent>
          </Card>
        </main>
        <BottomNav />
      </div>
    );
  }

  const metadata = transaction.metadata as Record<string, unknown> || {};
  const reference = (metadata.reference as string) || transaction.id.slice(0, 8).toUpperCase();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LexoPay Receipt - ${transaction.title}`,
          text: `${transaction.amount_display} - ${transaction.status}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  const handleDownload = () => {
    // Placeholder for PDF download functionality
    alert('Download feature coming soon!');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-semibold text-base">Receipt</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Receipt Card */}
        <Card className="glass-card border-border/50 overflow-hidden">
          {/* Header with gradient */}
          <div className="gradient-primary p-6 text-center text-primary-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="font-bold text-lg">L</span>
              </div>
              <span className="font-bold text-lg">LexoPay</span>
            </div>
            <p className="text-sm opacity-80">Transaction Receipt</p>
          </div>

          <CardContent className="py-6 space-y-6">
            {/* Status Icon */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                {transaction.status === 'SUCCESS' ? (
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-success" />
                  </div>
                ) : (
                  getTransactionIcon(transaction.kind)
                )}
              </div>
              <Badge variant="outline" className="mb-2">{getTypePill(transaction.kind)}</Badge>
              <p className={`text-2xl sm:text-3xl font-bold break-all ${
                transaction.amount_display.startsWith('+') ? 'text-success' : ''
              }`}>
                {transaction.amount_display}
              </p>
              <Badge 
                className={`mt-2 ${
                  transaction.status === 'SUCCESS' ? 'status-success' : 
                  transaction.status === 'PROCESSING' ? 'status-pending border' : 
                  'bg-destructive'
                }`}
              >
                {transaction.status}
              </Badge>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-border/50" />

            {/* Details */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction Type</span>
                <span className="font-medium">{transaction.title}</span>
              </div>

              {transaction.subtitle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span className="text-right max-w-[60%]">{transaction.subtitle}</span>
                </div>
              )}

              {/* Type-specific details */}
              {transaction.kind === 'WITHDRAW' && metadata.fee && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee</span>
                  <span>₦{(metadata.fee as number).toLocaleString()}</span>
                </div>
              )}

              {transaction.kind === 'CONVERT' && metadata.rate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span>₦{(metadata.rate as number).toLocaleString()}/USD</span>
                </div>
              )}

              {(transaction.kind === 'SEND' || transaction.kind === 'RECEIVE') && (
                <>
                  {transaction.kind === 'SEND' && metadata.recipient_username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recipient</span>
                      <span>@{metadata.recipient_username as string}</span>
                    </div>
                  )}
                  {transaction.kind === 'RECEIVE' && metadata.sender_username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sender</span>
                      <span>@{metadata.sender_username as string}</span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-border/50 pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference ID</span>
                  <span className="font-mono text-xs">{reference}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>{format(new Date(transaction.created_at), 'PPpp')}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Account</span>
                  <span>@{profile?.username}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-border/50" />

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Thank you for using LexoPay</p>
              <p className="mt-1">support@lexopay.com</p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="glass-card-hover min-h-[44px]"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            className="glass-card-hover min-h-[44px]"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Receipt;