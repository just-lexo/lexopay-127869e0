import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/hooks/useNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wallet, Copy, Check, Loader2, Unlink } from 'lucide-react';

export const WalletLinking = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const walletAddress = profile?.wallet_address;

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Wallet address copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  const connectWallet = async () => {
    if (!user || !profile?.username) return;

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

      // Request signature
      const message = `Link this wallet to my LexoPay account: @${profile.username}`;
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      if (!signature) {
        toast({ title: 'Signature rejected', variant: 'destructive' });
        return;
      }

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({
          wallet_address: address,
          wallet_connected_at: new Date().toISOString(),
        } as any)
        .eq('user_id', user.id);

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast({
            title: 'Already linked',
            description: 'This wallet is already linked to another account.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'Wallet linked successfully.' });
      refreshProfile?.();
    } catch (err: any) {
      console.error('Wallet connect error:', err);
      if (err.code === 4001) {
        toast({ title: 'Connection rejected', variant: 'destructive' });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to link wallet. Try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    if (!user) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          wallet_address: null,
          wallet_connected_at: null,
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Wallet disconnected.' });
      setDisconnectOpen(false);
      refreshProfile?.();
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect wallet.', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 mb-3">
            <Wallet className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm font-medium">Wallet</p>
          </div>

          {walletAddress ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Connected</p>
                  <p className="font-mono text-sm text-primary">
                    {shortenAddress(walletAddress)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyAddress}>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full min-h-[44px] gap-2 text-destructive hover:text-destructive"
                onClick={() => setDisconnectOpen(true)}
              >
                <Unlink className="w-4 h-4" />
                Disconnect Wallet
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Link a wallet to prepare your account for future Base Mini App support.
              </p>
              <Button
                variant="outline"
                className="w-full min-h-[44px] gap-2"
                onClick={connectWallet}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                To connect a wallet on mobile, open LexoPay inside your wallet's built-in browser or use a desktop browser with a wallet extension.
              </p>
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Learn more
                </summary>
                <div className="text-xs text-muted-foreground mt-2 space-y-1 pl-1">
                  <p>Most mobile browsers (Chrome/Safari) do not allow wallet connections directly.</p>
                  <p>You can connect by:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Opening this site in your wallet app's browser (MetaMask, Trust Wallet, Coinbase Wallet)</li>
                    <li>Or using a desktop browser with a wallet extension</li>
                  </ul>
                </div>
              </details>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className="glass-card max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the linked wallet from your LexoPay account. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={disconnectWallet}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
