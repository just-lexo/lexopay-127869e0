import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send as SendIcon, MessageCircle, CheckCircle, ChevronLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Ticket {
  id: string;
  user_id: string;
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
  const map: Record<string, string> = {
    open: 'bg-primary/15 text-primary',
    in_progress: 'bg-warning/15 text-warning',
    resolved: 'bg-success/15 text-success',
    closed: 'bg-muted text-muted-foreground',
  };
  return <Badge className={`${map[status] || 'bg-muted'} text-[10px] border-0`}>{status.replace('_', ' ')}</Badge>;
};

export function AdminSupportChat({ tickets, onRefresh }: { tickets: Ticket[]; onRefresh: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('support_messages' as any)
        .select('*')
        .eq('ticket_id', active.id)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages((data as unknown as Message[]) || []);
        setLoading(false);
      }
    })();
    const channel = supabase
      .channel(`admin-ticket-${active.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${active.id}` },
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
  }, [active]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !active || !user || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, ticket_id: active.id, sender_id: user.id,
      sender_role: 'admin', message: text, created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    const { error } = await supabase.from('support_messages' as any).insert({
      ticket_id: active.id, sender_id: user.id, sender_role: 'admin', message: text,
    } as any);
    if (error) {
      setMessages((p) => p.filter(m => m.id !== optimistic.id));
      setDraft(text);
      toast({ title: 'Failed to send', variant: 'destructive' });
    } else {
      // Mark as in_progress if open
      if (active.status === 'open') {
        await supabase.from('support_tickets').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', active.id);
        onRefresh();
      }
    }
    setSending(false);
  };

  const setStatus = async (status: 'resolved' | 'closed' | 'open') => {
    if (!active) return;
    const { error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', active.id);
    if (error) { toast({ title: 'Update failed', variant: 'destructive' }); return; }
    toast({ title: `Marked ${status}` });
    setActive({ ...active, status });
    onRefresh();
  };

  if (active) {
    return (
      <Card className="glass-card border-border/50">
        <div className="border-b border-border/50 p-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActive(null)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{active.subject}</p>
            <p className="text-[10px] text-muted-foreground truncate">User {active.user_id.slice(0, 8)}…</p>
          </div>
          {statusBadge(active.status)}
          {active.status !== 'resolved' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStatus('resolved')}>
              <CheckCircle className="w-3 h-3" /> Resolve
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="h-[420px] overflow-y-auto p-3 space-y-2 bg-background/30">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-8">No messages</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_role === 'admin';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                    <p className="text-[10px] uppercase font-semibold opacity-70 mb-0.5">{mine ? 'You (admin)' : 'User'}</p>
                    <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border/50 p-3 flex gap-2 items-end">
          <Textarea
            placeholder="Reply to user…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button size="icon" className="h-11 w-11 shrink-0 gradient-primary" onClick={send} disabled={!draft.trim() || sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          <p className="text-sm font-semibold">Conversations ({tickets.length})</p>
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tickets yet</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => setActive(t)} className="w-full text-left p-3 rounded-lg bg-background/50 hover:bg-background/70 border border-border/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  {statusBadge(t.status)}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
