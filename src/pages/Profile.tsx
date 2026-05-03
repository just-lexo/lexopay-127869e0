import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BottomNav } from '@/components/BottomNav';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  Edit,
  Loader2,
  AlertTriangle,
  Wallet,
  Copy,
  Check,
  Unlink,
  User,
  ChevronRight,
  BadgeCheck,
  Settings,
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [usernameWarningOpen, setUsernameWarningOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Wallet
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const walletAddress = profile?.wallet_address;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n.charAt(0).toUpperCase()).slice(0, 2).join('');
  };

  const getKYCLabel = (tier: number) => {
    if (tier >= 2) return { label: 'Verified', variant: 'default' as const };
    if (tier === 1) return { label: 'Pending', variant: 'secondary' as const };
    return { label: 'Not Verified', variant: 'outline' as const };
  };
  const kycBadge = getKYCLabel(profile?.kyc_tier ?? 0);

  const openEditProfile = () => {
    setEditDisplayName(profile?.display_name || '');
    setEditUsername(profile?.username || '');
    setUsernameError('');
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    const newUsername = editUsername.trim().toLowerCase().replace('@', '');
    const newDisplayName = editDisplayName.trim();
    if (!newUsername) { setUsernameError('Username is required'); return; }
    if (newUsername.length < 3) { setUsernameError('Must be at least 3 characters'); return; }
    if (!/^[a-z0-9_]+$/.test(newUsername)) { setUsernameError('Only letters, numbers, and underscores'); return; }
    if (newUsername !== profile?.username?.toLowerCase()) {
      setUsernameWarningOpen(true);
      return;
    }
    await saveProfile(newDisplayName, newUsername);
  };

  const saveProfile = async (displayName: string, username: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName || null, username }).eq('user_id', user?.id);
      if (error) throw error;
      toast({ title: 'Profile updated' });
      setEditOpen(false);
      setUsernameWarningOpen(false);
      refreshProfile?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message?.includes('duplicate') ? 'Username taken' : 'Failed to save', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const confirmUsernameChange = async () => {
    const newUsername = editUsername.trim().toLowerCase().replace('@', '');
    await saveProfile(editDisplayName.trim(), newUsername);
  };

  // Wallet handlers
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast({ title: 'Copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const connectWallet = async () => {
    if (!user) return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast({ title: 'No wallet found', description: 'Install MetaMask or a compatible wallet.', variant: 'destructive' });
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) { toast({ title: 'Connection cancelled', variant: 'destructive' }); return; }
      const address = accounts[0];
      const message = `Link wallet to LexoPay: @${profile?.username}\nTimestamp: ${Date.now()}`;
      const signature = await ethereum.request({ method: 'personal_sign', params: [message, address] });
      if (!signature) { toast({ title: 'Signature rejected', variant: 'destructive' }); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/wallet-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}`, 'apikey': anonKey },
        body: JSON.stringify({ address, signature, message, linkToSession: user.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Linking failed');
      toast({ title: 'Wallet linked!' });
      refreshProfile?.();
    } catch (err: any) {
      if (err.code === 4001) { toast({ title: 'Connection rejected', variant: 'destructive' }); }
      else { toast({ title: 'Connection failed', description: err.message || 'Try again.', variant: 'destructive' }); }
    } finally { setConnecting(false); }
  };

  const disconnectWallet = async () => {
    if (!user) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.from('profiles').update({ wallet_address: null, wallet_connected_at: null } as any).eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Wallet disconnected' });
      setDisconnectOpen(false);
      refreshProfile?.();
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h1 className="font-semibold text-base">Account</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Profile Section */}
        <Card className="glass-card border-border/50">
          <CardContent className="pt-6 pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold truncate">{profile?.display_name || 'LexoPay User'}</h2>
                <p className="text-sm text-primary font-mono">@{profile?.username}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={openEditProfile}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Section */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <Wallet className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-medium flex-1">Wallet</p>
              {walletAddress && (
                <Badge variant="default" className="text-[10px]">Connected</Badge>
              )}
            </div>
            {walletAddress ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <p className="font-mono text-sm text-primary">{shortenAddress(walletAddress)}</p>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress}>
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button variant="outline" className="w-full min-h-[44px] gap-2 text-destructive hover:text-destructive" onClick={() => setDisconnectOpen(true)}>
                  <Unlink className="w-4 h-4" /> Disconnect
                </Button>
              </div>
            ) : (
              <div>
                <Button variant="outline" className="w-full min-h-[44px] gap-2" onClick={connectWallet} disabled={connecting}>
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wallet className="w-4 h-4" /> Connect Wallet</>}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  On mobile, open LexoPay in your wallet app's browser.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Section */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-4">
            <button className="flex items-center gap-3 w-full text-left" onClick={() => navigate('/kyc')}>
              <BadgeCheck className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Verification</p>
                <p className="text-xs text-muted-foreground">Identity verification status</p>
              </div>
              <Badge variant={kycBadge.variant} className="text-xs">{kycBadge.label}</Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-2 divide-y divide-border/50">
            <button className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/30 transition-colors rounded-md px-2 -mx-2" onClick={() => navigate('/support')}>
              <MessageSquarePlus className="w-5 h-5 text-muted-foreground" />
              <p className="text-sm font-medium flex-1">Support</p>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {profile?.is_admin && (
              <button className="flex items-center gap-3 py-3 w-full text-left hover:bg-muted/30 transition-colors rounded-md px-2 -mx-2" onClick={() => navigate('/admin')}>
                <Shield className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium">Admin Panel</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
            )}

            <button className="flex items-center gap-3 py-3 w-full text-left hover:bg-destructive/10 transition-colors rounded-md px-2 -mx-2 text-destructive" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
              <p className="text-sm font-medium">Log Out</p>
            </button>
          </CardContent>
        </Card>
      </main>

      <BottomNav />

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input placeholder="Your name" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input placeholder="username" value={editUsername} onChange={(e) => { setEditUsername(e.target.value.replace('@', '')); setUsernameError(''); }} className="min-h-[44px] pl-8" />
              </div>
              {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
              {editUsername !== profile?.username && editUsername && !usernameError && (
                <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Changing username updates your LexoPay ID</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} disabled={saving || checkingUsername} className="gradient-primary">
              {saving || checkingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Username Warning */}
      <AlertDialog open={usernameWarningOpen} onOpenChange={setUsernameWarningOpen}>
        <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> Change Username?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update your LexoPay ID. Others will need your new username to send you funds.
              <br /><br /><strong>New username:</strong> @{editUsername.toLowerCase().replace('@', '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUsernameChange} className="bg-warning text-warning-foreground hover:bg-warning/90" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Wallet */}
      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Wallet?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the wallet from your account. You can reconnect anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disconnectWallet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={disconnecting}>
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
