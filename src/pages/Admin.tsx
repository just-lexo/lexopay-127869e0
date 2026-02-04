import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestModeBanner } from '@/components/TestModeBanner';
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
  MessageSquare
} from 'lucide-react';

type AllowlistType = 'EMAIL' | 'USERNAME';

interface AllowlistEntry {
  id: string;
  identifier: string;
  type: AllowlistType;
  is_active: boolean;
  created_at: string;
}

interface FeedbackEntry {
  id: string;
  user_id: string;
  category: string;
  message: string;
  page: string | null;
  created_at: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingEntry, setAddingEntry] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seedBalance, setSeedBalance] = useState(false);

  // New entry form
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newType, setNewType] = useState<AllowlistType>('EMAIL');

  // Check if user is admin
  const isAdmin = profile?.is_admin === true;

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
      // Fetch allowlist
      const { data: allowlistData, error: allowlistError } = await supabase
        .from('allowlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (allowlistError) throw allowlistError;
      setAllowlist(allowlistData || []);

      // Fetch feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (feedbackError) throw feedbackError;
      setFeedback(feedbackData || []);
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
    try {
      const { error } = await supabase
        .from('allowlist')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      toast({
        title: 'Entry deleted',
      });

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
      const { data, error } = await supabase.rpc('reset_demo_data', {
        _seed_balance: seedBalance,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Reset failed');
      }

      toast({
        title: 'Demo data reset',
        description: seedBalance 
          ? 'Balances reset and 100 USDT seeded.' 
          : 'All balances and transactions cleared.',
      });
    } catch (err: any) {
      console.error('Error resetting demo data:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to reset demo data.',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TestModeBanner />
      
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
                    {allowlist.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-background/50"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge variant={entry.type === 'EMAIL' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {entry.type}
                          </Badge>
                          <span className="text-xs font-mono truncate">{entry.identifier}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Switch
                            checked={entry.is_active}
                            onCheckedChange={() => handleToggleActive(entry)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteEntry(entry)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Demo Reset */}
            <Card className="glass-card border-warning/30 bg-warning/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Reset Demo Data
                </CardTitle>
                <CardDescription>
                  Clear your balances, transactions, deposits, conversions, and withdrawals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div>
                    <p className="text-sm font-medium">Seed demo balance</p>
                    <p className="text-xs text-muted-foreground">Credit 100 USDT after reset</p>
                  </div>
                  <Switch checked={seedBalance} onCheckedChange={setSeedBalance} />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full border-warning text-warning hover:bg-warning/10">
                      Reset Demo Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Demo Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will clear all your balances, transactions, deposits, conversions, and withdrawals.
                        {seedBalance && ' 100 USDT will be credited after reset.'}
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDemoData}
                        className="bg-warning text-warning-foreground hover:bg-warning/90"
                        disabled={resetting}
                      >
                        {resetting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Reset'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card className="glass-card border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Recent Feedback ({feedback.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedback.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No feedback yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {feedback.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-background/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {entry.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{entry.message}</p>
                        {entry.page && (
                          <p className="text-xs text-muted-foreground">
                            Page: {entry.page}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;
