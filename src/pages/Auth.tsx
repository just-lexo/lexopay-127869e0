import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Mail, Lock, User, AtSign, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Separator } from '@/components/ui/separator';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

type AuthStep = 'auth' | 'verify-email' | 'profile-setup';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const stepParam = searchParams.get('step');
  const { signUp, signIn, updateProfile, user, profile, emailConfirmed, resendVerificationEmail } = useAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>(stepParam === 'setup' ? 'profile-setup' : 'auth');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile form
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Determine correct step based on user state
  useEffect(() => {
    if (!user) {
      if (step !== 'auth') setStep('auth');
      return;
    }

    // User exists — determine step
    if (!emailConfirmed) {
      setStep('verify-email');
      return;
    }

    if (!profile?.username || !profile?.onboarding_completed) {
      setStep('profile-setup');
      return;
    }

    // Fully set up — redirect
    navigate(redirectTo, { replace: true });
  }, [user, emailConfirmed, profile, navigate, redirectTo]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({ title: 'Invalid email', description: emailResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({ title: 'Invalid password', description: passwordResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          let message = error.message;
          if (message.includes('Invalid login credentials')) {
            message = 'Invalid email or password. Please try again.';
          } else if (message.includes('Email not confirmed')) {
            message = 'Please verify your email before signing in.';
            setStep('verify-email');
          }
          toast({ title: 'Login failed', description: message, variant: 'destructive' });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          let message = error.message;
          if (message.includes('User already registered')) {
            message = 'This email is already registered. Please login instead.';
          }
          toast({ title: 'Sign up failed', description: message, variant: 'destructive' });
        } else {
          toast({ title: 'Check your email', description: 'We sent a verification link to confirm your account.' });
          setStep('verify-email');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const { error } = await resendVerificationEmail();
      if (error) {
        toast({ title: 'Failed to resend', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Email sent', description: 'Check your inbox for the verification link.' });
      }
    } finally {
      setResending(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const usernameResult = usernameSchema.safeParse(username);
    if (!usernameResult.success) {
      toast({ title: 'Invalid username', description: usernameResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    if (!displayName.trim()) {
      toast({ title: 'Display name required', description: 'Please enter a display name.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateProfile({
        username: username.toLowerCase(),
        display_name: displayName.trim(),
        onboarding_completed: true,
      });

      if (error) {
        let message = error.message;
        if (message.includes('duplicate key') || message.includes('unique')) {
          message = 'This username is already taken. Please choose another.';
        }
        toast({ title: 'Profile update failed', description: message, variant: 'destructive' });
      } else {
        toast({ title: 'Welcome to LexoPay!', description: 'Your profile has been set up.' });
        navigate(redirectTo, { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 'auth' ? navigate('/') : null}
          className="gap-2 min-h-[44px]"
          disabled={step !== 'auth'}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm glass-card border-border/50">
          {step === 'auth' && (
            <>
              <CardHeader className="text-center pb-4">
                <BrandLogo className="w-11 h-11 mx-auto mb-3" rounded="rounded-xl" />
                <CardTitle className="text-xl">
                  {isLogin ? 'Welcome back' : 'Create account'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isLogin 
                    ? 'Sign in to your LexoPay account' 
                    : 'Get started with LexoPay today'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
                    </div>
                  </div>

                  <Button type="submit" className="w-full min-h-[48px] gradient-primary hover:opacity-90" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <Button variant="link" className="pl-1 text-primary text-xs h-auto py-0" onClick={() => setIsLogin(!isLogin)}>
                      {isLogin ? 'Sign up' : 'Sign in'}
                    </Button>
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>

                <div className="mt-4">
                  <WalletConnectButton label="Sign in with Wallet" variant="outline" className="glass-card-hover border-border/50" />
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Connect MetaMask or a compatible wallet on Base
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {step === 'verify-email' && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Verify your email</CardTitle>
                <CardDescription className="text-xs">
                  Check your inbox for a verification link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    We sent a verification email
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {user?.email ? `to ${user.email}` : 'to your email address'}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Click the link in your email to verify your account. You may need to check your spam folder.
                </p>

                <Button
                  variant="outline"
                  className="w-full min-h-[44px]"
                  onClick={handleResendEmail}
                  disabled={resending}
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Resend Email
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setStep('auth');
                  }}
                >
                  Use a different email
                </Button>
              </CardContent>
            </>
          )}

          {step === 'profile-setup' && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3">
                  <User className="w-5 h-5 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">Set up your profile</CardTitle>
                <CardDescription className="text-xs">
                  Choose your username and display name
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="username" type="text" placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="pl-10" required />
                    </div>
                    <p className="text-xs text-muted-foreground">Letters, numbers, and underscores only</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="displayName" type="text" placeholder="John Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-10" required />
                    </div>
                  </div>

                  <Button type="submit" className="w-full min-h-[48px] gradient-primary hover:opacity-90" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

// Need supabase import for signOut in verify-email step
import { supabase } from '@/integrations/supabase/client';

export default Auth;
