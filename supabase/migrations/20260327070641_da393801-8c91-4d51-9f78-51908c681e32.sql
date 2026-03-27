
-- Allow admins to view ALL recently_played records (for analytics)
CREATE POLICY "Admins can view all recently played"
  ON public.recently_played FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view ALL favorites records (for analytics)
CREATE POLICY "Admins can view all favorites"
  ON public.favorites FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
