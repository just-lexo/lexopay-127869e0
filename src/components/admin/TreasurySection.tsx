import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Wallet, TrendingUp } from 'lucide-react';

type AssetRow = { asset: string; fee_revenue: number; spread_revenue: number; deposits_in: number; withdrawals_out: number; manual_net: number; net: number };
type PnlRow = { day: string; fee_revenue: number; spread_revenue: number; manual: number; total: number };

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const TreasurySection = () => {
  const { toast } = useToast();
  const [perAsset, setPerAsset] = useState<AssetRow[]>([]);
  const [pnl, setPnl] = useState<PnlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Manual adjustment form
  const [entryType, setEntryType] = useState('MANUAL_ADJUSTMENT');
  const [asset, setAsset] = useState('NGN');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const [assetRes, pnlRes] = await Promise.all([
      supabase.rpc('admin_treasury_per_asset'),
      supabase.rpc('admin_treasury_pnl', { _days: 30 }),
    ]);
    setPerAsset((assetRes.data as AssetRow[]) || []);
    setPnl((pnlRes.data as PnlRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitAdjustment = async () => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt === 0) {
      toast({ title: 'Enter an amount', variant: 'destructive' });
      return;
    }
    setPosting(true);
    const { data, error } = await supabase.rpc('admin_treasury_adjust', {
      _entry_type: entryType, _asset: asset, _amount: amt, _note: note || null,
    });
    setPosting(false);
    const r = data as any;
    if (error || !r?.success) {
      toast({ title: 'Failed', description: error?.message || r?.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Adjustment posted' });
    setAmount(''); setNote('');
    load();
  };

  const pnlTotal = pnl.reduce((s, r) => s + Number(r.total || 0), 0);
  const feeTotal = pnl.reduce((s, r) => s + Number(r.fee_revenue || 0), 0);
  const spreadTotal = pnl.reduce((s, r) => s + Number(r.spread_revenue || 0), 0);
  const peakDay = pnl.reduce((max, r) => Number(r.total) > max ? Number(r.total) : max, 0) || 1;

  return (
    <div className="space-y-4">
      {/* PER-ASSET LEDGER */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Per-Asset Balances</CardTitle>
            <CardDescription className="text-xs">All-time treasury ledger totals, by asset</CardDescription>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : perAsset.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No treasury entries yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Asset</TableHead>
                    <TableHead className="text-xs text-right">Fees</TableHead>
                    <TableHead className="text-xs text-right">Spread</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">In</TableHead>
                    <TableHead className="text-xs text-right hidden sm:table-cell">Out</TableHead>
                    <TableHead className="text-xs text-right">Manual</TableHead>
                    <TableHead className="text-xs text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perAsset.map((r) => (
                    <TableRow key={r.asset}>
                      <TableCell className="py-2 font-medium text-sm">{r.asset}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono text-success">+{fmt(r.fee_revenue)}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono text-success">+{fmt(r.spread_revenue)}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono hidden sm:table-cell">{fmt(r.deposits_in)}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-mono hidden sm:table-cell text-destructive">{fmt(r.withdrawals_out)}</TableCell>
                      <TableCell className={`py-2 text-right text-xs font-mono ${Number(r.manual_net) < 0 ? 'text-destructive' : ''}`}>{fmt(r.manual_net)}</TableCell>
                      <TableCell className="py-2 text-right text-sm font-bold font-mono">{fmt(r.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P&L 30D */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Daily P&L (30d)</CardTitle>
          <CardDescription className="text-xs">Fee + spread + manual adjustments — UTC</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Mini label="Fees" value={`₦${fmt(feeTotal)}`} />
            <Mini label="Spread" value={`₦${fmt(spreadTotal)}`} />
            <Mini label="Total" value={`₦${fmt(pnlTotal)}`} highlight />
          </div>
          {pnl.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No revenue yet</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {pnl.map((r) => (
                <div key={r.day} className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground tabular-nums w-20 shrink-0">{new Date(r.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.max(2, (Number(r.total) / peakDay) * 100)}%` }} />
                  </div>
                  <span className="font-mono tabular-nums w-24 text-right">₦{fmt(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MANUAL ADJUSTMENT */}
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Manual Treasury Adjustment</CardTitle>
          <CardDescription className="text-xs">Post a corrective entry. All actions are audit-logged.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Entry type</Label>
              <Select value={entryType} onValueChange={setEntryType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL_ADJUSTMENT">Manual adjustment</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="CORRECTION">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Asset</Label>
              <Select value={asset} onValueChange={setAsset}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (positive)</Label>
            <Input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note</Label>
            <Input placeholder="e.g. reconciliation for Paystack settlement" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-xs" />
          </div>
          <Button onClick={submitAdjustment} disabled={posting} className="w-full h-9 gradient-primary">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Adjustment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const Mini = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg p-2.5 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-background/50'}`}>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold mt-0.5 font-mono ${highlight ? 'text-primary' : ''}`}>{value}</p>
  </div>
);
