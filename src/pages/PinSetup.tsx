import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePinStatus } from '@/hooks/usePinStatus';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ShieldCheck, KeyRound } from 'lucide-react';

const cleanDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

const PinSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPin, loading: loadingStatus, refetch } = usePinStatus();

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const valid = newPin.length >= 4 && newPin === confirmPin && (!hasPin || oldPin.length >= 4);

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const rpc = hasPin
        ? supabase.rpc('change_transaction_pin', { _old_pin: oldPin, _new_pin: newPin })
        : supabase.rpc('set_transaction_pin', { _pin: newPin });
      const { data, error } = await rpc;
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast({ title: 'Failed', description: result?.error || 'Try again', variant: 'destructive' });
        return;
      }
      toast({ title: hasPin ? 'PIN updated' : 'PIN set successfully' });
      await refetch();
      navigate(-1);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Try again', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              {hasPin ? 'Change Transaction PIN' : 'Set Transaction PIN'}
            </h1>
            <p className="text-xs text-muted-foreground">Required for sends and withdrawals</p>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" /> Secure Your Account
            </CardTitle>
            <CardDescription>
              Your PIN is hashed and stored securely. We can never see it. Choose 4-6 digits you'll remember.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingStatus ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <>
                {hasPin && (
                  <div className="space-y-2">
                    <Label>Current PIN</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      placeholder="••••"
                      value={oldPin}
                      onChange={(e) => setOldPin(cleanDigits(e.target.value))}
                      className="text-center text-xl tracking-[0.5em] font-mono"
                      maxLength={6}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{hasPin ? 'New PIN' : 'PIN'}</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(cleanDigits(e.target.value))}
                    className="text-center text-xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(cleanDigits(e.target.value))}
                    className="text-center text-xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                  {confirmPin && confirmPin !== newPin && (
                    <p className="text-xs text-destructive">PINs don't match</p>
                  )}
                </div>
                <Button
                  className="w-full min-h-[48px] gradient-primary"
                  disabled={!valid || submitting}
                  onClick={submit}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : hasPin ? 'Update PIN' : 'Set PIN'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PinSetup;
