import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  kyc_tier: number;
  is_admin: boolean;
  wallet_address: string | null;
  onboarding_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  emailConfirmed: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<Profile, 'username' | 'display_name' | 'onboarding_completed'>>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  resendVerificationEmail: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const emailConfirmed = !!user?.email_confirmed_at;

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const ensureProfile = useCallback(async (userId: string) => {
    // Try to fetch first
    let profileData = await fetchProfile(userId);
    if (profileData) return profileData;

    // Profile doesn't exist — create it (fail-safe)
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ user_id: userId, onboarding_completed: false })
      .select()
      .maybeSingle();

    if (insertError) {
      // Could be duplicate — try fetching again
      console.warn('Profile insert error (may be duplicate):', insertError.message);
      profileData = await fetchProfile(userId);
      return profileData;
    }

    // Fetch again after insert
    return await fetchProfile(userId);
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await ensureProfile(user.id);
      setProfile(profileData);
    }
  }, [user, ensureProfile]);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] State change:', event, 'uid:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            ensureProfile(session.user.id).then(p => {
              console.log('[Auth] Profile loaded:', { id: p?.id, onboarding: p?.onboarding_completed, emailConfirmed: !!session.user.email_confirmed_at });
              setProfile(p);
            });
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        ensureProfile(session.user.id).then(p => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [ensureProfile]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Pick<Profile, 'username' | 'display_name' | 'onboarding_completed'>>) => {
    if (!user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      await refreshProfile();
    }

    return { error: error as Error | null };
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) {
      return { error: new Error('No email found') };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`
      }
    });

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      emailConfirmed,
      signUp,
      signIn,
      signOut,
      updateProfile,
      refreshProfile,
      resendVerificationEmail,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
