import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, Save, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import GameCardsEditor from "@/components/admin/GameCardsEditor";

interface GameLevel {
  id: string;
  level: number;
  title: string;
  is_active: boolean;
  image_url: string | null;
}

interface QuizQuestion {
  id: string;
  level_id: string;
  song_title: string;
  lyric_text: string;
  missing_word: string;
  options: string[];
  sort_order: number;
}

const AdminGames = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [levels, setLevels] = useState<GameLevel[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLevelForm, setShowLevelForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<GameLevel | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<GameLevel | null>(null);
  const [showQForm, setShowQForm] = useState(false);
  const [editingQ, setEditingQ] = useState<QuizQuestion | null>(null);

  const [levelForm, setLevelForm] = useState({ level: 1, title: "", is_active: true, image_url: "" });
  const [qForm, setQForm] = useState({ song_title: "", lyric_text: "", missing_word: "", options: ["", "", "", ""], sort_order: 0 });

  useEffect(() => { fetchLevels(); }, []);

  const fetchLevels = async () => {
    const { data } = await supabase.from("game_levels").select("*").order("level");
    if (data) setLevels(data);
    setLoading(false);
  };

  const fetchQuestions = async (levelId: string) => {
    const { data } = await supabase.from("quiz_questions").select("*").eq("level_id", levelId).order("sort_order");
    if (data) setQuestions(data);
  };

  const resetLevelForm = () => {
    setLevelForm({ level: 1, title: "", is_active: true, image_url: "" });
    setEditingLevel(null);
    setShowLevelForm(false);
  };

  const handleSaveLevel = async () => {
    const payload = { level: levelForm.level, title: levelForm.title, is_active: levelForm.is_active, image_url: levelForm.image_url || null };
    if (editingLevel) {
      const { error } = await supabase.from("game_levels").update(payload).eq("id", editingLevel.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Level updated!");
    } else {
      const { error } = await supabase.from("game_levels").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Level created!");
    }
    resetLevelForm();
    fetchLevels();
  };

  const handleEditLevel = (lvl: GameLevel) => {
    setLevelForm({ level: lvl.level, title: lvl.title, is_active: lvl.is_active, image_url: lvl.image_url || "" });
    setEditingLevel(lvl);
    setShowLevelForm(true);
  };

  const handleDeleteLevel = async (id: string) => {
    if (!confirm("Delete this level and all its questions?")) return;
    await supabase.from("quiz_questions").delete().eq("level_id", id);
    await supabase.from("game_levels").delete().eq("id", id);
    toast.success("Deleted");
    if (selectedLevel?.id === id) setSelectedLevel(null);
    fetchLevels();
  };

  const resetQForm = () => {
    setQForm({ song_title: "", lyric_text: "", missing_word: "", options: ["", "", "", ""], sort_order: 0 });
    setEditingQ(null);
    setShowQForm(false);
  };

  const handleSaveQ = async () => {
    if (!selectedLevel) return;
    const payload = {
      level_id: selectedLevel.id,
      song_title: qForm.song_title, lyric_text: qForm.lyric_text,
      missing_word: qForm.missing_word, options: qForm.options.filter(Boolean),
      sort_order: qForm.sort_order,
    };
    if (editingQ) {
      const { error } = await supabase.from("quiz_questions").update(payload).eq("id", editingQ.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Question updated!");
    } else {
      const { error } = await supabase.from("quiz_questions").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Question created!");
    }
    resetQForm();
    fetchQuestions(selectedLevel.id);
  };

  const handleEditQ = (q: QuizQuestion) => {
    const opts = [...q.options];
    while (opts.length < 4) opts.push("");
    setQForm({ song_title: q.song_title, lyric_text: q.lyric_text, missing_word: q.missing_word, options: opts, sort_order: q.sort_order });
    setEditingQ(q);
    setShowQForm(true);
  };

  const handleDeleteQ = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("quiz_questions").delete().eq("id", id);
    toast.success("Deleted");
    if (selectedLevel) fetchQuestions(selectedLevel.id);
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  // Question management view
  if (selectedLevel) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
          <button onClick={() => { setSelectedLevel(null); resetQForm(); }} className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
            ← Back to Levels
          </button>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold text-foreground">Level {selectedLevel.level}: {selectedLevel.title}</h2>
            <Button onClick={() => { resetQForm(); setShowQForm(!showQForm); }} className="gradient-gold text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> {showQForm ? "Cancel" : "Add Question"}
            </Button>
          </div>

          {showQForm && (
            <div className="glass-card p-5 mb-6 space-y-4">
              <h3 className="font-serif font-bold text-foreground">{editingQ ? "Edit Question" : "New Question"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="Song Title" value={qForm.song_title} onChange={e => setQForm({ ...qForm, song_title: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                <input placeholder="Sort Order" type="number" value={qForm.sort_order} onChange={e => setQForm({ ...qForm, sort_order: Number(e.target.value) })}
                  className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              </div>
              <textarea placeholder='Lyric text (use ___ for the blank)' value={qForm.lyric_text} onChange={e => setQForm({ ...qForm, lyric_text: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm resize-y" />
              <input placeholder="Missing word (correct answer)" value={qForm.missing_word} onChange={e => setQForm({ ...qForm, missing_word: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <p className="text-xs text-muted-foreground">Options (include the correct answer):</p>
              <div className="grid grid-cols-2 gap-2">
                {qForm.options.map((opt, i) => (
                  <input key={i} placeholder={`Option ${i + 1}`} value={opt}
                    onChange={e => { const o = [...qForm.options]; o[i] = e.target.value; setQForm({ ...qForm, options: o }); }}
                    className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                ))}
              </div>
              <Button onClick={handleSaveQ} className="gradient-gold text-primary-foreground gap-2">
                <Save className="w-4 h-4" /> {editingQ ? "Update" : "Create"}
              </Button>
            </div>
          )}

          {questions.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No questions yet.</p>
          ) : (
            <div className="space-y-2">
              {questions.map(q => (
                <div key={q.id} className="glass-card p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gold font-medium">{q.song_title}</p>
                    <p className="text-sm text-foreground mt-1">{q.lyric_text}</p>
                    <p className="text-xs text-muted-foreground mt-1">Answer: <span className="text-green-400">{q.missing_word}</span></p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEditQ(q)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteQ(q.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Games</h2>
          <Button onClick={() => { resetLevelForm(); setShowLevelForm(!showLevelForm); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {showLevelForm ? "Cancel" : "Add Level"}
          </Button>
        </div>

        {showLevelForm && (
          <>
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">{editingLevel ? "Edit Level" : "New Level"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Level number" type="number" value={levelForm.level} onChange={e => setLevelForm({ ...levelForm, level: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Title" value={levelForm.title} onChange={e => setLevelForm({ ...levelForm, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>

            <ImageUploadPicker bucket="game-images" label="Level Image" value={levelForm.image_url} onChange={url => setLevelForm({ ...levelForm, image_url: url })} />

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={levelForm.is_active} onChange={e => setLevelForm({ ...levelForm, is_active: e.target.checked })} /> Active
            </label>
            <Button onClick={handleSaveLevel} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editingLevel ? "Update" : "Create"}
            </Button>
          </div>
          </>
        )}

        <GameCardsEditor />
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : levels.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No game levels yet.</p>
        ) : (
          <div className="space-y-2">
            {levels.map(lvl => (
              <div key={lvl.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {lvl.image_url ? (
                    <img src={lvl.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy className="w-6 h-6 text-gold/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedLevel(lvl); fetchQuestions(lvl.id); }}>
                  <p className="text-sm font-medium text-foreground">Level {lvl.level}: {lvl.title}</p>
                  <p className="text-xs text-muted-foreground">{lvl.is_active ? "Active" : "Inactive"} • Click to manage questions</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditLevel(lvl)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteLevel(lvl.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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

export default AdminGames;
