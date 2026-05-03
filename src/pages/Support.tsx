import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, MessageCircle, Plus, Send as SendIcon, ChevronLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  message: string;
  created_at: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-primary/15 text-primary' },
    in_progress: { label: 'In progress', cls: 'bg-warning/15 text-warning' },
    resolved: { label: 'Resolved', cls: 'bg-success/15 text-success' },
    closed: { label: 'Closed', cls: 'bg-muted text-muted-foreground' },
  };
  const v = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <Badge className={`${v.cls} text-[10px] border-0`}>{v.label}</Badge>;
};

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  // Load messages when ticket selected + subscribe realtime
  useEffect(() => {
    if (!activeTicket) return;
    let cancelled = false;

    const load = async () => {
      setLoadingMsgs(true);
      const { data } = await supabase
        .from('support_messages' as any)
        .select('*')
        .eq('ticket_id', activeTicket.id)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages((data as unknown as Message[]) || []);
        setLoadingMsgs(false);
      }
    };
    load();

    const channel = supabase
      .channel(`ticket-${activeTicket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some(p => p.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeTicket]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !firstMessage.trim() || !user) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({ user_id: user.id, subject: subject.trim(), message: firstMessage.trim() } as any)
        .select()
        .single();
      if (error) throw error;
      // Insert first message
      await supabase.from('support_messages' as any).insert({
        ticket_id: (ticket as any).id,
        sender_id: user.id,
        sender_role: 'user',
        message: firstMessage.trim(),
      } as any);
      toast({ title: 'Conversation started' });
      setSubject('');
      setFirstMessage('');
      setShowForm(false);
      await fetchTickets();
      setActiveTicket(ticket as any);
    } catch {
      toast({ title: 'Failed to start conversation', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!draft.trim() || !user || !activeTicket || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    // Optimistic
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      ticket_id: activeTicket.id,
      sender_id: user.id,
      sender_role: 'user',
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const { error } = await supabase.from('support_messages' as any).insert({
      ticket_id: activeTicket.id,
      sender_id: user.id,
      sender_role: 'user',
      message: text,
    } as any);
    if (error) {
      setMessages((prev) => prev.filter(m => m.id !== optimistic.id));
      toast({ title: 'Failed to send', variant: 'destructive' });
      setDraft(text);
    }
    setSending(false);
  };

  // Chat view
  if (activeTicket) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="glass-card border-b border-border/50 sticky top-0 z-50">
          <div className="container max-w-lg mx-auto px-3 py-3 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setActiveTicket(null)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{activeTicket.subject}</p>
              <p className="text-[10px] text-muted-foreground">Support chat</p>
            </div>
            {statusBadge(activeTicket.status)}
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto container max-w-lg mx-auto px-3 py-4 space-y-2">
          {loadingMsgs ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-8">No messages yet</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_role === 'user';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                    {!mine && <p className="text-[10px] uppercase font-semibold opacity-70 mb-0.5">Support</p>}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </main>

        <div className="sticky bottom-0 border-t border-border/50 bg-background p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="container max-w-lg mx-auto flex gap-2 items-end">
            <Textarea
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0 gradient-primary"
              onClick={handleSendMessage}
              disabled={!draft.trim() || sending}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Conversations list
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-semibold text-base flex-1">Support</h1>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {showForm && (
          <Card className="glass-card border-primary/20">
            <CardContent className="pt-4">
              <form onSubmit={handleCreateTicket} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input placeholder="Brief description" value={subject} onChange={e => setSubject(e.target.value)} className="min-h-[44px]" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your message</Label>
                  <Textarea placeholder="How can we help?" value={firstMessage} onChange={e => setFirstMessage(e.target.value)} className="min-h-[90px]" maxLength={1000} />
                </div>
                <Button type="submit" className="w-full min-h-[44px] gradient-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start conversation'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="py-10 text-center">
              <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Tap "New" to chat with support</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="w-full text-left"
              >
                <Card className="glass-card border-border/50 hover:border-primary/40 transition-colors">
                  <CardContent className="py-3 px-3 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{t.subject}</p>
                        {statusBadge(t.status)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Support;
