-- Add policy for admins to update feedback (for marking read/unread)
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);