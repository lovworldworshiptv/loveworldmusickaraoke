
-- Add reply columns to feedback
ALTER TABLE public.feedback ADD COLUMN admin_reply text;
ALTER TABLE public.feedback ADD COLUMN replied_at timestamp with time zone;

-- Allow admins to update feedback (for replying)
CREATE POLICY "Admins can reply to feedback"
ON public.feedback
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for feedback
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;
