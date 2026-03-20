import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAllowlist } from '@/hooks/useAllowlist';
import { AllowlistBlockScreen } from '@/components/AllowlistBlockScreen';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireProfile?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireProfile = true, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { isAllowed, loading: allowlistLoading } = useAllowlist();

  // Auth loading is handled by SplashScreen in App.tsx — no flash
  if (authLoading) {
    return null;
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If profile with username is required but not set, redirect to auth for profile setup
  if (requireProfile && !profile?.username) {
    return <Navigate to="/auth" replace />;
  }

  // Check admin requirement
  if (requireAdmin && profile?.is_admin !== true) {
    return <Navigate to="/dashboard" replace />;
  }

  // Still loading allowlist
  if (allowlistLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check allowlist - admins bypass allowlist check
  if (profile?.is_admin !== true && isAllowed === false) {
    return <AllowlistBlockScreen />;
  }

  return <>{children}</>;
}
