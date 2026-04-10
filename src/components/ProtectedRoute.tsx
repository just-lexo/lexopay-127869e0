import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProfile?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireProfile = true, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If onboarding not completed, redirect to profile setup
  if (requireProfile && profile && !profile.onboarding_completed) {
    return <Navigate to="/auth?step=setup" replace />;
  }

  // If profile with username is required but not set
  if (requireProfile && !profile?.username) {
    return <Navigate to="/auth?step=setup" replace />;
  }

  if (requireAdmin && profile?.is_admin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
