import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMaintenanceMode() {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMode = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (!error && data) {
        setMaintenance(data.value === true);
      }
    } catch {
      // fail open — don't block users on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMode();
  }, []);

  const toggle = async (newValue: boolean) => {
    const { error } = await supabase
      .from('app_settings')
      .update({ value: newValue as any, updated_at: new Date().toISOString() })
      .eq('key', 'maintenance_mode');

    if (!error) {
      setMaintenance(newValue);
    }
    return { error };
  };

  return { maintenance, loading, toggle, refresh: fetchMode };
}
