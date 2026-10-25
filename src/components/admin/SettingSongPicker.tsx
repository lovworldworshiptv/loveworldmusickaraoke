import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { getSetting, saveSetting } from "@/lib/siteSettings";

type SongLite = { id: string; title: string; artist: string };

/** Ordered song list saved to one app setting; saves on every change. */
const SettingSongPicker = ({ settingKey, label, hint = "Leave empty to pick automatically from popular songs." }: { settingKey: string; label: string; hint?: string }) => {
  const [chosen, setChosen] = useState<SongLite[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SongLite[]>([]);
  const ids = chosen.map((s) => s.id);

  useEffect(() => {
    getSetting<string[]>(settingKey).then(async (v) => {
      const list = v || [];
      if (!list.length) return;
      const { data } = await supabase.from("songs").select("id,title,artist").in("id", list);
      setChosen(list.map((id) => (data || []).find((s) => s.id === id)).filter(Boolean) as SongLite[]);
    });
  }, [settingKey]);

  useEffect(() => {
    const t = q.replace(/[,()%]/g, " ").trim();
    if (t.length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      supabase.from("songs").select("id,title,artist").ilike("title", `%${t}%`).order("title").limit(8).then(({ data }) => setResults(data || []));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const persist = async (next: SongLite[]) => {
    setChosen(next);
    const { error } = await saveSetting(settingKey, next.map((s) => s.id));
    error ? toast.error("Could not save") : toast.success("Saved");
  };

  const swap = (i: number, j: number) => { const n = [...chosen]; [n[i], n[j]] = [n[j], n[i]]; persist(n); };

  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-foreground mb-1">{label} ({chosen.length})</p>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs to add" className="pl-9" />
      </div>
      {results.filter((r) => !ids.includes(r.id)).map((r) => (
        <button key={r.id} onClick={() => { persist([...chosen, r]); setQ(""); }} className="block w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted text-foreground">
          + {r.title} <span className="text-foreground">· {r.artist}</span>
        </button>
      ))}
      <ol className="mt-2 space-y-1">
        {chosen.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 text-foreground">
            <span className="flex-1 truncate">{i + 1}. {s.title}</span>
            <button aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="w-4 h-4" /></button>
            <button aria-label={`Move ${s.title} down`} disabled={i === chosen.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="w-4 h-4" /></button>
            <button className="text-destructive text-xs" onClick={() => persist(chosen.filter((x) => x.id !== s.id))}>Remove</button>
          </li>
        ))}
      </ol>
      {chosen.length > 0 && (
        <button className="text-xs underline text-foreground" onClick={() => { if (window.confirm("Clear all picked songs and go back to automatic?")) persist([]); }}>Clear all (use automatic)</button>
      )}
    </div>
  );
};

export default SettingSongPicker;
