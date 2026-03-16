
-- Allow authenticated users to insert notifications for any user (needed for cross-user notifications like send/request)
DROP POLICY "Users can insert own notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
