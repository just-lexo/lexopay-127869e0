import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { TestModeBanner } from '@/components/TestModeBanner';
 import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionAmount } from '@/components/transactions/TransactionAmount';
import { 
  ArrowLeft, 
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
  Download,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const getTransactionIcon = (kind: string) => {
  switch (kind) {
    case 'DEPOSIT':
      return <ArrowDownToLine className="w-4 h-4 text-success" />;
    case 'WITHDRAW':
      return <ArrowUpFromLine className="w-4 h-4 text-warning" />;
    case 'CONVERT':
      return <RefreshCw className="w-4 h-4 text-primary" />;
    case 'SEND':
      return <Send className="w-4 h-4 text-warning" />;
    case 'RECEIVE':
      return <Download className="w-4 h-4 text-success" />;
    default:
      return <RefreshCw className="w-4 h-4" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return <Badge className="status-success text-xs">Success</Badge>;
    case 'PROCESSING':
      return <Badge className="status-pending text-xs border">Processing</Badge>;
    case 'FAILED':
      return <Badge variant="destructive" className="text-xs">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

const Transactions = () => {
  const navigate = useNavigate();
  const { transactions, loading, error } = useTransactions();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Transaction History</h1>
              <p className="text-xs text-muted-foreground">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="glass-card border-destructive/20">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="py-12 text-center">
              <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your transaction history will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <Card 
                key={tx.id} 
                className="glass-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(`/transactions/${tx.id}`)}
              >
                <CardContent className="py-3 px-3">
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {getTransactionIcon(tx.kind)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="font-medium text-sm truncate flex-1">{tx.title}</p>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{tx.subtitle}</p>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <TransactionAmount
                            kind={tx.kind}
                            amountDisplay={tx.amount_display}
                            metadata={tx.metadata as Record<string, unknown> | null}
                          />
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Transactions;