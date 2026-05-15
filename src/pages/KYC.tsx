import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Loader2, BadgeCheck, Camera, FileText, CheckCircle2, Clock, XCircle, ShieldCheck,
} from 'lucide-react';
import { KycTierHub } from '@/components/KycTierHub';

type KycStatus = 'pending' | 'approved' | 'rejected' | null;

const ID_TYPES = [
  { value: 'NIN', label: 'National Identity Number (NIN)' },
  { value: 'PASSPORT', label: 'International Passport' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License" },
];

const KYC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<KycStatus>(null);
  const [adminNote, setAdminNote] = useState<string | null>(null);

  // Form
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchKYC();
  }, []);

  const fetchKYC = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('kyc_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const d: any = data;
        setStatus(d.status);
        setAdminNote(d.admin_note ?? null);
        setFullName(d.full_name || '');
        setPhoneNumber(d.phone_number || '');
        setDateOfBirth(d.date_of_birth || '');
        setIdType(d.id_type || '');
        setIdNumber(d.id_number || '');
      }
    } catch (err) {
      console.error('KYC fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB.', variant: 'destructive' });
      return;
    }
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB.', variant: 'destructive' });
      return;
    }
    setDocFile(file);
    setDocPreview(URL.createObjectURL(file));
  };

  const canSubmit = () => {
    if (!fullName.trim() || !phoneNumber.trim() || !dateOfBirth || !idType || !idNumber.trim()) return false;
    // Selfie + doc are required on first submit and on resubmit
    if (status !== 'pending' && status !== 'approved') {
      if (!selfieFile && !status) return false;
      if (!docFile && !status) return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!canSubmit()) {
      toast({ title: 'Please complete all fields', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let selfieUrl: string | undefined;
      let documentUrl: string | undefined;

      if (selfieFile) {
        const ext = selfieFile.name.split('.').pop();
        const path = `${user.id}/selfie-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('kyc-selfies').upload(path, selfieFile, { upsert: true });
        if (error) throw error;
        selfieUrl = path;
      }

      if (docFile) {
        const ext = docFile.name.split('.').pop();
        const path = `${user.id}/document-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, docFile, { upsert: true });
        if (error) throw error;
        documentUrl = path;
      }

      const payload: any = {
        user_id: user.id,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        date_of_birth: dateOfBirth,
        id_type: idType,
        id_number: idNumber.trim(),
        status: 'pending',
        admin_note: null,
        updated_at: new Date().toISOString(),
      };
      if (selfieUrl) payload.selfie_url = selfieUrl;
      if (documentUrl) payload.document_url = documentUrl;

      if (status) {
        const { error } = await supabase
          .from('kyc_submissions')
          .update(payload)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kyc_submissions').insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Verification submitted', description: 'We will review your identity within 1–2 business days.' });
      setStatus('pending');
      setAdminNote(null);
    } catch (err: any) {
      console.error('KYC submit error:', err);
      toast({ title: 'Submission failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = {
    pending: { Icon: Clock, label: 'Pending Review', variant: 'secondary' as const, color: 'text-warning' },
    approved: { Icon: CheckCircle2, label: 'Verified', variant: 'default' as const, color: 'text-success' },
    rejected: { Icon: XCircle, label: 'Rejected', variant: 'destructive' as const, color: 'text-destructive' },
  };
  const currentStatus = status ? statusConfig[status] : null;
  const formDisabled = status === 'pending' || status === 'approved';

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/profile')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-base flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" /> Identity Verification
            </h1>
            <p className="text-xs text-muted-foreground">Required to unlock withdrawals</p>
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
            <KycTierHub variant="full" />
            {currentStatus && (
              <Card className="glass-card border-border/50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <currentStatus.Icon className={`w-6 h-6 ${currentStatus.color}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Verification Status</p>
                      <p className="text-xs text-muted-foreground">
                        {status === 'pending' && 'We are reviewing your submission.'}
                        {status === 'approved' && 'Your identity has been verified.'}
                        {status === 'rejected' && 'Please review the note below and resubmit.'}
                      </p>
                    </div>
                    <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
                  </div>
                  {status === 'rejected' && adminNote && (
                    <div className="mt-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                      <p className="text-xs font-medium text-destructive mb-1">Reason for rejection</p>
                      <p className="text-xs text-muted-foreground">{adminNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {status === 'approved' ? (
              <Card className="glass-card border-success/20">
                <CardContent className="py-8 text-center">
                  <ShieldCheck className="w-12 h-12 text-success mx-auto mb-3" />
                  <h3 className="text-lg font-semibold">Identity Verified</h3>
                  <p className="text-sm text-muted-foreground mt-1">All features are now unlocked.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {status === 'rejected' ? 'Resubmit Verification' : status === 'pending' ? 'Submission Details' : 'Personal Information'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All information must match your government-issued ID.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Legal Name</Label>
                    <Input placeholder="As shown on your ID" value={fullName} onChange={(e) => setFullName(e.target.value)} className="min-h-[44px]" disabled={formDisabled} />
                  </div>

                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="min-h-[44px]" disabled={formDisabled} max={new Date().toISOString().split('T')[0]} />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="+234 xxx xxx xxxx" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="min-h-[44px]" disabled={formDisabled} />
                  </div>

                  <div className="space-y-2">
                    <Label>ID Type</Label>
                    <Select value={idType} onValueChange={setIdType} disabled={formDisabled}>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select ID type" /></SelectTrigger>
                      <SelectContent>
                        {ID_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>ID Number</Label>
                    <Input placeholder="Enter ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="min-h-[44px]" disabled={formDisabled} />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> ID Document</Label>
                    {docPreview ? (
                      <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border bg-muted">
                        <img src={docPreview} alt="ID document" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors ${formDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Tap to upload ID document</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">JPG / PNG • max 5MB</p>
                        <input type="file" accept="image/*" className="hidden" onChange={handleDocChange} disabled={formDisabled} />
                      </label>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Camera className="w-3.5 h-3.5" /> Selfie</Label>
                    {selfiePreview ? (
                      <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border">
                        <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors ${formDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">Tap to take selfie</p>
                        <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleSelfieChange} disabled={formDisabled} />
                      </label>
                    )}
                  </div>

                  {!formDisabled && (
                    <Button className="w-full min-h-[48px] gradient-primary" onClick={handleSubmit} disabled={submitting || !canSubmit()}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : status === 'rejected' ? 'Resubmit Verification' : 'Submit for Verification'}
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
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default KYC;
