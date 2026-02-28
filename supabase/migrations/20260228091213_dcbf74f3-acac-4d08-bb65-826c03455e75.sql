
-- Create homepage popup configuration table (singleton pattern)
CREATE TABLE public.homepage_popup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  homepage_only boolean NOT NULL DEFAULT true,
  delay_seconds integer NOT NULL DEFAULT 2,
  show_frequency text NOT NULL DEFAULT 'every_visit',
  title text,
  description text,
  image_url text,
  image_position text NOT NULL DEFAULT 'top',
  primary_button_text text,
  primary_button_url text,
  primary_button_new_tab boolean NOT NULL DEFAULT false,
  secondary_button_text text,
  secondary_button_url text,
  secondary_button_new_tab boolean NOT NULL DEFAULT false,
  bg_color text DEFAULT '#1a1a2e',
  text_color text DEFAULT '#ffffff',
  button_color text DEFAULT '#d4af37',
  button_text_color text DEFAULT '#000000',
  border_radius text DEFAULT '16px',
  max_width text DEFAULT '480px',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.homepage_popup ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Homepage popup is public" ON public.homepage_popup FOR SELECT USING (true);

-- Admin manage
CREATE POLICY "Admins can manage homepage popup" ON public.homepage_popup FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.homepage_popup (enabled) VALUES (false);

-- Trigger for updated_at
CREATE TRIGGER update_homepage_popup_updated_at
  BEFORE UPDATE ON public.homepage_popup
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
