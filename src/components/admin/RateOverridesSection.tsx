import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sliders } from 'lucide-react';

const TOKENS = ['USDT', 'USDC', 'ETH'] as const;
type Token = typeof TOKENS[number];
type Override = { spread_pct?: number | null; manual_price_usd?: number | null; enabled?: boolean };

export const RateOverridesSection = () => {
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [livePrices, setLivePrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [settingsRes, priceRes] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'rate_overrides').maybeSingle(),
      supabase.functions.invoke('get-live-prices'),
    ]);
    setOverrides((settingsRes.data?.value as any) || {});
    setLivePrices((priceRes.data as any)?.prices || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (token: Token, patch: Partial<Override>) => {
    setOverrides((prev) => ({ ...prev, [token]: { ...prev[token], ...patch } }));
  };

  const save = async (token: Token) => {
    const o = overrides[token] || {};
    setSaving(token);
    const { data, error } = await supabase.rpc('admin_set_rate_override', {
      _token: token,
      _spread_pct: typeof o.spread_pct === 'number' ? o.spread_pct : null,
      _manual_price_usd: typeof o.manual_price_usd === 'number' && o.manual_price_usd > 0 ? o.manual_price_usd : null,
      _enabled: !!o.enabled,
    });
    setSaving(null);
    const r = data as any;
    if (error || !r?.success) {
      toast({ title: 'Failed', description: error?.message || r?.error, variant: 'destructive' });
      return;
    }
    toast({ title: `${token} override saved`, description: 'Rates will refresh within 60s.' });
    load();
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Sliders className="w-4 h-4 text-primary" /> Rate Overrides</CardTitle>
        <CardDescription className="text-xs">Override spread % or manually peg USD price per asset. Used by the live-prices oracle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : TOKENS.map((token) => {
          const o = overrides[token] || {};
          const live = livePrices[token];
          return (
            <div key={token} className="rounded-lg border border-border/40 bg-background/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{token}</p>
                  {live && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Market: ${Number(live.usd).toLocaleString(undefined, { maximumFractionDigits: 4 })} • Display: ₦{Number(live.display_ngn).toLocaleString()}
                      {live.overridden && <span className="text-warning ml-1">• overridden</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground">Active</Label>
                  <Switch checked={!!o.enabled} onCheckedChange={(v) => update(token, { enabled: v })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Spread % (positive)</Label>
                  <Input
                    type="number" inputMode="decimal" step="0.1" placeholder="1.0"
                    value={o.spread_pct ?? ''}
                    onChange={(e) => update(token, { spread_pct: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className="h-8 text-xs"
                    disabled={!o.enabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Manual USD price (optional)</Label>
                  <Input
                    type="number" inputMode="decimal" step="0.0001" placeholder="leave blank for live"
                    value={o.manual_price_usd ?? ''}
                    onChange={(e) => update(token, { manual_price_usd: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    className="h-8 text-xs"
                    disabled={!o.enabled}
                  />
                </div>
              </div>

              <Button size="sm" className="w-full h-8 text-xs" disabled={saving === token} onClick={() => save(token)}>
                {saving === token ? <Loader2 className="w-3 h-3 animate-spin" /> : `Save ${token} override`}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
