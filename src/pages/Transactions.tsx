import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
  Download,
  ChevronRight,
  Search,
  X,
  Inbox,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'SEND', label: 'Sent' },
  { key: 'RECEIVE', label: 'Received' },
  { key: 'CONVERT', label: 'Convert' },
  { key: 'WITHDRAW', label: 'Withdraw' },
  { key: 'DEPOSIT', label: 'Deposit' },
] as const;

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

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return <Badge className="status-success text-[10px]">Success</Badge>;
    case 'PROCESSING':
      return <Badge className="status-pending text-[10px] border">Processing</Badge>;
    case 'FAILED':
      return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

const getSimpleAmount = (amountDisplay: string) => {
  const parts = amountDisplay.split('→');
  if (parts.length > 1) return parts[1].trim().split('(')[0].trim();
  return amountDisplay.split('(')[0].trim();
};

const Transactions = () => {
  const navigate = useNavigate();
  const { transactions, loading, error } = useTransactions();
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = transactions;

    if (activeFilter !== 'ALL') {
      result = result.filter(tx => tx.kind === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tx => {
        const meta = tx.metadata as Record<string, unknown> | null;
        const ref = (meta?.reference as string)?.toLowerCase() || '';
        const recipientUsername = (meta?.recipient_username as string)?.toLowerCase() || '';
        const senderUsername = (meta?.sender_username as string)?.toLowerCase() || '';

        return (
          tx.title.toLowerCase().includes(q) ||
          (tx.subtitle?.toLowerCase().includes(q)) ||
          ref.includes(q) ||
          recipientUsername.includes(q) ||
          senderUsername.includes(q)
        );
      });
    }

    return result;
  }, [transactions, activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Transaction History</h1>
              <p className="text-xs text-muted-foreground">
                {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by username, reference..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 min-h-[44px]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="glass-card border-destructive/20">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="py-12 text-center">
              <Inbox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {searchQuery || activeFilter !== 'ALL' ? 'No matching transactions' : 'No transactions yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || activeFilter !== 'ALL'
                  ? 'Try adjusting your filters'
                  : 'Your transactions will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((tx) => (
              <Card 
                key={tx.id} 
                className="glass-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(`/transactions/${tx.id}`)}
              >
                <CardContent className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {getTransactionIcon(tx.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{getKindLabel(tx.kind)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <p className={`font-mono font-semibold text-sm ${
                          tx.amount_display.startsWith('+') ? 'text-success' : ''
                        }`}>
                          {getSimpleAmount(tx.amount_display)}
                        </p>
                      </div>
                      {getStatusBadge(tx.status)}
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
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
