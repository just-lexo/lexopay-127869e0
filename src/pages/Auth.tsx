import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Mail, Lock, User, AtSign } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

type AuthStep = 'auth' | 'profile-setup';

const Auth = () => {
  const navigate = useNavigate();
  const { signUp, signIn, updateProfile, user, profile } = useAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('auth');
  const [loading, setLoading] = useState(false);
  
  // Auth form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile form
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  // If user is logged in and has username, redirect to dashboard
  if (user && profile?.username) {
    navigate('/dashboard');
    return null;
  }

  // If user is logged in but no username, show profile setup
  if (user && !profile?.username && step === 'auth') {
    setStep('profile-setup');
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({
        title: 'Invalid email',
        description: emailResult.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({
        title: 'Invalid password',
        description: passwordResult.error.errors[0].message,
        variant: 'destructive',
      });
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
          toast({
            title: 'Login failed',
            description: message,
            variant: 'destructive',
          });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          let message = error.message;
          if (message.includes('User already registered')) {
            message = 'This email is already registered. Please login instead.';
          }
          toast({
            title: 'Sign up failed',
            description: message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Account created!',
            description: 'Please set up your profile.',
          });
          setStep('profile-setup');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate username
    const usernameResult = usernameSchema.safeParse(username);
    if (!usernameResult.success) {
      toast({
        title: 'Invalid username',
        description: usernameResult.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (!displayName.trim()) {
      toast({
        title: 'Display name required',
        description: 'Please enter a display name.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await updateProfile({
        username: username.toLowerCase(),
        display_name: displayName.trim(),
      });

      if (error) {
        let message = error.message;
        if (message.includes('duplicate key') || message.includes('unique')) {
          message = 'This username is already taken. Please choose another.';
        }
        toast({
          title: 'Profile update failed',
          description: message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Welcome to LexoPay!',
          description: 'Your profile has been set up.',
        });
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => step === 'profile-setup' ? null : navigate('/')}
          className="gap-2"
          disabled={step === 'profile-setup'}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card border-border/50">
          {step === 'auth' ? (
            <>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary-foreground font-bold text-xl">L</span>
                </div>
                <CardTitle className="text-2xl">
                  {isLogin ? 'Welcome back' : 'Create account'}
                </CardTitle>
                <CardDescription>
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
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full touch-target gradient-primary hover:opacity-90"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      isLogin ? 'Sign In' : 'Create Account'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <Button
                      variant="link"
                      className="pl-1 text-primary"
                      onClick={() => setIsLogin(!isLogin)}
                    >
                      {isLogin ? 'Sign up' : 'Sign in'}
                    </Button>
                  </p>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <User className="w-6 h-6 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">Set up your profile</CardTitle>
                <CardDescription>
                  Choose your username and display name
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="johndoe"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        className="pl-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Letters, numbers, and underscores only
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        type="text"
                        placeholder="John Doe"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full touch-target gradient-primary hover:opacity-90"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Complete Setup'
                    )}
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
