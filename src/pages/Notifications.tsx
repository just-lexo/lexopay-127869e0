import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Bell, CheckCheck, ChevronDown } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (notif: typeof notifications[0]) => {
    if (!notif.is_read) markAsRead(notif.id);
    setExpandedId(expandedId === notif.id ? null : notif.id);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="font-semibold text-base">Notifications</h1>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={markAllAsRead}>
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="glass-card border-border/50">
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => {
              const isExpanded = expandedId === notif.id;
              return (
                <Collapsible key={notif.id} open={isExpanded} onOpenChange={() => handleToggle(notif)}>
                  <Card className={`glass-card border-border/50 transition-colors ${!notif.is_read ? 'border-l-2 border-l-primary' : ''}`}>
                    <CollapsibleTrigger asChild>
                      <CardContent className="py-3 px-3 cursor-pointer">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.is_read ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>
                              {notif.title}
                            </p>
                            {!isExpanded && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.message}</p>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pl-8">
                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {format(new Date(notif.created_at), 'PPp')}
                        </p>
                        {notif.related_id && notif.related_kind === 'transaction' && (
                          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => navigate(`/transactions/${notif.related_id}`)}>
                            View transaction →
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Notifications;
