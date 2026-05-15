import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface PinPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (pin: string) => Promise<void> | void;
  loading?: boolean;
  hasPin: boolean;
  title?: string;
  description?: string;
}

/**
 * Prompts the user for their transaction PIN before a sensitive action.
 * If the user has not set a PIN yet, shows a CTA to set one.
 */
export function PinPromptModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  hasPin,
  title = 'Enter Transaction PIN',
  description = 'Confirm this action with your 4-6 digit PIN.',
}: PinPromptModalProps) {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');

  useEffect(() => { if (!open) setPin(''); }, [open]);

  const handle = (v: string) => setPin(v.replace(/\D/g, '').slice(0, 6));

  const submit = async () => {
    if (pin.length < 4) return;
    await onSubmit(pin);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-[90vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {hasPin ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••"
                value={pin}
                onChange={(e) => handle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                className="text-center text-2xl tracking-[0.5em] font-mono min-h-[52px]"
                maxLength={6}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                4-6 digits
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                className="gradient-primary"
                disabled={pin.length < 4 || loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
              You haven't set a transaction PIN yet. Set one to protect transfers and withdrawals.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Later</Button>
              <Button
                className="gradient-primary"
                onClick={() => { onOpenChange(false); navigate('/pin'); }}
              >
                Set PIN
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
