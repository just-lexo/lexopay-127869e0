import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Transaction History</h1>
              <p className="text-xs text-muted-foreground">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
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
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      {getTransactionIcon(tx.kind)}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{tx.title}</p>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{tx.subtitle}</p>
                    </div>

                    {/* Amount & Arrow */}
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <p className={`font-mono font-medium text-sm ${
                          tx.amount_display.startsWith('+') ? 'text-success' : 
                          tx.amount_display.startsWith('-') ? 'text-foreground' : ''
                        }`}>
                          {tx.amount_display}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Transactions;