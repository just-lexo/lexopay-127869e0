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
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">L</span>
              </div>
              <span className="font-semibold">LexoPay</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card border-border/50 text-center">
          <CardHeader>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Private Alpha</CardTitle>
            <CardDescription>
              LexoPay is currently invite-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{user?.email}</span>
              </div>
              {profile?.username && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50">
                  <AtSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono">@{profile.username}</span>
                </div>
              )}
            </div>

            <Badge variant="outline" className="text-xs">
              Not on the allowlist
            </Badge>

            <p className="text-sm text-muted-foreground">
              If you believe you should have access, please request it below.
            </p>

            <Button
              className="w-full gradient-primary hover:opacity-90"
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
