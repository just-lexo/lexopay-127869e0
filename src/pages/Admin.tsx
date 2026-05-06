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
            <TabsList className="w-full grid grid-cols-6 h-auto">
              <TabsTrigger value="overview" className="text-[11px] sm:text-xs py-2">Dashboard</TabsTrigger>
              <TabsTrigger value="users" className="text-[11px] sm:text-xs py-2">Users</TabsTrigger>
              <TabsTrigger value="transactions" className="text-[11px] sm:text-xs py-2">Txns</TabsTrigger>
              <TabsTrigger value="kyc" className="text-[11px] sm:text-xs py-2">KYC</TabsTrigger>
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
                                  <Badge variant="outline" className="text-[10px]">KYC {u.kyc_tier}</Badge>
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawals.slice(0, 50).map((w: any) => (
                            <TableRow key={w.id}>
                              <TableCell className="py-2 text-xs font-medium">{w.bank_name}</TableCell>
                              <TableCell className="py-2 font-mono text-[11px] text-muted-foreground hidden sm:table-cell">{maskAccount(w.account_number)}</TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="py-2 text-right font-mono text-xs">₦{Number(w.amount).toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-right"><Badge variant="outline" className="text-[10px]">{w.status}</Badge></TableCell>
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
