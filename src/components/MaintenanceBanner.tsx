import { AlertTriangle } from 'lucide-react';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';

export function MaintenanceBanner() {
  const { maintenance, loading } = useMaintenanceMode();

  if (loading || !maintenance) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2.5 text-center">
      <p className="text-xs text-warning font-medium flex items-center justify-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        LexoPay is currently under maintenance. Financial actions are temporarily disabled.
      </p>
    </div>
  );
}
