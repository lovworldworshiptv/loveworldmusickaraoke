
-- Create notification-images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('notification-images', 'notification-images', true);

-- Allow admins to upload notification images
CREATE POLICY "Admins can upload notification images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'notification-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update notification images
CREATE POLICY "Admins can update notification images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'notification-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to delete notification images
CREATE POLICY "Admins can delete notification images"
ON storage.objects FOR DELETE
USING (bucket_id = 'notification-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Notification images are publicly readable
CREATE POLICY "Notification images are public"
ON storage.objects FOR SELECT
USING (bucket_id = 'notification-images');
