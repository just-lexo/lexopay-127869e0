import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowDownToLine, RefreshCw, ArrowUpFromLine, Clock, Send, Download, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
    case 'CONFIRMED':
      return <Badge className="status-success border text-[10px]">Success</Badge>;
    case 'PROCESSING':
      return <Badge className="status-pending border text-[10px]">Processing</Badge>;
    case 'FAILED':
      return <Badge className="status-failed border text-[10px]">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

const getKindIcon = (kind: string) => {
  switch (kind) {
    case 'DEPOSIT':
      return <ArrowDownToLine className="w-3.5 h-3.5 text-success" />;
    case 'CONVERT':
      return <RefreshCw className="w-3.5 h-3.5 text-primary" />;
    case 'WITHDRAW':
      return <ArrowUpFromLine className="w-3.5 h-3.5 text-warning" />;
    case 'SEND':
      return <Send className="w-3.5 h-3.5 text-warning" />;
    case 'RECEIVE':
      return <Download className="w-3.5 h-3.5 text-success" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const getKindLabel = (kind: string) => {
  switch (kind) {
    case 'DEPOSIT': return 'Deposit';
    case 'CONVERT': return 'Conversion';
    case 'WITHDRAW': return 'Withdrawal';
    case 'SEND': return 'Sent';
    case 'RECEIVE': return 'Received';
    default: return kind;
  }
};

const getSimpleAmount = (amountDisplay: string) => {
  // Extract the primary amount, strip fee details
  const parts = amountDisplay.split('→');
  if (parts.length > 1) {
    // Conversion: show the NGN part
    return parts[1].trim().split('(')[0].trim();
  }
  // For withdrawals with fee info in parens, strip it
  return amountDisplay.split('(')[0].trim();
};

export function RecentActivity() {
  const navigate = useNavigate();
  const { transactions, loading } = useTransactions(5);

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
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recent Activity</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary h-7 px-2"
          onClick={() => navigate('/transactions')}
        >
          View All
          <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-2.5 p-2.5 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
            onClick={() => navigate(`/transactions/${tx.id}`)}
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              {getKindIcon(tx.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-xs">{getKindLabel(tx.kind)}</p>
              <p className="text-[10px] text-muted-foreground/60">
                {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <p className={`font-mono text-xs font-semibold ${
                tx.amount_display.startsWith('+') ? 'text-success' : ''
              }`}>
                {getSimpleAmount(tx.amount_display)}
              </p>
              {getStatusBadge(tx.status)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
