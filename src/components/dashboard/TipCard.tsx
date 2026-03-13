import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

const tips = [
  'You can send crypto using usernames like @john.',
  'Convert crypto to NGN anytime.',
  'Tap the eye icon to hide your balances.',
  'Check your full activity in History.',
  'Withdraw NGN directly to your bank account.',
];

export function TipCard() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % tips.length);
        setVisible(true);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="glass-card border-border/30 bg-muted/30">
      <CardContent className="py-3 px-4 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Tip</p>
          <p
            className={`text-sm text-foreground/80 transition-opacity duration-300 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {tips[index]}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
