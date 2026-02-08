-- Allow users to update their own transactions (needed for simulate paid on withdrawals)
CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id);