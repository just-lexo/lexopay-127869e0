import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  MessageSquare,
  Bug,
  Lightbulb,
  CircleDot,
  Check,
  Circle
} from 'lucide-react';

interface FeedbackEntry {
  id: string;
  user_id: string;
  category: 'BUG' | 'IDEA' | 'OTHER';
  message: string;
  page: string | null;
  created_at: string;
  is_read: boolean;
  profile?: {
    username: string | null;
    display_name: string | null;
  };
}

const AdminFeedback = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BUG' | 'IDEA' | 'OTHER'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchFeedback();
  }, [isAdmin, navigate]);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for usernames
      const userIds = [...new Set((data || []).map(f => f.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const enriched = (data || []).map(f => ({
        ...f,
        profile: profileMap.get(f.user_id),
      })) as FeedbackEntry[];

      setFeedback(enriched);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      toast({
        title: 'Error',
        description: 'Failed to load feedback.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRead = async (entry: FeedbackEntry) => {
    setUpdatingId(entry.id);
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ is_read: !entry.is_read })
        .eq('id', entry.id);

      if (error) throw error;

      setFeedback(prev => 
        prev.map(f => f.id === entry.id ? { ...f, is_read: !f.is_read } : f)
      );
    } catch (err) {
      console.error('Error updating feedback:', err);
      toast({
        title: 'Error',
        description: 'Failed to update.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'BUG': return <Bug className="w-3.5 h-3.5" />;
      case 'IDEA': return <Lightbulb className="w-3.5 h-3.5" />;
      default: return <CircleDot className="w-3.5 h-3.5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'BUG': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'IDEA': return 'bg-primary/20 text-primary border-primary/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const filteredFeedback = filter === 'ALL' 
    ? feedback 
    : feedback.filter(f => f.category === filter);

  const unreadCount = feedback.filter(f => !f.is_read).length;

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />
      
      {/* Header */}
      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/admin')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Feedback Inbox
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All ({feedback.length})</SelectItem>
              <SelectItem value="BUG">Bug ({feedback.filter(f => f.category === 'BUG').length})</SelectItem>
              <SelectItem value="IDEA">Idea ({feedback.filter(f => f.category === 'IDEA').length})</SelectItem>
              <SelectItem value="OTHER">Other ({feedback.filter(f => f.category === 'OTHER').length})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredFeedback.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'ALL' ? 'No feedback yet.' : `No ${filter.toLowerCase()} feedback.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredFeedback.map((entry) => (
              <Card 
                key={entry.id} 
                className={`glass-card border-border/50 ${!entry.is_read ? 'border-l-2 border-l-primary' : ''}`}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] gap-1 ${getCategoryColor(entry.category)}`}
                      >
                        {getCategoryIcon(entry.category)}
                        {entry.category}
                      </Badge>
                      <span className="text-xs text-primary font-mono">
                        @{entry.profile?.username || 'unknown'}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Message */}
                  <p className="text-sm whitespace-pre-wrap">{entry.message}</p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    {entry.page && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                        Page: {entry.page}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 ml-auto"
                      onClick={() => toggleRead(entry)}
                      disabled={updatingId === entry.id}
                    >
                      {updatingId === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : entry.is_read ? (
                        <>
                          <Circle className="w-3 h-3" />
                          Mark unread
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          Mark read
                        </>
                      )}
                    </Button>
                  </div>
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

export default AdminFeedback;
