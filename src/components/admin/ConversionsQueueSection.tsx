import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

export const ConversionsQueueSection = ({ onResolved }: { onResolved?: () => void }) => {
  const { toast } = useToast();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('conversions')
      .select('*')
      .eq('status', 'PROCESSING')
      .order('created_at', { ascending: true })
      .limit(100);
    setPending(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string, success: boolean) => {
    const note = window.prompt(success ? 'Optional note (e.g. ref / settlement)' : 'Reason for failing this conversion?') || '';
    if (!success && !note.trim()) return;
    setBusy(id);
    const { data, error } = await supabase.rpc('admin_resolve_conversion', {
      _conversion_id: id, _success: success, _note: note,
    });
    setBusy(null);
    const r = data as any;
    if (error || !r?.success) {
      toast({ title: 'Failed', description: error?.message || r?.error, variant: 'destructive' });
      return;
    }
    toast({ title: success ? 'Conversion approved' : 'Conversion failed (refunded)' });
    load();
    onResolved?.();
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">Pending Conversions ({pending.length})</CardTitle>
          <CardDescription className="text-xs">Approve to credit NGN, fail to refund crypto</CardDescription>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Queue is empty</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">From</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-xs text-right">NGN</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="py-2 text-xs font-mono">{c.from_amount} {c.from_token} <Badge variant="outline" className="ml-1 text-[10px]">{c.from_network}</Badge></TableCell>
                    <TableCell className="py-2 text-[11px] text-muted-foreground hidden md:table-cell">{new Date(c.created_at).toLocaleString()}</TableCell>
                    <TableCell className="py-2 text-right text-xs font-mono">₦{Number(c.ngn_amount).toLocaleString()}</TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={busy === c.id} onClick={() => resolve(c.id, true)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" disabled={busy === c.id} onClick={() => resolve(c.id, false)}>
                          <XCircle className="w-3 h-3 mr-1" /> Fail
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
