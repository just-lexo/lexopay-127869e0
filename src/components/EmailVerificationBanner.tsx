import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmailVerificationBanner() {
  const { user, emailConfirmed, resendVerificationEmail } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  if (!user || emailConfirmed) return null;

  const handleResend = async () => {
    setSending(true);
    const { error } = await resendVerificationEmail();
    if (error) toast({ title: 'Failed to resend', description: error.message, variant: 'destructive' });
    else toast({ title: 'Verification email sent', description: 'Check your inbox.' });
    setSending(false);
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
      <Mail className="w-4 h-4 text-warning mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Please verify your email to continue</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          Sensitive actions are locked until {user.email} is verified.
        </p>
      </div>
      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleResend} disabled={sending}>
        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resend'}
      </Button>
    </div>
  );
}
