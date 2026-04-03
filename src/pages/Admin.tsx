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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Shield,
  Trash2,
  Users,
  Inbox,
  UserPlus,
  Lock,
  BarChart3,
  ArrowDownToLine,
  RefreshCw,
  ArrowUpFromLine,
  Search,
  AlertTriangle,
  Settings,
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

interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalConversions: number;
  totalWithdrawals: number;
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
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalDeposits: 0, totalConversions: 0, totalWithdrawals: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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
      const [allowlistRes, inviteRes, feedbackRes, profilesRes, depositsRes, conversionsRes, withdrawalsRes, transactionsRes] = await Promise.all([
        supabase.from('allowlist').select('*').order('created_at', { ascending: false }),
        supabase.from('invite_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('feedback').select('id', { count: 'exact' }).eq('is_read', false),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('deposits').select('id', { count: 'exact' }),
        supabase.from('conversions').select('id', { count: 'exact' }),
        supabase.from('withdrawals').select('id', { count: 'exact' }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      if (!allowlistRes.error) setAllowlist(allowlistRes.data || []);
      if (!inviteRes.error) setInviteRequests((inviteRes.data as InviteRequest[]) || []);
      if (!feedbackRes.error) setFeedbackCount(feedbackRes.count || 0);
      if (!profilesRes.error) setAllUsers(profilesRes.data || []);
      if (!transactionsRes.error) setRecentTransactions(transactionsRes.data || []);

      setStats({
        totalUsers: profilesRes.data?.length || 0,
        totalDeposits: depositsRes.count || 0,
        totalConversions: conversionsRes.count || 0,
        totalWithdrawals: withdrawalsRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching admin data:', err);
      toast({ title: 'Error', description: 'Failed to load admin data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isAdminEntry = (entry: AllowlistEntry): boolean => {
    const id = entry.identifier.toLowerCase();
    if (entry.type === 'EMAIL' && currentUserEmail === id) return true;
    if (entry.type === 'USERNAME' && currentUsername === id) return true;
    return false;
  };

  const handleAddEntry = async () => {
    if (!newIdentifier.trim()) return;
    setAddingEntry(true);
    try {
      const { error } = await supabase.from('allowlist').insert({
        identifier: newIdentifier.trim().toLowerCase(),
        type: newType,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: 'Entry added', description: `${newIdentifier} added to allowlist.` });
      setNewIdentifier('');
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message?.includes('duplicate') ? 'Already exists.' : 'Failed to add.', variant: 'destructive' });
    } finally {
      setAddingEntry(false);
    }
  };

  const handleToggleActive = async (entry: AllowlistEntry) => {
    if (isAdminEntry(entry)) {
      toast({ title: 'Cannot modify', description: 'Cannot disable your own entry.', variant: 'destructive' });
      return;
    }
    try {
      await supabase.from('allowlist').update({ is_active: !entry.is_active }).eq('id', entry.id);
      toast({ title: entry.is_active ? 'Disabled' : 'Enabled' });
      await fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDeleteEntry = async (entry: AllowlistEntry) => {
    if (isAdminEntry(entry)) {
      toast({ title: 'Cannot delete own entry', variant: 'destructive' });
      return;
    }
    try {
      await supabase.from('allowlist').delete().eq('id', entry.id);
      toast({ title: 'Deleted' });
      await fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleApproveRequest = async (request: InviteRequest) => {
    setProcessingRequest(request.id);
    try {
      await supabase.from('allowlist').insert({ identifier: request.email.toLowerCase(), type: 'EMAIL', is_active: true });
      if (request.username) {
        await supabase.from('allowlist').insert({ identifier: request.username.toLowerCase(), type: 'USERNAME', is_active: true });
      }
      await supabase.from('invite_requests').update({ status: 'APPROVED' }).eq('id', request.id);
      toast({ title: 'Approved', description: `${request.email} added.` });
      await fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDeclineRequest = async (request: InviteRequest) => {
    setProcessingRequest(request.id);
    try {
      await supabase.from('invite_requests').update({ status: 'DECLINED' }).eq('id', request.id);
      toast({ title: 'Declined' });
      await fetchData();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setProcessingRequest(null);
    }
  };

  const maskAccountNumber = (num: string) => {
    if (num.length <= 4) return num;
    return num.slice(0, 4) + '****' + num.slice(-2);
  };

  const pendingRequests = inviteRequests.filter(r => r.status === 'PENDING');
  const filteredUsers = allUsers.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.username?.toLowerCase().includes(q)) || (u.display_name?.toLowerCase().includes(q)) || (u.wallet_address?.toLowerCase().includes(q));
  });

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
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
              <p className="text-xs text-muted-foreground truncate">Monitor & manage</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 relative" onClick={() => navigate('/admin/feedback')}>
              <Inbox className="w-4 h-4" />
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
                <TabsTrigger value="access" className="text-xs">Access</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={stats.totalUsers} />
                  <StatCard icon={<ArrowDownToLine className="w-4 h-4" />} label="Deposits" value={stats.totalDeposits} />
                  <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Conversions" value={stats.totalConversions} />
                  <StatCard icon={<ArrowUpFromLine className="w-4 h-4" />} label="Withdrawals" value={stats.totalWithdrawals} />
                </div>

                {/* Recent Activity */}
                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentTransactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {recentTransactions.map((tx: any) => (
                          <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{tx.title}</p>
                              <p className="text-xs text-muted-foreground">{tx.kind} • {new Date(tx.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono">{tx.amount_display}</p>
                              <Badge variant="outline" className="text-[10px]">{tx.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* USERS TAB */}
              <TabsContent value="users" className="space-y-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((u: any) => (
                      <Card key={u.id} className="glass-card border-border/50">
                        <CardContent className="py-3 px-3">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{u.display_name || 'Unnamed'}</p>
                              {u.username && <p className="text-xs text-primary">@{u.username}</p>}
                              {u.wallet_address && (
                                <p className="text-[10px] font-mono text-muted-foreground truncate">
                                  {u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Joined {new Date(u.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {u.is_admin && (
                                <Badge variant="default" className="text-[10px]">Admin</Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">KYC {u.kyc_tier}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ACCESS TAB */}
              <TabsContent value="access" className="space-y-4 mt-4">
                {/* Invite Requests */}
                {pendingRequests.length > 0 && (
                  <Card className="glass-card border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Requests ({pendingRequests.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="p-3 rounded-lg bg-background/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono truncate">{req.email}</span>
                            <Badge variant="outline" className="text-[10px]">PENDING</Badge>
                          </div>
                          {req.username && <p className="text-xs text-primary">@{req.username}</p>}
                          {req.message && <p className="text-xs text-muted-foreground line-clamp-2">{req.message}</p>}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleApproveRequest(req)} disabled={processingRequest === req.id}>
                              {processingRequest === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => handleDeclineRequest(req)} disabled={processingRequest === req.id}>
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
                          <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="USERNAME">Username</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleAddEntry} disabled={addingEntry || !newIdentifier.trim()} className="w-full min-h-[44px] gradient-primary">
                      {addingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Add Entry</>}
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
                      <p className="text-sm text-muted-foreground text-center py-4">No entries yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {allowlist.map((entry) => {
                          const locked = isAdminEntry(entry);
                          return (
                            <div key={entry.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${locked ? 'bg-primary/10 border border-primary/30' : 'bg-background/50'}`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge variant={entry.type === 'EMAIL' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{entry.type}</Badge>
                                <span className="text-xs font-mono truncate">{entry.identifier}</span>
                                {locked && <Badge variant="outline" className="text-[10px] gap-1 shrink-0"><Lock className="w-2.5 h-2.5" />ADMIN</Badge>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Switch checked={entry.is_active} onCheckedChange={() => handleToggleActive(entry)} disabled={locked} />
                                {!locked && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteEntry(entry)}>
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
              </TabsContent>

              {/* SETTINGS TAB */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Maintenance Mode
                    </CardTitle>
                    <CardDescription>
                      When enabled, users cannot deposit, convert, or withdraw.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${maintenanceMode ? 'text-warning' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium">{maintenanceMode ? 'Maintenance Active' : 'System Online'}</span>
                      </div>
                      <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                    </div>
                    {maintenanceMode && (
                      <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <p className="text-xs text-warning">Users will see a maintenance message and cannot perform financial actions.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">System Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span>Base Mainnet</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payout Provider</span>
                      <span>Paystack</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price Feed</span>
                      <span>Coinbase</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <Card className="glass-card border-border/50">
    <CardContent className="py-3 px-3">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </CardContent>
  </Card>
);

export default Admin;
