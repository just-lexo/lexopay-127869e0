import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PaymentRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  asset: string;
  amount: number;
  note: string | null;
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  updated_at: string;
  requester_username: string | null;
  recipient_username: string | null;
}

export function usePaymentRequests() {
  const { user } = useAuth();
  const [received, setReceived] = useState<PaymentRequest[]>([]);
  const [sent, setSent] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch received requests (where I'm the recipient)
      const { data: receivedData, error: recvErr } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (recvErr) throw recvErr;

      // Fetch sent requests (where I'm the requester)
      const { data: sentData, error: sentErr } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (sentErr) throw sentErr;

      const enrichRequest = (r: any): PaymentRequest => {
        const isExpired = r.status === 'PENDING' && new Date(r.expires_at) < new Date();
        return {
          ...r,
          amount: Number(r.amount),
          status: isExpired ? 'EXPIRED' : r.status,
        };
      };

      setReceived((receivedData || []).map(enrichRequest));
      setSent((sentData || []).map(enrichRequest));
    } catch (err) {
      console.error('Error fetching payment requests:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { received, sent, loading, refetch: fetchRequests };
}
