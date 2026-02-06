-- Drop and recreate the function with WHERE true to satisfy Supabase's requirement
CREATE OR REPLACE FUNCTION public.reset_all_users_data(_seed_balance boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid := auth.uid();
  _is_admin boolean;
BEGIN
  -- Verify caller is admin
  SELECT is_admin INTO _is_admin
  FROM public.profiles
  WHERE user_id = _admin_id;
  
  IF _is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Reset ALL crypto balances to 0 (WHERE true to satisfy pg requirement)
  UPDATE public.crypto_balances
  SET balance = 0, updated_at = now()
  WHERE true;
  
  -- Reset ALL NGN balances to 0
  UPDATE public.ngn_balances
  SET balance = 0, updated_at = now()
  WHERE true;
  
  -- Delete ALL transactions
  DELETE FROM public.transactions WHERE true;
  
  -- Delete ALL deposits
  DELETE FROM public.deposits WHERE true;
  
  -- Delete ALL conversions
  DELETE FROM public.conversions WHERE true;
  
  -- Delete ALL withdrawals
  DELETE FROM public.withdrawals WHERE true;
  
  -- Optionally seed demo balance for ALL users
  IF _seed_balance THEN
    UPDATE public.crypto_balances
    SET balance = 100, updated_at = now()
    WHERE token = 'USDT' AND network = 'base';
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$function$;