
-- Add username columns to payment_requests for easy display without cross-profile lookups
ALTER TABLE public.payment_requests ADD COLUMN requester_username text;
ALTER TABLE public.payment_requests ADD COLUMN recipient_username text;
