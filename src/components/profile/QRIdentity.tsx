import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check, Share2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const QRIdentity = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const username = profile?.username;
  const profileUrl = `https://lexopay.lovable.app/@${username}`;

  const copyId = async () => {
    if (!username) return;
    await navigator.clipboard.writeText(`@${username}`);
    setCopiedId(true);
    toast({ title: 'Copied!', description: 'LexoPay ID copied' });
    setTimeout(() => setCopiedId(false), 2000);
  };

  const shareLink = async () => {
    if (!username) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LexoPay', text: `Pay me on LexoPay`, url: profileUrl });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        toast({ title: 'Link copied!', description: 'Profile link copied to clipboard' });
      }
    } catch {
      // User cancelled share
    }
  };

  if (!username) return null;

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Your LexoPay ID</p>
          </div>

          <p className="font-mono text-primary text-base mb-3">@{username}</p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={copyId}>
              {copiedId ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={shareLink}>
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setQrOpen(true)}>
              <QrCode className="w-3.5 h-3.5" />
              QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="glass-card max-w-[90vw] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Your LexoPay QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG
                value={profileUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-primary text-base">@{username}</p>
            <p className="text-xs text-muted-foreground text-center">
              Anyone can scan this to open your LexoPay page.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
