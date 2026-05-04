-- Extend KYC submissions with structured identity fields
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS document_url text;

-- Private bucket for KYC ID documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users manage their own folder; admins can read all
DROP POLICY IF EXISTS "Users can upload own kyc docs" ON storage.objects;
CREATE POLICY "Users can upload own kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read own kyc docs" ON storage.objects;
CREATE POLICY "Users can read own kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own kyc docs" ON storage.objects;
CREATE POLICY "Users can update own kyc docs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can read all kyc docs" ON storage.objects;
CREATE POLICY "Admins can read all kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('kyc-documents', 'kyc-selfies')
  AND public.is_platform_admin(auth.uid())
);

-- Apply same admin read policy to kyc-selfies bucket (if not already covered)

-- RPC: server-side gate for high-value or restricted ops, used by client to check
CREATE OR REPLACE FUNCTION public.get_user_kyc_status(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status::text FROM public.kyc_submissions WHERE user_id = _user_id ORDER BY updated_at DESC LIMIT 1),
    'not_started'
  );
$$;