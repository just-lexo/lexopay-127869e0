import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useAllowlist() {
  const { user, profile, loading: authLoading } = useAuth();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAllowlist = async () => {
      if (authLoading) return;
      
      if (!user) {
        setIsAllowed(null);
        setLoading(false);
        return;
      }

      // If profile is still loading or username not set yet
      if (!profile?.username) {
        setIsAllowed(null);
        setLoading(false);
        return;
      }

      try {
        const email = user.email?.toLowerCase() || '';
        const username = profile.username.toLowerCase();

        // Check if email OR username is in allowlist
        const { data, error } = await supabase
          .from('allowlist')
          .select('*')
          .or(`identifier.eq.${email},identifier.eq.${username}`)
          .eq('is_active', true);

        if (error) {
          console.error('Allowlist check error:', error);
          setIsAllowed(false);
        } else {
          setIsAllowed(data && data.length > 0);
        }
      } catch (err) {
        console.error('Allowlist check failed:', err);
        setIsAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    checkAllowlist();
  }, [user, profile, authLoading]);

  return { isAllowed, loading: loading || authLoading };
}
