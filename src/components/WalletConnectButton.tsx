import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useSignMessage } from 'wagmi';

interface WalletConnectButtonProps {
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  label?: string;
  linkMode?: boolean;
}

export const WalletConnectButton = ({
  onSuccess,
  variant = 'outline',
  className = '',
  label = 'Connect Wallet',
  linkMode = false,
}: WalletConnectButtonProps) => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();

  const authenticateWallet = async (walletAddress: string) => {
    setConnecting(true);
    try {
      const message = `Sign in to LexoPay with wallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message, account: walletAddress as `0x${string}` });

      if (!signature) {
        toast({ title: 'Signature rejected', variant: 'destructive' });
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/wallet-auth`;

      const body: Record<string, string> = { address: walletAddress, signature, message };
      if (linkMode && user) {
        body.linkToSession = user.id;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.linked) {
        await refreshProfile();
        toast({ title: 'Wallet linked!', description: 'Your wallet has been connected to your account.' });
        onSuccess?.();
        return;
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        toast({
          title: data.isNewUser ? 'Welcome to LexoPay!' : 'Welcome back!',
          description: data.isNewUser ? 'Please complete your profile setup.' : 'Signed in with wallet.',
        });

        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Wallet auth error:', err);
      if (err.code === 4001) {
        toast({ title: 'Connection rejected', variant: 'destructive' });
      } else {
        toast({
          title: 'Connection failed',
          description: err.message || 'Failed to connect wallet. Try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleClick = async () => {
    if (isConnected && address) {
      await authenticateWallet(address);
    } else {
      try {
        await open();
        // The user will connect via the modal, then we need to authenticate
        // We'll handle this in an effect or the user clicks again
      } catch {
        toast({ title: 'Connection cancelled', variant: 'destructive' });
      }
    }
  };

  // If wallet just connected, auto-authenticate
  const handleConnectedAuth = async () => {
    if (isConnected && address && !connecting) {
      await authenticateWallet(address);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        className={`w-full min-h-[48px] gap-2 ${className}`}
        onClick={isConnected && address ? handleConnectedAuth : handleClick}
        disabled={connecting}
      >
        {connecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            {isConnected && address
              ? `Sign in as ${address.slice(0, 6)}...${address.slice(-4)}`
              : label}
          </>
        )}
      </Button>
    </div>
  );
};
