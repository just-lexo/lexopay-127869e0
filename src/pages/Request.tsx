import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/hooks/useNotifications';
import { TestModeBanner } from '@/components/TestModeBanner';
import { TransactionGate, useTransactionGate } from '@/components/TransactionGate';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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
  Check,
  AlertCircle,
  User,
  HandCoins,
} from 'lucide-react';

interface RecipientProfile {
  user_id: string;
  username: string;
  display_name: string | null;
}

const EXPIRY_OPTIONS = [
  { value: '24h', label: '24 hours', hours: 24 },
  { value: '3d', label: '3 days', hours: 72 },
  { value: '7d', label: '7 days', hours: 168 },
];

const ASSET_OPTIONS = ['NGN', 'USDT'];

const Request = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { allowed: gateAllowed } = useTransactionGate();

  const [recipientUsername, setRecipientUsername] = useState('');
  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState('NGN');
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState('24h');
  const [loading, setLoading] = useState(false);

  const normalizeUsername = (input: string): string =>
    input.replace('@', '').trim().toLowerCase();

  const handleSearchRecipient = async () => {
    const cleanUsername = normalizeUsername(recipientUsername);
    if (!cleanUsername) {
      setRecipientError('Please enter a valid @username');
      setRecipient(null);
      return;
    }
    if (profile?.username && cleanUsername === normalizeUsername(profile.username)) {
      setRecipientError("You can't request from yourself");
      setRecipient(null);
      return;
    }

    setIsSearching(true);
    setRecipientError(null);
    try {
      const { data, error } = await supabase.rpc('lookup_username', { _username: cleanUsername });
      if (error) {
        setRecipientError('Failed to search for user');
        setRecipient(null);
        return;
      }
      const results = data as RecipientProfile[] | null;
      if (!results || results.length === 0) {
        setRecipientError(`User @${cleanUsername} not found`);
        setRecipient(null);
      } else {
        setRecipient(results[0]);
        setRecipientError(null);
      }
    } catch {
      setRecipientError('Failed to search for user');
      setRecipient(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !recipient) return;
    if (!gateAllowed) {
      toast({ title: 'Action blocked', description: 'Verify your email and complete KYC to send requests.', variant: 'destructive' });
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }

    const expiryHours = EXPIRY_OPTIONS.find(e => e.value === expiry)?.hours ?? 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

    setLoading(true);
    try {
      const { error } = await supabase.from('payment_requests').insert({
        requester_id: user.id,
        recipient_id: recipient.user_id,
        asset,
        amount: numAmount,
        note: note.trim() || null,
        expires_at: expiresAt,
        requester_username: profile?.username || null,
        recipient_username: recipient.username,
      } as any);

      if (error) throw error;

      toast({
        title: 'Request sent!',
        description: `Payment request sent to @${recipient.username}`,
      });

      // Notify the recipient
      await createNotification({
        userId: recipient.user_id,
        type: 'payment_request_received',
        title: 'Payment Request',
        message: `@${profile?.username} requested ${asset === 'NGN' ? '₦' : ''}${numAmount.toLocaleString()}${asset !== 'NGN' ? ' ' + asset : ''} from you.`,
      });

      navigate('/dashboard');
    } catch (err) {
      console.error('Error creating request:', err);
      toast({ title: 'Error', description: 'Failed to send request.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = recipient && parseFloat(amount) > 0 && gateAllowed;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />

      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-base">Request Payment</h1>
              <p className="text-xs text-muted-foreground">Ask someone to pay you</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <TransactionGate feature="payment requests" />
        {/* Recipient */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              From
            </CardTitle>
            <CardDescription>Who should pay you?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="@username"
                value={recipientUsername}
                onChange={(e) => {
                  setRecipientUsername(e.target.value);
                  setRecipient(null);
                  setRecipientError(null);
                }}
              />
              <Button variant="outline" onClick={handleSearchRecipient} disabled={!recipientUsername.trim() || isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
              </Button>
            </div>
            {recipientError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm text-destructive">{recipientError}</p>
              </div>
            )}
            {recipient && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <User className="w-4 h-4 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-success">@{recipient.username}</p>
                  <p className="text-xs text-muted-foreground">{recipient.display_name || 'LexoPay User'}</p>
                </div>
                <Check className="w-4 h-4 text-success" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amount & Asset */}
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="w-4 h-4" />
              Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_OPTIONS.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Note & Expiry */}
        <Card className="glass-card border-border/50">
          <CardContent className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="What is this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full min-h-[48px] gradient-primary hover:opacity-90"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <>
              <HandCoins className="w-4 h-4 mr-2" />
              Send Request
            </>
          )}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Request;
