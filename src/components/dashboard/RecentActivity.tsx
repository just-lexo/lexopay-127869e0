import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TransactionAmount } from '@/components/transactions/TransactionAmount';
import { Loader2, ArrowDownToLine, RefreshCw, ArrowUpFromLine, Clock, Send, Download, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const getStatusBadge = (status: string) => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'success' || statusLower === 'confirmed') {
    return <Badge className="status-success border text-xs">Success</Badge>;
  }
  if (statusLower === 'pending' || statusLower === 'processing') {
    return <Badge className="status-pending border text-xs">Pending</Badge>;
  }
  if (statusLower === 'failed') {
    return <Badge className="status-failed border text-xs">Failed</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
};

const getKindIcon = (kind: string) => {
  switch (kind) {
    case 'DEPOSIT':
      return <ArrowDownToLine className="w-4 h-4 text-success" />;
    case 'CONVERT':
      return <RefreshCw className="w-4 h-4 text-primary" />;
    case 'WITHDRAW':
      return <ArrowUpFromLine className="w-4 h-4 text-warning" />;
    case 'SEND':
      return <Send className="w-4 h-4 text-warning" />;
    case 'RECEIVE':
      return <Download className="w-4 h-4 text-success" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

export function RecentActivity() {
  const navigate = useNavigate();
  const { transactions, loading } = useTransactions(3);

  if (loading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No transactions yet. Deposit crypto to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary"
          onClick={() => navigate('/transactions')}
        >
          View All
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
            onClick={() => navigate(`/transactions/${tx.id}`)}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              {getKindIcon(tx.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{tx.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <TransactionAmount
                kind={tx.kind}
                amountDisplay={tx.amount_display}
                metadata={tx.metadata as Record<string, unknown> | null}
              />
              {getStatusBadge(tx.status)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}