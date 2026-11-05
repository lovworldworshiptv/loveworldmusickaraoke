import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Pencil, Plus, Search } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { ARTISTS_KEY, slugify, useArtists, type Artist } from "@/lib/artists";
import { ArtistHero } from "@/pages/ArtistProfile";
import { toast } from "sonner";

const empty = { id: "", name: "", slug: "", description: "", image_url: "", cover_url: "", is_verified: true };

const AdminArtists = () => {
  const [tab, setTab] = useState<"artists" | "comments">("artists");
  return (
    <AppLayout>
      <div className="p-4 max-w-5xl mx-auto pb-28">
        <h1 className="font-serif text-3xl text-foreground mb-4">Artists</h1>
        <div className="flex gap-2 mb-4" role="tablist">
          {(["artists", "comments"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-semibold ${tab === t ? "gradient-gold text-primary-foreground" : "glass-card text-foreground"}`}>
              {t === "artists" ? "Artists" : "Video comments"}
            </button>
          ))}
        </div>
        {tab === "artists" ? <ArtistsTab /> : <CommentsTab />}
      </div>
    </AppLayout>
  );
};

const ArtistsTab = () => {
  const qc = useQueryClient();
  const { data: artists = [] } = useArtists();
  const [form, setForm] = useState<typeof empty | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [toDelete, setToDelete] = useState<Artist | null>(null);

  const save = async () => {
    if (!form) return;
    const row = { name: form.name.trim(), slug: slugify(form.slug || form.name), description: form.description || null,
      image_url: form.image_url || null, cover_url: form.cover_url || null, is_verified: form.is_verified };
    if (!row.name || !row.slug) { toast.error("Enter a name."); return; }
    const { error } = form.id ? await supabase.from("artists").update(row).eq("id", form.id) : await supabase.from("artists").insert(row);
    if (error) { toast.error(error.message.includes("duplicate") ? "That name or link is already used." : error.message); return; }
    toast.success("Artist saved");
    setForm(null);
    qc.invalidateQueries({ queryKey: ARTISTS_KEY });
  };
  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("artists").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message); else { toast.success("Artist deleted"); qc.invalidateQueries({ queryKey: ARTISTS_KEY }); }
    setToDelete(null);
  };

  if (form) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4 glass-card rounded-2xl p-4">
          <div><Label htmlFor="an">Name</Label>
            <Input id="an" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} /></div>
          <div><Label htmlFor="as">Page link</Label>
            <Input id="as" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} />
            <p className="text-xs text-muted-foreground mt-1">/artist/{slugify(form.slug || form.name)}</p></div>
          <div><Label htmlFor="ad">Description</Label>
            <Textarea id="ad" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <ImageUploadPicker bucket="song-covers" label="Profile image" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
          <ImageUploadPicker bucket="song-covers" label="Cover image" value={form.cover_url} onChange={(url) => setForm({ ...form, cover_url: url })} />
          <div className="flex items-center gap-3"><Switch id="av" checked={form.is_verified} onCheckedChange={(v) => setForm({ ...form, is_verified: v })} /><Label htmlFor="av">Verified</Label></div>
          <div className="flex gap-2"><Button onClick={save}>Save artist</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-border"><ArtistHero artist={{ ...form, name: form.name || "Artist name", image_url: form.image_url || null, cover_url: form.cover_url || null }} /></div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => { setSlugTouched(false); setForm({ ...empty }); }} className="mb-4"><Plus className="w-4 h-4 mr-1" />Add artist</Button>
      <ul className="space-y-2">
        {artists.map((a) => (
          <li key={a.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
            {a.image_url ? <img src={a.image_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-muted" />}
            <div className="flex-1 min-w-0"><p className="font-semibold text-foreground truncate">{a.name}</p><p className="text-xs text-muted-foreground">/artist/{a.slug}</p></div>
            <Button variant="ghost" size="icon" aria-label={`Edit ${a.name}`} onClick={() => { setSlugTouched(true); setForm({ id: a.id, name: a.name, slug: a.slug, description: a.description || "", image_url: a.image_url || "", cover_url: a.cover_url || "", is_verified: a.is_verified }); }}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${a.name}`} onClick={() => setToDelete(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </li>
        ))}
      </ul>
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The artist page and its followers are removed. Songs are not affected.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete artist</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

type AdminComment = { id: string; body: string; like_count: number; created_at: string; user_id: string; is_deleted: boolean; song_video_id: string };

const CommentsTab = () => {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-video-comments", q],
    queryFn: async () => {
      let query = supabase.from("video_comments").select("id,body,like_count,created_at,user_id,is_deleted,song_video_id").order("created_at", { ascending: false }).limit(100);
      if (q.trim()) query = query.ilike("body", `%${q.trim()}%`);
      const { data: rows } = await query;
      const list = (rows || []) as AdminComment[];
      const users = [...new Set(list.map((r) => r.user_id))];
      const vids = [...new Set(list.map((r) => r.song_video_id))];
      const [{ data: profs }, { data: vs }] = await Promise.all([
        users.length ? supabase.from("profiles").select("user_id,username").in("user_id", users) : Promise.resolve({ data: [] }),
        vids.length ? supabase.from("song_videos").select("id,songs(title)").in("id", vids) : Promise.resolve({ data: [] }),
      ]);
      const pm = new Map((profs || []).map((p: { user_id: string; username: string }) => [p.user_id, p.username]));
      const vm = new Map((vs || []).map((v: { id: string; songs: { title: string } | null }) => [v.id, v.songs?.title || "Video"]));
      return list.map((r) => ({ ...r, author: pm.get(r.user_id) || "Listener", video: vm.get(r.song_video_id) || "Video" }));
    },
  });
  const del = async (id: string) => {
    // Keeps replies under "Comment deleted" and wipes the text, same as listeners' own delete.
    const { error } = await supabase.rpc("delete_video_comment", { p_id: id });
    if (error) toast.error(error.message); else { toast.success("Comment deleted"); qc.invalidateQueries({ queryKey: ["admin-video-comments"] }); }
  };
  const shown = q.trim() ? data : data;
  return (
    <div>
      <div className="relative mb-4"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search comments" placeholder="Search comment text" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id} className="glass-card rounded-2xl p-3 flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{c.author} on {c.video} · {new Date(c.created_at).toLocaleString()} · {c.like_count} likes</p>
              <p className="text-sm text-foreground whitespace-pre-line break-words">{c.is_deleted ? "Comment deleted" : c.body}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Delete comment" onClick={() => del(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </li>
        ))}
        {!shown.length && <p className="text-muted-foreground text-sm">No comments yet.</p>}
      </ul>
    </div>
  );
};

export default AdminArtists;
