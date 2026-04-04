import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, BadgeCheck, Camera, CheckCircle2, Clock, XCircle } from 'lucide-react';

const KYC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchKYC();
  }, []);

  const fetchKYC = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('kyc_submissions' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setStatus((data as any).status);
        setFullName((data as any).full_name || '');
        setPhoneNumber((data as any).phone_number || '');
      }
    } catch (err) {
      console.error('KYC fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB.', variant: 'destructive' });
      return;
    }
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim() || !phoneNumber.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    if (!selfieFile && !status) {
      toast({ title: 'Please upload a selfie', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let selfieUrl = '';

      if (selfieFile) {
        const ext = selfieFile.name.split('.').pop();
        const path = `${user.id}/selfie-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('kyc-selfies')
          .upload(path, selfieFile, { upsert: true });
        if (uploadError) throw uploadError;
        selfieUrl = path;
      }

      const payload: any = {
        user_id: user.id,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        status: 'pending',
      };
      if (selfieUrl) payload.selfie_url = selfieUrl;

      if (status) {
        const { error } = await supabase
          .from('kyc_submissions' as any)
          .update(payload)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('kyc_submissions' as any)
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Verification submitted', description: 'We will review your identity.' });
      setStatus('pending');
    } catch (err: any) {
      console.error('KYC submit error:', err);
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = {
    pending: { icon: Clock, label: 'Pending Review', variant: 'secondary' as const, color: 'text-warning' },
    approved: { icon: CheckCircle2, label: 'Verified', variant: 'default' as const, color: 'text-success' },
    rejected: { icon: XCircle, label: 'Rejected', variant: 'destructive' as const, color: 'text-destructive' },
  };

  const currentStatus = status ? statusConfig[status as keyof typeof statusConfig] : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-base flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" /> Verification
            </h1>
            <p className="text-xs text-muted-foreground">Identity verification</p>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Status Card */}
            {currentStatus && (
              <Card className="glass-card border-border/50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <currentStatus.icon className={`w-6 h-6 ${currentStatus.color}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Status</p>
                      <p className="text-xs text-muted-foreground">Your verification is {currentStatus.label.toLowerCase()}</p>
                    </div>
                    <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form - show if not approved */}
            {status !== 'approved' && (
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {status === 'rejected' ? 'Resubmit Verification' : status === 'pending' ? 'Submission Details' : 'Start Verification'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="Enter your full legal name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="min-h-[44px]" disabled={status === 'pending'} />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="+234 xxx xxx xxxx" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="min-h-[44px]" disabled={status === 'pending'} />
                  </div>

                  <div className="space-y-2">
                    <Label>Selfie</Label>
                    {selfiePreview ? (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border">
                        <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                        <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Tap to upload selfie</p>
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} disabled={status === 'pending'} />
                      </label>
                    )}
                  </div>

                  {status !== 'pending' && (
                    <Button className="w-full min-h-[48px] gradient-primary" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : status === 'rejected' ? 'Resubmit' : 'Submit Verification'}
                    </Button>
                  )}

                  {status === 'pending' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Your submission is being reviewed. This usually takes 1–2 business days.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {status === 'approved' && (
              <Card className="glass-card border-success/20">
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                  <h3 className="text-lg font-semibold">Identity Verified</h3>
                  <p className="text-sm text-muted-foreground mt-1">Your account has been successfully verified.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default KYC;
