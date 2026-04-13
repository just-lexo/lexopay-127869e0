import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Loader2, Shield, Users, Inbox, BarChart3,
  ArrowDownToLine, RefreshCw, ArrowUpFromLine, Search,
  AlertTriangle, Settings, UserX, UserCheck, CheckCircle, XCircle,
  MessageCircle, Send as SendIcon,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalConversions: number;
  totalWithdrawals: number;
  totalVolume: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { maintenance, toggle: toggleMaintenance } = useMaintenanceMode();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalDeposits: 0, totalConversions: 0, totalWithdrawals: 0, totalVolume: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<any[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return; }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profilesRes, depositsRes, conversionsRes, withdrawalsRes, txRes, feedbackRes, kycRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('deposits').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('conversions').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('feedback').select('id', { count: 'exact' }).eq('is_read', false),
        supabase.from('kyc_submissions').select('*').order('created_at', { ascending: false }),
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      ]);

      const users = profilesRes.data || [];
      const deps = depositsRes.data || [];
      const convs = conversionsRes.data || [];
      const wds = withdrawalsRes.data || [];

      setAllUsers(users);
      setDeposits(deps);
      setConversions(convs);
      setWithdrawals(wds);
      setRecentTransactions(txRes.data || []);
      setFeedbackCount(feedbackRes.count || 0);
      setKycSubmissions(kycRes.data || []);
      setSupportTickets((ticketsRes.data as any[]) || []);

      const totalVolume = wds.filter((w: any) => w.status === 'SUCCESS').reduce((s: number, w: any) => s + Number(w.amount || 0), 0);

      setStats({
        totalUsers: users.length,
        totalDeposits: deps.length,
        totalConversions: convs.length,
        totalWithdrawals: wds.length,
        totalVolume,
      });
    } catch (err) {
      console.error('Admin fetch error:', err);
      toast({ title: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const maskAccount = (num: string) => num.length > 4 ? num.slice(0, 4) + '****' + num.slice(-2) : num;

  const filteredUsers = allUsers.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.username?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q) || u.wallet_address?.toLowerCase().includes(q);
  });

  const handleToggleMaintenance = async (val: boolean) => {
    setTogglingMaintenance(true);
    const { error } = await toggleMaintenance(val);
    if (error) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } else {
      toast({ title: val ? 'Maintenance mode enabled' : 'System is back online' });
    }
    setTogglingMaintenance(false);
  };

  const handleKYCAction = async (submissionId: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('kyc_submissions')
      .update({ status: action, updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (error) {
      toast({ title: 'Failed to update KYC', variant: 'destructive' });
    } else {
      toast({ title: `KYC ${action}` });
      // Update the user's kyc_tier if approved
      if (action === 'approved') {
        const submission = kycSubmissions.find(k => k.id === submissionId);
        if (submission) {
          await supabase.from('profiles').update({ kyc_tier: 2 }).eq('user_id', submission.user_id);
        }
      }
      fetchData();
    }
  };

  const handleTicketReply = async (ticketId: string, newStatus?: string) => {
    const updates: Record<string, any> = {};
    if (replyText.trim()) updates.admin_reply = replyText.trim();
    if (newStatus) updates.status = newStatus;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('support_tickets').update(updates).eq('id', ticketId);
    if (error) {
      toast({ title: 'Failed to update ticket', variant: 'destructive' });
    } else {
      toast({ title: 'Ticket updated' });
      setReplyingTo(null);
      setReplyText('');
      fetchData();
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Admin Panel
            </h1>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 relative" onClick={() => navigate('/admin/feedback')}>
            <Inbox className="w-4 h-4" />
            {feedbackCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-[10px] flex items-center justify-center">{feedbackCount}</Badge>
            )}
          </Button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="overview" className="text-[10px]">Dashboard</TabsTrigger>
              <TabsTrigger value="users" className="text-[10px]">Users</TabsTrigger>
              <TabsTrigger value="transactions" className="text-[10px]">Txns</TabsTrigger>
              <TabsTrigger value="kyc" className="text-[10px]">KYC</TabsTrigger>
              <TabsTrigger value="settings" className="text-[10px]">Settings</TabsTrigger>
            </TabsList>

            {/* DASHBOARD */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={stats.totalUsers.toString()} />
                <StatCard icon={<ArrowDownToLine className="w-4 h-4" />} label="Deposits" value={stats.totalDeposits.toString()} />
                <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Conversions" value={stats.totalConversions.toString()} />
                <StatCard icon={<ArrowUpFromLine className="w-4 h-4" />} label="Withdrawals" value={stats.totalWithdrawals.toString()} />
              </div>
              <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Total Volume" value={`₦${stats.totalVolume.toLocaleString()}`} />

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  {recentTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No transactions</p>
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

            {/* USERS */}
            <TabsContent value="users" className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
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
                            <p className="text-[10px] text-muted-foreground mt-0.5">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {u.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
                            <Badge variant="outline" className="text-[10px]">KYC {u.kyc_tier}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TRANSACTIONS */}
            <TabsContent value="transactions" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Deposits ({deposits.length})</CardTitle></CardHeader>
                <CardContent>
                  {deposits.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">None</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {deposits.slice(0, 20).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs truncate">{d.address?.slice(0, 10)}...</p>
                            <p className="text-xs text-muted-foreground">{d.token} • {new Date(d.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm">{d.amount || '—'}</p>
                            <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Conversions ({conversions.length})</CardTitle></CardHeader>
                <CardContent>
                  {conversions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">None</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {conversions.slice(0, 20).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 text-sm">
                          <div>
                            <p className="font-mono text-xs">{c.from_amount} {c.from_token}</p>
                            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm">₦{Number(c.ngn_amount).toLocaleString()}</p>
                            <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Withdrawals ({withdrawals.length})</CardTitle></CardHeader>
                <CardContent>
                  {withdrawals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">None</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {withdrawals.slice(0, 20).map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 text-sm">
                          <div>
                            <p className="text-xs font-medium">{w.bank_name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{maskAccount(w.account_number)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm">₦{Number(w.amount).toLocaleString()}</p>
                            <Badge variant="outline" className="text-[10px]">{w.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* KYC */}
            <TabsContent value="kyc" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">KYC Submissions</CardTitle>
                  <CardDescription className="text-xs">Review and approve identity verification requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {kycSubmissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No KYC submissions</p>
                  ) : (
                    <div className="space-y-3">
                      {kycSubmissions.map((kyc: any) => (
                        <div key={kyc.id} className="p-3 rounded-lg bg-background/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{kyc.full_name}</p>
                              <p className="text-xs text-muted-foreground">{kyc.phone_number}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(kyc.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge variant={kyc.status === 'approved' ? 'default' : kyc.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {kyc.status}
                            </Badge>
                          </div>
                          {kyc.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8" onClick={() => handleKYCAction(kyc.id, 'approved')}>
                                <CheckCircle className="w-3 h-3" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8 text-destructive" onClick={() => handleKYCAction(kyc.id, 'rejected')}>
                                <XCircle className="w-3 h-3" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SETTINGS */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> Maintenance Mode</CardTitle>
                  <CardDescription className="text-xs">Block user financial actions. Persists across reloads.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-4 h-4 ${maintenance ? 'text-warning' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{maintenance ? 'Maintenance Active' : 'System Online'}</span>
                    </div>
                    <Switch checked={maintenance} onCheckedChange={handleToggleMaintenance} disabled={togglingMaintenance} />
                  </div>
                  {maintenance && (
                    <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <p className="text-xs text-warning">Users cannot perform deposits, conversions, or withdrawals.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm">System Info</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Network</span><span>Base Mainnet</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Payout</span><span>Paystack</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Price Feed</span><span>Coinbase</span></div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="glass-card border-border/50">
    <CardContent className="py-3 px-3">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-xl font-bold">{value}</p>
    </CardContent>
  </Card>
);

export default Admin;
