import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProfile?: boolean;
  requireAdmin?: boolean;
  requirePin?: boolean;
}

export function ProtectedRoute({ children, requireProfile = true, requireAdmin = false, requirePin = true }: ProtectedRouteProps) {
  const { user, profile, loading: authLoading, emailConfirmed } = useAuth();
  const location = useLocation();
  const [pinChecked, setPinChecked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setPinChecked(true); return; }
      const { data } = await supabase
        .from('profiles')
        .select('pin_set_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      setHasPin(!!(data as any)?.pin_set_at);
      setPinChecked(true);
    })();
    return () => { active = false; };
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!emailConfirmed) return <Navigate to="/auth" replace />;
  if (requireProfile && profile && !profile.onboarding_completed) {
    return <Navigate to="/auth?step=setup" replace />;
  }
  if (requireProfile && !profile?.username) {
    return <Navigate to="/auth?step=setup" replace />;
  }

  // Compulsory PIN — gate everything except the /pin route itself
  if (requirePin && pinChecked && !hasPin && location.pathname !== '/pin') {
    return <Navigate to="/pin?required=1" replace />;
  }

  if (requireAdmin && profile?.is_admin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
