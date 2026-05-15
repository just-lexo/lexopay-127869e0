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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminSupportChat } from '@/components/admin/AdminSupportChat';
import {
  ArrowLeft, Loader2, Shield, Users, Inbox, BarChart3,
  ArrowDownToLine, RefreshCw, ArrowUpFromLine, Search,
  AlertTriangle, Settings, UserX, UserCheck, CheckCircle, XCircle,
  MessageCircle, Send as SendIcon, FileText, Camera,
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
  const [syncingDeposits, setSyncingDeposits] = useState(false);
  const [recoverTxHash, setRecoverTxHash] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [treasury, setTreasury] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchTreasury = async () => {
    const { data } = await supabase.rpc('admin_treasury_kpis');
    setTreasury(data || null);
  };

  const fetchAuditLog = async () => {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setAuditLog((data as any[]) || []);
  };

  const handleFreeze = async (userId: string, freeze: boolean) => {
    const reason = freeze ? (window.prompt('Reason for freezing this account?') || '').trim() : null;
    if (freeze && !reason) return;
    setBusyId(userId);
    const { data, error } = await supabase.rpc('admin_set_account_frozen', {
      _target_user: userId, _frozen: freeze, _reason: reason,
    });
    setBusyId(null);
    const r = data as any;
    if (error || !r?.success) {
      toast({ title: 'Failed', description: error?.message || r?.error || 'Try again', variant: 'destructive' });
    } else {
      toast({ title: freeze ? 'Account frozen' : 'Account unfrozen' });
      fetchData();
      fetchAuditLog();
    }
  };

  const handleResolveWithdrawal = async (id: string, success: boolean) => {
    const note = window.prompt(success ? 'Optional success note (e.g. provider ref)' : 'Reason for failing this withdrawal?') || '';
    if (!success && !note.trim()) return;
    setBusyId(id);
    const { data, error } = await supabase.rpc('admin_resolve_withdrawal', {
      _withdrawal_id: id, _success: success, _note: note,
    });
    setBusyId(null);
    const r = data as any;
    if (error || !r?.success) {
      toast({ title: 'Failed', description: error?.message || r?.error || 'Try again', variant: 'destructive' });
    } else {
      toast({ title: success ? 'Marked as paid' : 'Refunded user' });
      fetchData();
      fetchTreasury();
      fetchAuditLog();
    }
  };


  const handleRecoverByTx = async () => {
    const tx = recoverTxHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
      toast({ title: 'Invalid hash', description: 'Enter a 0x… 66-char tx hash.', variant: 'destructive' });
      return;
    }
    setRecovering(true);
    try {
      const { data, error } = await supabase.functions.invoke('recover-deposit-by-tx', {
        body: { tx_hash: tx },
      });
      if (error) throw error;
      toast({
        title: data?.credited > 0 ? 'Deposit recovered' : 'No new credit',
        description: `Credited ${data?.credited ?? 0} transfer(s). Confirmations: ${data?.confirmations ?? 0}.`,
      });
      if (data?.credited > 0) { setRecoverTxHash(''); fetchData(); }
    } catch (e: any) {
      toast({ title: 'Recovery failed', description: e?.message || 'Unable to recover deposit', variant: 'destructive' });
    } finally {
      setRecovering(false);
    }
  };

  const handleSyncDeposits = async () => {
    setSyncingDeposits(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-deposits', {
        body: { blocks: 50000 },
      });
      if (error) throw error;
      toast({
        title: 'Deposit sync complete',
        description: `Credited ${data?.credited ?? 0} new deposit(s) across ${data?.addresses ?? 0} address(es).`,
      });
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e?.message || 'Unable to sync deposits', variant: 'destructive' });
    } finally {
      setSyncingDeposits(false);
    }
  };
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) { navigate('/dashboard'); return; }
    fetchData();
    fetchTreasury();
    fetchAuditLog();
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

  const handleKYCAction = async (submissionId: string, action: 'approved' | 'rejected', reason?: string) => {
    const updates: Record<string, any> = { status: action, updated_at: new Date().toISOString() };
    if (action === 'rejected') updates.admin_note = reason?.trim() || 'Submission rejected. Please review and resubmit.';
    if (action === 'approved') updates.admin_note = null;

    const { error } = await supabase
      .from('kyc_submissions')
      .update(updates)
      .eq('id', submissionId);

    if (error) {
      toast({ title: 'Failed to update KYC', variant: 'destructive' });
    } else {
      toast({ title: `KYC ${action}` });
      if (action === 'approved') {
        const submission = kycSubmissions.find(k => k.id === submissionId);
        if (submission) {
          await supabase.from('profiles').update({ kyc_tier: 2 }).eq('user_id', submission.user_id);
        }
      }
      fetchData();
    }
  };

  const openSignedUrl = async (bucket: string, path: string | null | undefined) => {
    if (!path) {
      toast({ title: 'No file uploaded', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not load file', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Admin Panel
            </h1>
            <p className="text-[11px] text-muted-foreground">System-wide monitoring &amp; management</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab('support')}>
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
            {supportTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-[10px]">
                {supportTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-7 h-auto">
              <TabsTrigger value="overview" className="text-[11px] sm:text-xs py-2">Dashboard</TabsTrigger>
              <TabsTrigger value="users" className="text-[11px] sm:text-xs py-2">Users</TabsTrigger>
              <TabsTrigger value="transactions" className="text-[11px] sm:text-xs py-2">Txns</TabsTrigger>
              <TabsTrigger value="kyc" className="text-[11px] sm:text-xs py-2">KYC</TabsTrigger>
              <TabsTrigger value="audit" className="text-[11px] sm:text-xs py-2">Audit</TabsTrigger>
              <TabsTrigger value="support" className="text-[11px] sm:text-xs py-2">Support</TabsTrigger>
              <TabsTrigger value="settings" className="text-[11px] sm:text-xs py-2">Settings</TabsTrigger>
            </TabsList>

            {/* DASHBOARD */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={stats.totalUsers.toString()} />
                <StatCard icon={<ArrowDownToLine className="w-4 h-4" />} label="Deposits" value={stats.totalDeposits.toString()} />
                <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Conversions" value={stats.totalConversions.toString()} />
                <StatCard icon={<ArrowUpFromLine className="w-4 h-4" />} label="Withdrawals" value={stats.totalWithdrawals.toString()} />
              </div>

              {treasury && !treasury.error && (
                <Card className="glass-card border-border/50">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" /> Treasury (30d)
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetchTreasury}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                    </Button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-xs">
                    <KPIRow label="Fee revenue" value={`₦${Number(treasury.fee_revenue_30d || 0).toLocaleString()}`} />
                    <KPIRow label="Spread revenue" value={`₦${Number(treasury.spread_revenue_30d || 0).toLocaleString()}`} />
                    <KPIRow label="Deposits in" value={`₦${Number(treasury.deposits_30d || 0).toLocaleString()}`} />
                    <KPIRow label="Withdrawals out" value={`₦${Number(treasury.withdrawals_30d || 0).toLocaleString()}`} />
                    <KPIRow label="Total NGN held" value={`₦${Number(treasury.total_ngn_balance || 0).toLocaleString()}`} />
                    <KPIRow label="Verified users" value={`${treasury.verified_users ?? 0} / ${treasury.total_users ?? 0}`} />
                    <KPIRow label="Frozen accounts" value={`${treasury.frozen_users ?? 0}`} tone={Number(treasury.frozen_users) > 0 ? 'warn' : undefined} />
                    <KPIRow label="Pending ops" value={`${(treasury.pending_conversions ?? 0) + (treasury.pending_withdrawals ?? 0)}`} />
                  </CardContent>
                </Card>
              )}


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
                <Input placeholder="Search users by name, @username or wallet…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
              </div>
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-sm">All Users ({filteredUsers.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">User</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Wallet</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Joined</TableHead>
                            <TableHead className="text-xs text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((u: any) => (
                            <TableRow key={u.id}>
                              <TableCell className="py-2.5">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{u.display_name || 'Unnamed'}</p>
                                  {u.username && <p className="text-xs text-primary truncate">@{u.username}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell py-2.5">
                                {u.wallet_address ? (
                                  <p className="text-[11px] font-mono text-muted-foreground">
                                    {u.wallet_address.slice(0, 6)}…{u.wallet_address.slice(-4)}
                                  </p>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell py-2.5">
                                <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  {u.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
                                  {u.is_frozen && <Badge variant="destructive" className="text-[10px]">Frozen</Badge>}
                                  <Badge variant="outline" className="text-[10px]">KYC {u.kyc_tier}</Badge>
                                  {!u.is_admin && (
                                    <Button
                                      size="sm"
                                      variant={u.is_frozen ? 'outline' : 'destructive'}
                                      className="h-7 text-[10px] px-2"
                                      disabled={busyId === u.user_id}
                                      onClick={() => handleFreeze(u.user_id, !u.is_frozen)}
                                    >
                                      {busyId === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : u.is_frozen ? <><UserCheck className="w-3 h-3 mr-1" />Unfreeze</>
                                        : <><UserX className="w-3 h-3 mr-1" />Freeze</>}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TRANSACTIONS */}
            <TabsContent value="transactions" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Deposits ({deposits.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {deposits.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No deposits yet</p> : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Address</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Token</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Date</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deposits.slice(0, 50).map((d: any) => (
                            <TableRow key={d.id}>
                              <TableCell className="py-2 font-mono text-[11px]">{d.address?.slice(0, 8)}…{d.address?.slice(-4)}</TableCell>
                              <TableCell className="py-2 text-xs hidden sm:table-cell">{d.token}</TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="py-2 text-right font-mono text-xs">{d.amount || '—'}</TableCell>
                              <TableCell className="py-2 text-right"><Badge variant="outline" className="text-[10px]">{d.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Conversions ({conversions.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {conversions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No conversions yet</p> : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">From</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Date</TableHead>
                            <TableHead className="text-xs text-right">NGN</TableHead>
                            <TableHead className="text-xs text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conversions.slice(0, 50).map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="py-2 font-mono text-xs">{c.from_amount} {c.from_token}</TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="py-2 text-right font-mono text-xs">₦{Number(c.ngn_amount).toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-right"><Badge variant="outline" className="text-[10px]">{c.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Withdrawals ({withdrawals.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {withdrawals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No withdrawals yet</p> : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Bank</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Account</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Date</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs text-right">Status</TableHead>
                            <TableHead className="text-xs text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawals.slice(0, 50).map((w: any) => (
                            <TableRow key={w.id}>
                              <TableCell className="py-2 text-xs font-medium">{w.bank_name}</TableCell>
                              <TableCell className="py-2 font-mono text-[11px] text-muted-foreground hidden sm:table-cell">{maskAccount(w.account_number)}</TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="py-2 text-right font-mono text-xs">₦{Number(w.amount).toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Badge variant={w.status === 'SUCCESS' ? 'default' : w.status === 'FAILED' ? 'destructive' : 'outline'} className="text-[10px]">{w.status}</Badge>
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                {w.status === 'PROCESSING' ? (
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={busyId === w.id}
                                      onClick={() => handleResolveWithdrawal(w.id, true)}>
                                      <CheckCircle className="w-3 h-3 mr-1" />Paid
                                    </Button>
                                    <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" disabled={busyId === w.id}
                                      onClick={() => handleResolveWithdrawal(w.id, false)}>
                                      <XCircle className="w-3 h-3 mr-1" />Fail
                                    </Button>
                                  </div>
                                ) : <span className="text-[10px] text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* KYC */}
            <TabsContent value="kyc" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">KYC Submissions ({kycSubmissions.length})</CardTitle>
                  <CardDescription className="text-xs">Review and approve identity verification requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {kycSubmissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No KYC submissions</p>
                  ) : (
                    <div className="space-y-3">
                      {kycSubmissions.map((kyc: any) => (
                        <div key={kyc.id} className="p-3 rounded-lg bg-background/50 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{kyc.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{kyc.phone_number}</p>
                              <p className="text-[10px] text-muted-foreground">Submitted {new Date(kyc.created_at).toLocaleString()}</p>
                            </div>
                            <Badge variant={kyc.status === 'approved' ? 'default' : kyc.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                              {String(kyc.status).toUpperCase()}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Date of Birth</p>
                              <p className="font-medium">{kyc.date_of_birth || '—'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">ID Type</p>
                              <p className="font-medium">{kyc.id_type || '—'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-muted-foreground">ID Number</p>
                              <p className="font-mono font-medium break-all">{kyc.id_number || '—'}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => openSignedUrl('kyc-documents', kyc.document_url)}>
                              <FileText className="w-3 h-3" /> View ID Document
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => openSignedUrl('kyc-selfies', kyc.selfie_url)}>
                              <Camera className="w-3 h-3" /> View Selfie
                            </Button>
                          </div>

                          {kyc.status === 'rejected' && kyc.admin_note && (
                            <div className="p-2 rounded-md border border-destructive/20 bg-destructive/5">
                              <p className="text-[10px] font-medium text-destructive mb-0.5">Rejection note</p>
                              <p className="text-xs text-muted-foreground">{kyc.admin_note}</p>
                            </div>
                          )}

                          {kyc.status === 'pending' && (
                            rejectingId === kyc.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Reason for rejection (shown to user)…"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="text-xs min-h-[60px]"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" variant="destructive" className="flex-1 text-xs h-8" disabled={!rejectReason.trim()} onClick={async () => {
                                    await handleKYCAction(kyc.id, 'rejected', rejectReason);
                                    setRejectingId(null);
                                    setRejectReason('');
                                  }}>
                                    Confirm Reject
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8 text-success" onClick={() => handleKYCAction(kyc.id, 'approved')}>
                                  <CheckCircle className="w-3 h-3" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs h-8 text-destructive" onClick={() => { setRejectingId(kyc.id); setRejectReason(''); }}>
                                  <XCircle className="w-3 h-3" /> Reject
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SUPPORT CHAT */}
            {/* AUDIT */}
            <TabsContent value="audit" className="space-y-4 mt-4">
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Admin Audit Log</CardTitle>
                    <CardDescription className="text-xs">Last 100 administrative actions</CardDescription>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetchAuditLog}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {auditLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No actions logged yet</p>
                  ) : (
                    <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">When</TableHead>
                            <TableHead className="text-xs">Action</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Target</TableHead>
                            <TableHead className="text-xs">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLog.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                                {new Date(a.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                              </TableCell>
                              <TableCell className="py-2 hidden sm:table-cell">
                                <p className="text-[11px] font-mono text-muted-foreground">
                                  {a.target_kind || '—'}{a.target_user_id ? ` · ${String(a.target_user_id).slice(0, 8)}…` : ''}
                                </p>
                              </TableCell>
                              <TableCell className="py-2 text-[11px] text-muted-foreground max-w-[280px] truncate">
                                {a.details ? JSON.stringify(a.details) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="support" className="space-y-4 mt-4">
              <AdminSupportChat tickets={supportTickets} onRefresh={fetchData} />
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Deposit Recovery</CardTitle>
                  <CardDescription className="text-xs">Scan recent Base history and credit any missed deposits. Duplicates are skipped.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleSyncDeposits} disabled={syncingDeposits} className="w-full gap-2">
                    {syncingDeposits ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {syncingDeposits ? 'Syncing…' : 'Sync Deposits Now'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2">Auto-detection also runs every minute in the background.</p>

                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium">Recover specific transaction</p>
                    <Input
                      value={recoverTxHash}
                      onChange={(e) => setRecoverTxHash(e.target.value)}
                      placeholder="0x… Base tx hash"
                      className="text-xs font-mono"
                    />
                    <Button onClick={handleRecoverByTx} disabled={recovering || !recoverTxHash} variant="outline" className="w-full gap-2">
                      {recovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {recovering ? 'Recovering…' : 'Recover by Tx Hash'}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Parses Transfer logs and credits the matching user. Idempotent.</p>
                  </div>
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

const KPIRow = ({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) => (
  <div className="rounded-lg bg-background/50 p-2.5">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-sm font-semibold mt-0.5 ${tone === 'warn' ? 'text-warning' : ''}`}>{value}</p>
  </div>
);

export default Admin;
