-- PHASE 10: renewal reminders + social communities

-- 1) Renewal reminder dedupe (service-role only)
CREATE TABLE public.renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone text not null check (milestone in ('7','3','1','0')),
  sent_at timestamptz not null default now(),
  unique (user_id, milestone)
);
GRANT ALL ON public.renewal_reminders TO service_role;
ALTER TABLE public.renewal_reminders ENABLE ROW LEVEL SECURITY;

-- 2) Communities
CREATE TABLE public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  cover_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active communities readable by all" ON public.communities FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins manage communities" ON public.communities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator')),
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);
CREATE INDEX community_members_community_idx ON public.community_members(community_id);
CREATE INDEX community_members_user_idx ON public.community_members(user_id);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members list visible" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join communities" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave communities" ON public.community_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  song_id uuid references public.songs(id) on delete set null,
  created_at timestamptz not null default now()
);
CREATE INDEX community_posts_community_idx ON public.community_posts(community_id, created_at desc);
GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts readable by authenticated" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members post" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = community_posts.community_id AND m.user_id = auth.uid()));
CREATE POLICY "Authors delete own posts" ON public.community_posts FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;
GRANT ALL ON public.community_post_likes TO service_role;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes readable" ON public.community_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like posts" ON public.community_post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users unlike posts" ON public.community_post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
CREATE INDEX community_comments_post_idx ON public.community_post_comments(post_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.community_post_comments TO authenticated;
GRANT ALL ON public.community_post_comments TO service_role;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments readable" ON public.community_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment" ON public.community_post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own comments" ON public.community_post_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));