-- Allow editors to SELECT songs
CREATE POLICY "Editors can view all songs"
ON public.songs
FOR SELECT
USING (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to UPDATE songs (for lyrics)
CREATE POLICY "Editors can update songs"
ON public.songs
FOR UPDATE
USING (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to view albums (context)
CREATE POLICY "Editors can view albums"
ON public.albums
FOR SELECT
USING (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to view categories (context)
CREATE POLICY "Editors can view categories"
ON public.categories
FOR SELECT
USING (has_role(auth.uid(), 'editor'::app_role));

-- Allow editors to view their own role
CREATE POLICY "Editors can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);