
-- Create KYC status enum
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'pending', 'approved', 'rejected');

-- Create KYC submissions table
CREATE TABLE public.kyc_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  selfie_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- User can view their own submission
CREATE POLICY "Users can view own kyc" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert their own submission
CREATE POLICY "Users can insert own kyc" ON public.kyc_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User can update own pending submission
CREATE POLICY "Users can update own kyc" ON public.kyc_submissions
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all kyc" ON public.kyc_submissions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));

-- Admins can update all
CREATE POLICY "Admins can update all kyc" ON public.kyc_submissions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));

-- Trigger for updated_at
CREATE TRIGGER update_kyc_submissions_updated_at
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-selfies', 'kyc-selfies', false);

-- Storage policies
CREATE POLICY "Users can upload own selfie" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own selfie" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all selfies" ON storage.objects
  FOR SELECT USING (bucket_id = 'kyc-selfies' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  ));
