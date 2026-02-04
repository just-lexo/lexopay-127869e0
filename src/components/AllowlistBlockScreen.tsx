import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Mail, AtSign, LogOut } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

export function AllowlistBlockScreen() {
  const { user, profile, signOut } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const requestMessage = `Hi LexoPay team,

I'd like to request access to the Private Alpha.

Email: ${user?.email}
Username: @${profile?.username || 'not set'}

Thank you!`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass-card border-b border-border/50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">L</span>
              </div>
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

            <Badge variant="outline" className="text-[10px]">
              Not on the allowlist
            </Badge>

            <p className="text-xs text-muted-foreground">
              If you believe you should have access, please request it below.
            </p>

            <Button
              className="w-full min-h-[44px] gradient-primary hover:opacity-90"
              onClick={() => setFeedbackOpen(true)}
            >
              Request Access
            </Button>
          </CardContent>
        </Card>
      </main>

      <FeedbackModal
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        defaultCategory="OTHER"
        defaultMessage={requestMessage}
      />
    </div>
  );
}
