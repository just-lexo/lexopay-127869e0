import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

const normalize = (raw: string | null | undefined): KycStatus => {
  switch ((raw || '').toLowerCase()) {
    case 'pending': return 'PENDING';
    case 'approved': return 'APPROVED';
    case 'rejected': return 'REJECTED';
    default: return 'NOT_STARTED';
  }
};

export function useKycStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<KycStatus>('NOT_STARTED');
  const [adminNote, setAdminNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('kyc_submissions')
      .select('status, admin_note')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setStatus(normalize(data?.status));
    setAdminNote(data?.admin_note ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return { status, adminNote, loading, refetch: fetchStatus, isApproved: status === 'APPROVED' };
}
