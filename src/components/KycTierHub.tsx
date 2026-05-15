import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const TIERS = [
  { tier: 0, name: 'Starter',   limit: 50_000,    desc: 'Email verified' },
  { tier: 1, name: 'Verified',  limit: 200_000,   desc: 'Phone & basic info' },
  { tier: 2, name: 'Trusted',   limit: 1_000_000, desc: 'Government ID + selfie' },
  { tier: 3, name: 'Elite',     limit: 5_000_000, desc: 'Address proof' },
];

const fmt = (n: number) => '₦' + n.toLocaleString();

interface Props {
  variant?: 'full' | 'compact';
}

export function KycTierHub({ variant = 'full' }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<number>(0);

  const tier = profile?.kyc_tier ?? 0;
  const current = TIERS.find(t => t.tier === tier) ?? TIERS[0];
  const next = TIERS.find(t => t.tier === tier + 1);
  const limit = current.limit;
  const pct = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('daily_usage')
        .select('ngn_outflow')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();
      setUsage(Number((data as any)?.ngn_outflow ?? 0));
    })();
  }, [user]);

  if (variant === 'compact') {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">Tier {tier} · {current.name}</p>
              <Badge variant="outline" className="text-[10px]">{fmt(limit)}/day</Badge>
            </div>
            <Progress value={pct} className="h-1.5 mt-1.5" />
            <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(usage)} used today</p>
          </div>
          {next && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => navigate('/kyc')}>
              Upgrade <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Tier {tier} · {current.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{current.desc}</p>
          </div>
          <Badge variant="outline" className="text-xs whitespace-nowrap">{fmt(limit)}/day</Badge>
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Used today</span>
            <span className="font-mono">{fmt(usage)} / {fmt(limit)}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="space-y-2">
          {TIERS.map(t => {
            const unlocked = t.tier <= tier;
            const isCurrent = t.tier === tier;
            return (
              <div
                key={t.tier}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-background/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  unlocked ? 'bg-success/15 text-success' : 'bg-muted/40 text-muted-foreground'
                }`}>
                  {unlocked ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Tier {t.tier} · {t.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{t.desc}</p>
                </div>
                <Badge variant={isCurrent ? 'default' : 'outline'} className="text-[10px] whitespace-nowrap">
                  {fmt(t.limit)}
                </Badge>
              </div>
            );
          })}
        </div>

        {next && (
          <Button className="w-full gradient-primary min-h-[44px]" onClick={() => navigate('/kyc')}>
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade to Tier {next.tier} · {next.name}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
