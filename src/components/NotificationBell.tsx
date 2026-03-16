import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative shrink-0"
      onClick={() => navigate('/notifications')}
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
