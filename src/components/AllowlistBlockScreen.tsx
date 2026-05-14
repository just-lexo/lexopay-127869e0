import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, AtSign, LogOut, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface InviteRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  admin_note: string | null;
  created_at: string;
}

export function AllowlistBlockScreen() {
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  
  const [existingRequest, setExistingRequest] = useState<InviteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkExistingRequest();
  }, [user]);

  const checkExistingRequest = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('invite_requests')
        .select('id, status, admin_note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setExistingRequest(data as InviteRequest);
      }
    } catch (err) {
      console.error('Error checking request:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRequestAccess = async () => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from('invite_requests').insert({
        user_id: user.id,
        email: user.email || '',
        username: profile?.username || null,
        message: message.trim() || null,
        status: 'PENDING',
      });

      if (error) throw error;

      toast({
        title: 'Request sent!',
        description: 'We\'ll review your request and get back to you.',
      });

      await checkExistingRequest();
    } catch (err: any) {
      console.error('Error submitting request:', err);
      toast({
        title: 'Error',
        description: err.message?.includes('duplicate') 
          ? 'You already have a pending request.' 
          : 'Failed to submit request.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusUI = () => {
    if (!existingRequest) return null;

    switch (existingRequest.status) {
      case 'PENDING':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-sm text-warning">Request pending</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your access request is being reviewed. We'll notify you once it's processed.
            </p>
          </div>
        );
      case 'APPROVED':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Approved!</span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Your access has been approved. Please log out and log back in to continue.
            </p>
            <Button
              className="w-full min-h-[44px] gradient-primary"
              onClick={handleSignOut}
            >
              Log out to continue
            </Button>
          </div>
        );
      case 'DECLINED':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">Request declined</span>
            </div>
            {existingRequest.admin_note && (
              <p className="text-xs text-muted-foreground text-center p-2 rounded bg-muted/50">
                "{existingRequest.admin_note}"
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Unfortunately, your request was not approved at this time.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-card border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandLogo className="w-9 h-9" rounded="rounded-xl" />
              <span className="font-semibold text-sm">LexoPay</span>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm glass-card border-border/50 text-center">
          <CardHeader className="pb-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Private Alpha</CardTitle>
            <CardDescription className="text-xs">
              LexoPay is currently invite-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-muted/50">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs truncate">{user?.email}</span>
              </div>
              {profile?.username && (
                <div className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-muted/50">
                  <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono">@{profile.username}</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : existingRequest ? (
              getStatusUI()
            ) : (
              <>
                <Badge variant="outline" className="text-[10px]">
                  Not on the allowlist
                </Badge>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Why would you like to join LexoPay? (optional)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>

                <Button
                  className="w-full min-h-[44px] gradient-primary hover:opacity-90"
                  onClick={handleRequestAccess}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Request Access'
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
