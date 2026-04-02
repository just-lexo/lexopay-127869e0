import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Mail, Lock, User, AtSign } from 'lucide-react';
import { z } from 'zod';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { Separator } from '@/components/ui/separator';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

type AuthStep = 'auth' | 'profile-setup';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const stepParam = searchParams.get('step');
  const { signUp, signIn, updateProfile, user, profile } = useAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>(stepParam === 'setup' ? 'profile-setup' : 'auth');
  const [loading, setLoading] = useState(false);
  
  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile form
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Redirect if user is fully set up
  useEffect(() => {
    if (user && profile?.username && profile?.onboarding_completed) {
      navigate(redirectTo, { replace: true });
    } else if (user && (!profile?.username || !profile?.onboarding_completed)) {
      setStep('profile-setup');
    }
  }, [user, profile, navigate, redirectTo]);

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
          toast({ title: 'Account created!', description: 'Please set up your profile.' });
          setStep('profile-setup');
        }
      }
    } finally {
      setLoading(false);
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

  const handleSkipSetup = async () => {
    setLoading(true);
    try {
      // Generate a default username if not set
      const defaultUsername = `user_${Date.now().toString(36)}`;
      await updateProfile({
        username: profile?.username || defaultUsername,
        display_name: profile?.display_name || 'LexoPay User',
        onboarding_completed: true,
      });
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  // Don't render auth form if already logged in and on setup step
  if (user && step === 'auth') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 'profile-setup' ? null : navigate('/')}
          className="gap-2 min-h-[44px]"
          disabled={step === 'profile-setup'}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm glass-card border-border/50">
          {step === 'auth' ? (
            <>
              <CardHeader className="text-center pb-4">
                <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary-foreground font-bold text-lg">L</span>
                </div>
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
          ) : (
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

                  <Button type="button" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleSkipSetup} disabled={loading}>
                    Skip for now
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

export default Auth;
