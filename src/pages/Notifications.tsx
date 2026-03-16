import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { TestModeBanner } from '@/components/TestModeBanner';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = (notif: typeof notifications[0]) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.related_id && notif.related_kind === 'transaction') {
      navigate(`/transactions/${notif.related_id}`);
    } else if (notif.related_id && notif.related_kind === 'payment_request') {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <TestModeBanner />

      <header className="glass-card border-b border-border/50 sticky top-[33px] z-50">
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
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
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
            {notifications.map(notif => (
              <Card
                key={notif.id}
                className={`glass-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors ${
                  !notif.is_read ? 'border-l-2 border-l-primary' : ''
                }`}
                onClick={() => handleClick(notif)}
              >
                <CardContent className="py-3 px-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      notif.is_read ? 'bg-muted-foreground/30' : 'bg-primary'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
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

export default Notifications;
