-- Add SEND and RECEIVE to transaction_kind enum
ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'SEND';
ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'RECEIVE';