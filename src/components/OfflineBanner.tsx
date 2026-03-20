import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineBanner() {
  const { isOnline, retry } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive/95 text-destructive-foreground px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-4 h-4 shrink-0" />
        <p className="text-sm font-medium truncate">No internet connection</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={retry}
        className="shrink-0 border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive-foreground/10 h-7 text-xs"
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Retry
      </Button>
    </div>
  );
}
