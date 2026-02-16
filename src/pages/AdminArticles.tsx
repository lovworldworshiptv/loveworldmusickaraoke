import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  author: string;
  category: string;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  is_published: boolean;
  is_featured: boolean;
}

const AdminArticles = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [form, setForm] = useState({
    title: "", content: "", excerpt: "", author: "", category: "Devotional",
    image_url: "", video_url: "", audio_url: "", is_published: false, is_featured: false,
  });

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    const { data } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
    if (data) setArticles(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", content: "", excerpt: "", author: "", category: "Devotional", image_url: "", video_url: "", audio_url: "", is_published: false, is_featured: false });
    setEditingArticle(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title, content: form.content, excerpt: form.excerpt || null,
      author: form.author, category: form.category,
      image_url: form.image_url || null, video_url: form.video_url || null,
      audio_url: form.audio_url || null, is_published: form.is_published,
      is_featured: form.is_featured,
      ...(form.is_published ? { published_at: new Date().toISOString() } : {}),
    };

    if (editingArticle) {
      const { error } = await supabase.from("articles").update(payload).eq("id", editingArticle.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Article updated!");
    } else {
      const { error } = await supabase.from("articles").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Article created!");
    }
    resetForm();
    fetchArticles();
  };

  const handleEdit = (article: Article) => {
    setForm({
      title: article.title, content: article.content, excerpt: article.excerpt || "",
      author: article.author, category: article.category,
      image_url: article.image_url || "", video_url: article.video_url || "",
      audio_url: article.audio_url || "", is_published: article.is_published,
      is_featured: article.is_featured,
    });
    setEditingArticle(article);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await supabase.from("articles").delete().eq("id", id);
    toast.success("Deleted");
    fetchArticles();
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Articles</h2>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Add Article"}
          </Button>
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">{editingArticle ? "Edit Article" : "New Article"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Author" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option>Devotional</option><option>Study</option><option>Teaching</option><option>Testimony</option>
              </select>
              <input placeholder="Excerpt" value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Video URL" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Audio URL" value={form.audio_url} onChange={e => setForm({ ...form, audio_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <textarea placeholder="Article content..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              className="w-full min-h-[150px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm resize-y" />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} /> Published
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} /> Featured
              </label>
            </div>
            <Button onClick={handleSave} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editingArticle ? "Update" : "Create"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : articles.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No articles yet.</p>
        ) : (
          <div className="space-y-2">
            {articles.map(article => (
              <div key={article.id} className="glass-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{article.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{article.author} • {article.category}</p>
                  <div className="flex gap-2 mt-1">
                    {article.is_published && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Published</span>}
                    {article.is_featured && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">Featured</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(article)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(article.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default AdminArticles;
