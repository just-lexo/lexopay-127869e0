import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ScanFace } from 'lucide-react';

interface FaceVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export const FaceVerificationModal = ({ open, onOpenChange, onVerified }: FaceVerificationModalProps) => {
  const [step, setStep] = useState<'intro' | 'verifying' | 'success'>('intro');

  const startVerification = () => {
    setStep('verifying');
    // Simulate verification delay
    setTimeout(() => {
      setStep('success');
    }, 2500);
  };

  const handleClose = () => {
    setStep('intro');
    onOpenChange(false);
  };

  const handleContinue = () => {
    setStep('intro');
    onOpenChange(false);
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="glass-card max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="w-5 h-5" />
            Face Verification Required
          </DialogTitle>
          <DialogDescription>
            Withdrawals to other bank accounts require face verification for security.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center text-center space-y-4">
          {step === 'intro' && (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <ScanFace className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                This is a one-time verification for this withdrawal. Your identity will be confirmed before proceeding.
              </p>
              <Button className="w-full gradient-primary" onClick={startVerification}>
                Start Verification
              </Button>
            </>
          )}

          {step === 'verifying' && (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Verifying your identity...</p>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-success" />
              </div>
              <p className="text-sm font-medium text-success">Verification successful</p>
              <p className="text-xs text-muted-foreground">You may now proceed with the withdrawal.</p>
              <Button className="w-full gradient-primary" onClick={handleContinue}>
                Continue to Withdraw
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
