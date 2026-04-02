import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Shield,
  Trash2,
  RefreshCw,
  Users,
  MessageSquare,
  Inbox,
  UserPlus,
  Lock
} from 'lucide-react';

type AllowlistType = 'EMAIL' | 'USERNAME';

interface AllowlistEntry {
  id: string;
  identifier: string;
  type: AllowlistType;
  is_active: boolean;
  created_at: string;
}

interface InviteRequest {
  id: string;
  user_id: string;
  email: string;
  username: string | null;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  admin_note: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addingEntry, setAddingEntry] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [resetScope, setResetScope] = useState<'self' | 'all'>('self');
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // New entry form
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newType, setNewType] = useState<AllowlistType>('EMAIL');

  const isAdmin = profile?.is_admin === true;
  const currentUserEmail = user?.email?.toLowerCase();
  const currentUsername = profile?.username?.toLowerCase();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allowlistRes, inviteRes, feedbackRes] = await Promise.all([
        supabase
          .from('allowlist')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('invite_requests')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('feedback')
          .select('id', { count: 'exact' })
          .eq('is_read', false),
      ]);

      if (!allowlistRes.error) setAllowlist(allowlistRes.data || []);
      if (!inviteRes.error) setInviteRequests((inviteRes.data as InviteRequest[]) || []);
      if (!feedbackRes.error) setFeedbackCount(feedbackRes.count || 0);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      toast({
        title: 'Error',
        description: 'Failed to load admin data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if entry belongs to current admin
  const isAdminEntry = (entry: AllowlistEntry): boolean => {
    const id = entry.identifier.toLowerCase();
    if (entry.type === 'EMAIL' && currentUserEmail === id) return true;
    if (entry.type === 'USERNAME' && currentUsername === id) return true;
    return false;
  };

  const handleAddEntry = async () => {
    if (!newIdentifier.trim()) {
      toast({
        title: 'Missing identifier',
        description: 'Please enter an email or username.',
        variant: 'destructive',
      });
      return;
    }

    setAddingEntry(true);
    try {
      const { error } = await supabase
        .from('allowlist')
        .insert({
          identifier: newIdentifier.trim().toLowerCase(),
          type: newType,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'Entry added',
        description: `${newIdentifier} added to allowlist.`,
      });

      setNewIdentifier('');
      await fetchData();
    } catch (err: any) {
      console.error('Error adding entry:', err);
      toast({
        title: 'Error',
        description: err.message?.includes('duplicate') 
          ? 'This entry already exists.' 
          : 'Failed to add entry.',
        variant: 'destructive',
      });
    } finally {
      setAddingEntry(false);
    }
  };

  const handleToggleActive = async (entry: AllowlistEntry) => {
    if (isAdminEntry(entry)) {
      toast({
        title: 'Cannot modify',
        description: 'You cannot disable your own allowlist entry.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('allowlist')
        .update({ is_active: !entry.is_active })
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: entry.is_active ? 'Entry disabled' : 'Entry enabled',
      });

      await fetchData();
    } catch (err) {
      console.error('Error toggling entry:', err);
      toast({
        title: 'Error',
        description: 'Failed to update entry.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEntry = async (entry: AllowlistEntry) => {
    if (isAdminEntry(entry)) {
      toast({
        title: 'Cannot delete',
        description: 'You cannot delete your own allowlist entry.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('allowlist')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast({ title: 'Entry deleted' });
      await fetchData();
    } catch (err) {
      console.error('Error deleting entry:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete entry.',
        variant: 'destructive',
      });
    }
  };

  const handleResetDemoData = async () => {
    setResetting(true);
    try {
      if (resetScope === 'all') {
        const { data, error } = await supabase.rpc('reset_all_users_data', {
          _seed_balance: false,
        });

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error || 'Reset failed');

        toast({
          title: 'All users reset',
          description: 'All user data cleared.',
        });
      } else {
        const { data, error } = await supabase.rpc('reset_demo_data', {
          _seed_balance: false,
        });

        if (error) throw error;
        const result = data as { success: boolean; error?: string };
        if (!result.success) throw new Error(result.error || 'Reset failed');

        toast({
          title: 'Data reset',
          description: 'Your balances and transactions cleared.',
        });
      }
    } catch (err: any) {
      console.error('Error resetting data:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset data.',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  const handleApproveRequest = async (request: InviteRequest) => {
    setProcessingRequest(request.id);
    try {
      // Add to allowlist
      await supabase.from('allowlist').insert({
        identifier: request.email.toLowerCase(),
        type: 'EMAIL',
        is_active: true,
      });

      if (request.username) {
        await supabase.from('allowlist').insert({
          identifier: request.username.toLowerCase(),
          type: 'USERNAME',
          is_active: true,
        });
      }

      // Update request status
      await supabase
        .from('invite_requests')
        .update({ status: 'APPROVED' })
        .eq('id', request.id);

      toast({ title: 'Request approved', description: `${request.email} added to allowlist.` });
      await fetchData();
    } catch (err) {
      console.error('Error approving request:', err);
      toast({
        title: 'Error',
        description: 'Failed to approve request.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (request: InviteRequest) => {
    setProcessingRequest(request.id);
    try {
      await supabase
        .from('invite_requests')
        .update({ status: 'DECLINED' })
        .eq('id', request.id);

      toast({ title: 'Request declined' });
      await fetchData();
    } catch (err) {
      console.error('Error declining request:', err);
      toast({
        title: 'Error',
        description: 'Failed to decline request.',
        variant: 'destructive',
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const pendingRequests = inviteRequests.filter(r => r.status === 'PENDING');

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Admin Panel
              </h1>
              <p className="text-xs text-muted-foreground truncate">Manage allowlist & settings</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 relative"
              onClick={() => navigate('/admin/feedback')}
            >
              <Inbox className="w-4 h-4" />
              <span className="hidden sm:inline">Feedback</span>
              {feedbackCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-[10px] flex items-center justify-center">
                  {feedbackCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Invite Requests */}
            {pendingRequests.length > 0 && (
              <Card className="glass-card border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Invite Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-3 rounded-lg bg-background/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono truncate">{req.email}</span>
                        <Badge variant="outline" className="text-[10px]">PENDING</Badge>
                      </div>
                      {req.username && (
                        <p className="text-xs text-primary">@{req.username}</p>
                      )}
                      {req.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{req.message}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleApproveRequest(req)}
                          disabled={processingRequest === req.id}
                        >
                          {processingRequest === req.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Approve'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleDeclineRequest(req)}
                          disabled={processingRequest === req.id}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add to Allowlist */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add to Allowlist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs">Identifier</Label>
                    <Input
                      placeholder="email@example.com or username"
                      value={newIdentifier}
                      onChange={(e) => setNewIdentifier(e.target.value)}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="w-full sm:w-28 space-y-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as AllowlistType)}>
                      <SelectTrigger className="min-h-[44px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="USERNAME">Username</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleAddEntry}
                  disabled={addingEntry || !newIdentifier.trim()}
                  className="w-full min-h-[44px] gradient-primary"
                >
                  {addingEntry ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Entry
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Allowlist */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Allowlist ({allowlist.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allowlist.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No entries yet. Add an email or username above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {allowlist.map((entry) => {
                      const locked = isAdminEntry(entry);
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${
                            locked ? 'bg-primary/10 border border-primary/30' : 'bg-background/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Badge variant={entry.type === 'EMAIL' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                              {entry.type}
                            </Badge>
                            <span className="text-xs font-mono truncate">{entry.identifier}</span>
                            {locked && (
                              <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                ADMIN
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Switch
                              checked={entry.is_active}
                              onCheckedChange={() => handleToggleActive(entry)}
                              disabled={locked}
                            />
                            {!locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteEntry(entry)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Management */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Reset user balances and transaction history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Reset Scope</Label>
                  <Select value={resetScope} onValueChange={(v) => setResetScope(v as 'self' | 'all')}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">My data only</SelectItem>
                      <SelectItem value="all">All users (global)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={`w-full ${
                        resetScope === 'all' 
                          ? 'border-destructive text-destructive hover:bg-destructive/10' 
                          : 'border-warning text-warning hover:bg-warning/10'
                      }`}
                    >
                      {resetScope === 'all' ? 'Reset ALL Users' : 'Reset My Data'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {resetScope === 'all' ? '⚠️ Reset ALL Users?' : 'Reset Data?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {resetScope === 'all' ? (
                          <>
                            <strong className="text-destructive">This will reset ALL users' data:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                              <li>All crypto and NGN balances set to 0</li>
                              <li>All transactions deleted</li>
                              <li>All deposits, conversions, withdrawals cleared</li>
                            </ul>
                            <p className="mt-3 font-medium">This action cannot be undone.</p>
                          </>
                        ) : (
                          'This will clear your balances, transactions, deposits, conversions, and withdrawals. This action cannot be undone.'
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDemoData}
                        className={
                          resetScope === 'all'
                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                            : 'bg-warning text-warning-foreground hover:bg-warning/90'
                        }
                        disabled={resetting}
                      >
                        {resetting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          resetScope === 'all' ? 'Reset All Users' : 'Reset'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Admin;
