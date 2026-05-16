// Instant tier-2 verification via Dojah (BVN/NIN). Falls back gracefully if provider not configured.
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Loader2, Zap } from 'lucide-react';

interface Props {
  onVerified?: () => void;
}

export const InstantKycVerify = ({ onVerified }: Props) => {
  const { toast } = useToast();
  const [idType, setIdType] = useState<'BVN' | 'NIN'>('BVN');
  const [idNumber, setIdNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!idNumber || !fullName || !dob) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    if (idType === 'BVN' && !/^\d{11}$/.test(idNumber)) {
      toast({ title: 'BVN must be 11 digits', variant: 'destructive' });
      return;
    }
    if (idType === 'NIN' && !/^\d{11}$/.test(idNumber)) {
      toast({ title: 'NIN must be 11 digits', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('dojah-verify', {
        body: { id_type: idType, id_number: idNumber, full_name: fullName, date_of_birth: dob, phone_number: phone },
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success) {
        toast({ title: 'Verification failed', description: r?.error || 'Please try again', variant: 'destructive' });
        return;
      }
      toast({ title: 'Verified instantly', description: 'You are now KYC tier 2.' });
      onVerified?.();
    } catch (e: any) {
      toast({ title: 'Verification unavailable', description: e?.message || 'Please use the manual flow below.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="glass-card border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Instant Verification
        </CardTitle>
        <CardDescription className="text-xs">Verify your BVN or NIN in seconds — no document upload needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">ID Type</Label>
            <Select value={idType} onValueChange={(v) => setIdType(v as any)}>
              <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BVN">BVN</SelectItem>
                <SelectItem value="NIN">NIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{idType} Number</Label>
            <Input inputMode="numeric" maxLength={11} placeholder="11 digits" value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ''))} className="h-10 text-sm font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Full Name (as on record)</Label>
          <Input placeholder="John Adebayo Okonkwo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Date of Birth</Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-10 text-sm" max={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone (optional)</Label>
            <Input placeholder="+234…" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 text-sm" />
          </div>
        </div>
        <Button onClick={submit} disabled={submitting} className="w-full min-h-[44px] gradient-primary">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" /> Verify Instantly</>}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          We verify against the official NIBSS / NIMC database. Your data is encrypted and never shared.
        </p>
      </CardContent>
    </Card>
  );
};
