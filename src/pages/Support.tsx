import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Loader2, MessageCircle, Plus, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'open': return <Badge variant="secondary" className="text-[10px]">Open</Badge>;
    case 'in_progress': return <Badge className="bg-warning/20 text-warning text-[10px]">In Progress</Badge>;
    case 'resolved': return <Badge className="bg-success/20 text-success text-[10px]">Resolved</Badge>;
    case 'closed': return <Badge variant="outline" className="text-[10px]">Closed</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user!.id,
        subject: subject.trim(),
        message: message.trim(),
      } as any);
      if (error) throw error;
      toast({ title: 'Ticket submitted', description: 'We\'ll get back to you soon.' });
      setSubject('');
      setMessage('');
      setShowForm(false);
      fetchTickets();
    } catch {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-semibold text-base flex-1">Support</h1>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-3.5 h-3.5" /> New Ticket
          </Button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {showForm && (
          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Submit a Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Input placeholder="Brief description" value={subject} onChange={e => setSubject(e.target.value)} className="min-h-[44px]" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message</Label>
                  <Textarea placeholder="Describe your issue..." value={message} onChange={e => setMessage(e.target.value)} className="min-h-[100px]" maxLength={1000} />
                </div>
                <Button type="submit" className="w-full min-h-[44px] gradient-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Ticket'}
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
              <p className="text-sm text-muted-foreground">No support tickets yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create one if you need help</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map(ticket => (
              <Card key={ticket.id} className="glass-card border-border/50">
                <CardContent className="py-3 px-3">
                  <button className="w-full text-left" onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {statusBadge(ticket.status)}
                        {expanded === ticket.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>
                  {expanded === ticket.id && (
                    <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Your Message</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.message}</p>
                      </div>
                      {ticket.admin_reply && (
                        <div className="bg-primary/5 rounded-lg p-3">
                          <p className="text-[10px] uppercase text-primary font-medium mb-1">Support Reply</p>
                          <p className="text-sm whitespace-pre-wrap">{ticket.admin_reply}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Support;
