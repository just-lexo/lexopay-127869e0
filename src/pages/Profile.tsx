import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { FeedbackModal } from '@/components/FeedbackModal';
import { WalletLinking } from '@/components/profile/WalletLinking';
import { QRIdentity } from '@/components/profile/QRIdentity';
import { SavedBankAccounts } from '@/components/profile/SavedBankAccounts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  LogOut,
  MessageSquarePlus,
  Settings,
  Edit,
  History,
  Loader2,
  AlertTriangle,
} from 'lucide-react';



const Profile = () => {
  const navigate = useNavigate();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  
  // Edit profile state
  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [usernameWarningOpen, setUsernameWarningOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const maskEmail = (email: string | undefined): string => {
    if (!email) return '***@***.com';
    const [local, domain] = email.split('@');
    if (!domain) return '***@***.com';
    const maskedLocal = local.charAt(0) + '***';
    return `${maskedLocal}@${domain}`;
  };


  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const getKYCBadge = (tier: number) => {
    const tiers = [
      { label: 'Unverified', variant: 'outline' as const },
      { label: 'Basic', variant: 'secondary' as const },
      { label: 'Verified', variant: 'default' as const },
      { label: 'Premium', variant: 'default' as const },
    ];
    return tiers[tier] || tiers[0];
  };

  const kycBadge = getKYCBadge(profile?.kyc_tier ?? 0);

  // Edit profile handlers
  const openEditProfile = () => {
    setEditDisplayName(profile?.display_name || '');
    setEditUsername(profile?.username || '');
    setUsernameError('');
    setEditOpen(true);
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (!username || username === profile?.username) return true;
    
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase.rpc('check_username_available' as any, {
        _username: username,
        _exclude_user_id: user?.id || null,
      });
      
      if (error) return false;
      return data as boolean;
    } catch {
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSaveProfile = async () => {
    const newUsername = editUsername.trim().toLowerCase().replace('@', '');
    const newDisplayName = editDisplayName.trim();

    if (!newUsername) {
      setUsernameError('Username is required');
      return;
    }

    if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(newUsername)) {
      setUsernameError('Only letters, numbers, and underscores allowed');
      return;
    }

    // Check if username changed and show warning
    if (newUsername !== profile?.username?.toLowerCase()) {
      const available = await checkUsernameAvailability(newUsername);
      if (!available) {
        setUsernameError('Username already taken');
        return;
      }
      setUsernameWarningOpen(true);
      return;
    }

    await saveProfile(newDisplayName, newUsername);
  };

  const saveProfile = async (displayName: string, username: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName || null,
          username: username,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({ title: 'Profile updated!' });
      setEditOpen(false);
      setUsernameWarningOpen(false);
      refreshProfile?.();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast({
        title: 'Error',
        description: err.message?.includes('duplicate') 
          ? 'Username already taken' 
          : 'Failed to save profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmUsernameChange = async () => {
    const newUsername = editUsername.trim().toLowerCase().replace('@', '');
    const newDisplayName = editDisplayName.trim();
    await saveProfile(newDisplayName, newUsername);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />

      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h1 className="font-semibold text-base">Profile</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile Card */}
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <Avatar className="w-20 h-20 mb-3">
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>

              {/* Name & Username */}
              <h2 className="text-lg font-semibold">
                {profile?.display_name || 'LexoPay User'}
              </h2>
              <p className="text-sm text-primary font-mono">@{profile?.username}</p>

              {/* Masked Email */}
              <p className="text-xs text-muted-foreground mt-1">
                {maskEmail(user?.email)}
              </p>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                {profile?.is_admin && (
                  <Badge variant="default" className="gap-1 bg-primary text-primary-foreground text-xs">
                    <Shield className="w-3 h-3" />
                    ADMIN
                  </Badge>
                )}
                <Badge variant={kycBadge.variant} className="gap-1 text-xs">
                  <Shield className="w-3 h-3" />
                  {kycBadge.label}
                </Badge>
              </div>

              {/* Edit Button */}
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={openEditProfile}
              >
                <Edit className="w-3.5 h-3.5" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Identity */}
        <QRIdentity />

        {/* Wallet Linking */}
        <WalletLinking />


        {/* Quick Links */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-2 divide-y divide-border/50">
            {/* View History */}
            <button
              className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-md"
              onClick={() => navigate('/transactions')}
            >
              <History className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">View History</p>
                <p className="text-xs text-muted-foreground">
                  See all transactions
                </p>
              </div>
            </button>

            {/* Feedback Button */}
            <button
              className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-md"
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquarePlus className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Send Feedback</p>
                <p className="text-xs text-muted-foreground">
                  Report bugs or suggest ideas
                </p>
              </div>
            </button>

            {/* Log Out Button */}
            <button
              className="flex items-center gap-3 py-3 w-full text-left hover:bg-destructive/10 transition-colors -mx-2 px-2 rounded-md text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              <p className="text-sm font-medium">Log out</p>
            </button>
          </CardContent>
        </Card>

        {/* Admin Access */}
        {profile?.is_admin && (
          <Button
            variant="outline"
            className="w-full min-h-[48px] gap-2"
            onClick={() => navigate('/admin')}
          >
            <Shield className="w-4 h-4" />
            Admin Panel
          </Button>
        )}
      </main>

      <BottomNav />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="Your name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  placeholder="username"
                  value={editUsername}
                  onChange={(e) => {
                    setEditUsername(e.target.value.replace('@', ''));
                    setUsernameError('');
                  }}
                  className="min-h-[44px] pl-8"
                />
              </div>
              {usernameError && (
                <p className="text-xs text-destructive">{usernameError}</p>
              )}
              {editUsername !== profile?.username && editUsername && !usernameError && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Changing your username will update your LexoPay ID
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProfile} 
              disabled={saving || checkingUsername}
              className="gradient-primary"
            >
              {saving || checkingUsername ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Username Change Warning */}
      <AlertDialog open={usernameWarningOpen} onOpenChange={setUsernameWarningOpen}>
        <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Change Username?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Changing your username will update your LexoPay ID. Other users will need to use your new username to send you funds.
              <br /><br />
              <strong>New username:</strong> @{editUsername.toLowerCase().replace('@', '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUsernameChange}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Change'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
