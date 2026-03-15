import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, UserX } from 'lucide-react';

interface PublicProfileData {
  username: string;
  display_name: string | null;
}

const PublicProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Extract username from path like /@prosper
  const cleanUsername = location.pathname.replace(/^\/@/, '').trim().toLowerCase();

  useEffect(() => {
    if (!cleanUsername) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase.rpc('lookup_public_profile' as any, {
        _username: cleanUsername,
      });

      if (error || !data || (data as any[]).length === 0) {
        setNotFound(true);
      } else {
        setProfileData((data as PublicProfileData[])[0]);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [cleanUsername]);

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return cleanUsername?.charAt(0).toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleSendPayment = () => {
    if (user) {
      navigate(`/send?to=${cleanUsername}`);
    } else {
      navigate(`/auth?redirect=/send?to=${cleanUsername}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="glass-card border-border/50 max-w-sm w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <UserX className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">User not found</h2>
              <p className="text-sm text-muted-foreground mt-1">
                @{cleanUsername} doesn't exist on LexoPay.
              </p>
            </div>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="glass-card border-border/50 max-w-sm w-full">
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {getInitials(profileData?.display_name)}
              </AvatarFallback>
            </Avatar>

            {profileData?.display_name && (
              <h2 className="text-lg font-semibold">{profileData.display_name}</h2>
            )}

            <p className="text-primary font-mono text-base">@{profileData?.username}</p>

            <p className="text-xs text-muted-foreground">LexoPay user</p>

            <Button
              className="w-full min-h-[48px] gradient-primary hover:opacity-90 mt-4 gap-2"
              onClick={handleSendPayment}
            >
              <Send className="w-4 h-4" />
              Send Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicProfile;
