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
  // Joined fields
  requester_username?: string;
  requester_display_name?: string;
  recipient_username?: string;
  recipient_display_name?: string;
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

      // Collect all unique user IDs to fetch profiles
      const userIds = new Set<string>();
      [...(receivedData || []), ...(sentData || [])].forEach(r => {
        userIds.add(r.requester_id);
        userIds.add(r.recipient_id);
      });

      // Fetch profiles for all related users
      const profileMap = new Map<string, { username: string; display_name: string }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name')
          .in('user_id', Array.from(userIds));

        profiles?.forEach(p => {
          profileMap.set(p.user_id, {
            username: p.username || 'unknown',
            display_name: p.display_name || '',
          });
        });
      }

      const enrichRequest = (r: any): PaymentRequest => {
        const requesterProfile = profileMap.get(r.requester_id);
        const recipientProfile = profileMap.get(r.recipient_id);
        
        // Auto-expire
        const isExpired = r.status === 'PENDING' && new Date(r.expires_at) < new Date();
        
        return {
          ...r,
          amount: Number(r.amount),
          status: isExpired ? 'EXPIRED' : r.status,
          requester_username: requesterProfile?.username,
          requester_display_name: requesterProfile?.display_name,
          recipient_username: recipientProfile?.username,
          recipient_display_name: recipientProfile?.display_name,
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
