
ALTER TABLE public.deposits 
  ADD COLUMN IF NOT EXISTS detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmations_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_source text,
  ADD COLUMN IF NOT EXISTS reference_id text;
