-- Create enums for the application
CREATE TYPE public.wallet_type AS ENUM ('CRYPTO', 'NGN');
CREATE TYPE public.deposit_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');
CREATE TYPE public.conversion_status AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED');
CREATE TYPE public.withdrawal_status AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED');
CREATE TYPE public.transaction_kind AS ENUM ('DEPOSIT', 'CONVERT', 'WITHDRAW');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  kyc_tier INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type wallet_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

-- Create crypto_balances table
CREATE TABLE public.crypto_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, token, network)
);

-- Create ngn_balances table
CREATE TABLE public.ngn_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (wallet_id)
);

-- Create deposits table
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC,
  status deposit_status NOT NULL DEFAULT 'PENDING',
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversions table
CREATE TABLE public.conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_token TEXT NOT NULL,
  from_network TEXT NOT NULL,
  from_amount NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  fee NUMERIC NOT NULL,
  ngn_amount NUMERIC NOT NULL,
  status conversion_status NOT NULL DEFAULT 'PROCESSING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'PROCESSING',
  reference TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table (unified activity log)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind transaction_kind NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  amount_display TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_crypto_balances_wallet_id ON public.crypto_balances(wallet_id);
CREATE INDEX idx_ngn_balances_wallet_id ON public.ngn_balances(wallet_id);
CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_conversions_user_id ON public.conversions(user_id);
CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crypto_balances_updated_at
  BEFORE UPDATE ON public.crypto_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ngn_balances_updated_at
  BEFORE UPDATE ON public.ngn_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deposits_updated_at
  BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversions_updated_at
  BEFORE UPDATE ON public.conversions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check user roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's wallet by type
CREATE OR REPLACE FUNCTION public.get_user_wallet_id(_user_id UUID, _type wallet_type)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.wallets WHERE user_id = _user_id AND type = _type LIMIT 1
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngn_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles (users can view their own roles, only admins can modify)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallets"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for crypto_balances (via wallet ownership)
CREATE POLICY "Users can view their own crypto balances"
  ON public.crypto_balances FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own crypto balances"
  ON public.crypto_balances FOR INSERT
  WITH CHECK (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own crypto balances"
  ON public.crypto_balances FOR UPDATE
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

-- RLS Policies for ngn_balances (via wallet ownership)
CREATE POLICY "Users can view their own NGN balance"
  ON public.ngn_balances FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own NGN balance"
  ON public.ngn_balances FOR INSERT
  WITH CHECK (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own NGN balance"
  ON public.ngn_balances FOR UPDATE
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

-- RLS Policies for deposits
CREATE POLICY "Users can view their own deposits"
  ON public.deposits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deposits"
  ON public.deposits FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for conversions
CREATE POLICY "Users can view their own conversions"
  ON public.conversions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversions"
  ON public.conversions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversions"
  ON public.conversions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for withdrawals
CREATE POLICY "Users can view their own withdrawals"
  ON public.withdrawals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawals"
  ON public.withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own withdrawals"
  ON public.withdrawals FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to initialize user wallets on first login
CREATE OR REPLACE FUNCTION public.initialize_user_wallets()
RETURNS TRIGGER AS $$
DECLARE
  crypto_wallet_id UUID;
  ngn_wallet_id UUID;
BEGIN
  -- Create crypto wallet
  INSERT INTO public.wallets (user_id, type)
  VALUES (NEW.id, 'CRYPTO')
  RETURNING id INTO crypto_wallet_id;
  
  -- Create NGN wallet
  INSERT INTO public.wallets (user_id, type)
  VALUES (NEW.id, 'NGN')
  RETURNING id INTO ngn_wallet_id;
  
  -- Initialize default crypto balances (USDT and USDC on Base)
  INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
  VALUES 
    (crypto_wallet_id, 'USDT', 'base', 0),
    (crypto_wallet_id, 'USDC', 'base', 0);
  
  -- Initialize NGN balance
  INSERT INTO public.ngn_balances (wallet_id, balance)
  VALUES (ngn_wallet_id, 0);
  
  -- Create empty profile for user
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to initialize wallets when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_wallets();