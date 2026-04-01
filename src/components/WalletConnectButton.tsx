import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2 } from 'lucide-react';

interface WalletConnectButtonProps {
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  label?: string;
}

export const WalletConnectButton = ({
  onSuccess,
  variant = 'outline',
  className = '',
  label = 'Connect Wallet',
}: WalletConnectButtonProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast({
        title: 'No wallet found',
        description: 'Please install MetaMask or a compatible wallet.',
        variant: 'destructive',
      });
      return;
    }

    setConnecting(true);
    try {
      // Request accounts
      const accounts: string[] = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        toast({ title: 'Connection cancelled', variant: 'destructive' });
        return;
      }

      const address = accounts[0];

      // Request signature for authentication
      const message = `Sign in to LexoPay with wallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      if (!signature) {
        toast({ title: 'Signature rejected', variant: 'destructive' });
        return;
      }

      // Call wallet-auth edge function
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/wallet-auth`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ address, signature, message }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Set the session from the response
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        toast({
          title: data.isNewUser ? 'Welcome to LexoPay!' : 'Welcome back!',
          description: data.isNewUser
            ? 'Your wallet account has been created.'
            : 'Signed in with wallet.',
        });

        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Wallet connect error:', err);
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

  return (
    <Button
      variant={variant}
      className={`w-full min-h-[48px] gap-2 ${className}`}
      onClick={connectWallet}
      disabled={connecting}
    >
      {connecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Wallet className="w-4 h-4" />
          {label}
        </>
      )}
    </Button>
  );
};
