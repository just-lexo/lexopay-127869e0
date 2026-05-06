-- Prevent duplicate tx_hash credits
CREATE UNIQUE INDEX IF NOT EXISTS deposits_tx_hash_unique
  ON public.deposits (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- Enable scheduling + HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('monitor-deposits-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule monitor-deposits every minute
SELECT cron.schedule(
  'monitor-deposits-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://zbjxbwzawepdxuaytgco.supabase.co/functions/v1/monitor-deposits',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpianhid3phd2VwZHh1YXl0Z2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjkzNjYsImV4cCI6MjA4NTE0NTM2Nn0.IKqNuLX50bkOeIZELtwrEDZIMCXqNWjTI8CutgDbbNg"}'::jsonb,
    body:='{"source":"cron"}'::jsonb
  );
  $$
);