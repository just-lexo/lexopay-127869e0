import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TestModeBanner } from '@/components/TestModeBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
  Download,
  Receipt,
  AlertTriangle,
  Copy,
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
      return <ArrowDownToLine className="w-6 h-6 text-success" />;
    case 'WITHDRAW':
      return <ArrowUpFromLine className="w-6 h-6 text-warning" />;
    case 'CONVERT':
      return <RefreshCw className="w-6 h-6 text-primary" />;
    case 'SEND':
      return <Send className="w-6 h-6 text-warning" />;
    case 'RECEIVE':
      return <Download className="w-6 h-6 text-success" />;
    default:
      return <RefreshCw className="w-6 h-6" />;
  }
};

const getTypePill = (kind: string) => {
  const labels: Record<string, string> = {
    DEPOSIT: 'Crypto Deposit',
    WITHDRAW: 'Bank Transfer',
    CONVERT: 'Crypto Conversion',
    SEND: 'Crypto Transfer',
    RECEIVE: 'Crypto Transfer',
  };
  return labels[kind] || kind;
};

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return <Badge className="status-success">Success</Badge>;
    case 'PROCESSING':
      return <Badge className="status-pending border">Processing</Badge>;
    case 'FAILED':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const TransactionDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const handleCopyReference = async () => {
    const ref = (transaction?.metadata as { reference?: string })?.reference || transaction?.id;
    if (ref) {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[41px] z-50">
          <div className="container px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        </header>
        <main className="container px-4 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-background">
        <TestModeBanner />
        <header className="glass-card border-b border-border/50 sticky top-[41px] z-50">
          <div className="container px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="font-semibold">Transaction Not Found</h1>
            </div>
          </div>
        </header>
        <main className="container px-4 py-6">
          <Card className="glass-card border-destructive/20">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">Transaction not found or access denied.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const metadata = transaction.metadata as Record<string, unknown> || {};
  const reference = (metadata.reference as string) || transaction.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[41px] z-50">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Transaction Details</h1>
              <p className="text-xs text-muted-foreground">{getTypePill(transaction.kind)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {/* Main Card */}
        <Card className="glass-card border-primary/20">
          <CardContent className="py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Badge variant="outline" className="text-xs">
                {getTypePill(transaction.kind)}
              </Badge>
              {getStatusBadge(transaction.status)}
            </div>

            {/* Icon & Amount */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                {getTransactionIcon(transaction.kind)}
              </div>
              <p className={`text-3xl font-bold ${
                transaction.amount_display.startsWith('+') ? 'text-success' : ''
              }`}>
                {transaction.amount_display}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{transaction.title}</p>
            </div>

            {/* Details */}
            <div className="space-y-3 border-t border-border/50 pt-4">
              {transaction.subtitle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Details</span>
                  <span>{transaction.subtitle}</span>
                </div>
              )}

              {/* DEPOSIT specific */}
              {transaction.kind === 'DEPOSIT' && (
                <>
                  {metadata.token && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Token</span>
                      <span>{metadata.token as string}</span>
                    </div>
                  )}
                </>
              )}

              {/* CONVERT specific */}
              {transaction.kind === 'CONVERT' && (
                <>
                  {metadata.rate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span>₦{(metadata.rate as number).toLocaleString()}/USD</span>
                    </div>
                  )}
                  {metadata.fee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee (1%)</span>
                      <span>₦{(metadata.fee as number).toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}

              {/* WITHDRAW specific */}
              {transaction.kind === 'WITHDRAW' && (
                <>
                  {metadata.bank_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bank</span>
                      <span>{metadata.bank_name as string}</span>
                    </div>
                  )}
                  {metadata.account_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Account</span>
                      <span>****{(metadata.account_number as string).slice(-4)}</span>
                    </div>
                  )}
                  {metadata.account_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recipient</span>
                      <span>{metadata.account_name as string}</span>
                    </div>
                  )}
                  {metadata.fee && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee</span>
                      <span>₦{(metadata.fee as number).toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}

              {/* SEND/RECEIVE specific */}
              {(transaction.kind === 'SEND' || transaction.kind === 'RECEIVE') && (
                <>
                  {metadata.token && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Token</span>
                      <span>{metadata.token as string}</span>
                    </div>
                  )}
                  {metadata.network && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span className="capitalize">{metadata.network as string}</span>
                    </div>
                  )}
                  {transaction.kind === 'SEND' && metadata.recipient_username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">To</span>
                      <span>@{metadata.recipient_username as string}</span>
                    </div>
                  )}
                  {transaction.kind === 'RECEIVE' && metadata.sender_username && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">From</span>
                      <span>@{metadata.sender_username as string}</span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-border/50 pt-3 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <button 
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={handleCopyReference}
                  >
                    <span className="font-mono text-xs">{reference.slice(0, 16)}...</span>
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Date</span>
                  <span>{format(new Date(transaction.created_at), 'PPpp')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="glass-card-hover"
            onClick={() => navigate(`/receipt/${transaction.id}`)}
          >
            <Receipt className="w-4 h-4 mr-2" />
            View Receipt
          </Button>
          <Button
            variant="outline"
            className="glass-card-hover"
            onClick={() => {
              // Placeholder for report
            }}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        </div>
      </main>
    </div>
  );
};

export default TransactionDetail;