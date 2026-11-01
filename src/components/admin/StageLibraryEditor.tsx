import { useState } from "react";
import { GripVertical, Image as ImageIcon, Loader2, Plus, Star, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveStageMediaUrl, type StageBackgroundChoice } from "@/lib/siteSettings";
import { moveStageChoice } from "@/lib/stageBackgrounds";

type Kind = "video" | "image";

type Props = {
  library: StageBackgroundChoice[];
  /** Persists the whole library; resolves true on success. */
  onSave: (next: StageBackgroundChoice[], message: string) => Promise<boolean>;
  /** Makes a library item the global background for every song. */
  onUseForAll: (choice: StageBackgroundChoice) => void;
  globalMediaUrl?: string;
};

const SECTIONS: { kind: Kind; title: string; hint: string; accept: string }[] = [
  { kind: "video", title: "Motion backgrounds", hint: "Short looping videos (MP4 or WebM). Keep them small — around 30 seconds and a few hundred KB loads fast on phones.", accept: "video/mp4,video/webm" },
  { kind: "image", title: "Still backgrounds", hint: "Wide landscape photos (JPG or WebP), about 1600 px wide.", accept: "image/jpeg,image/png,image/webp" },
];

const Thumb = ({ choice }: { choice: StageBackgroundChoice }) => (
  <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border" style={{ backgroundColor: choice.backgroundColor }}>
    {choice.mediaType === "image" && <img src={resolveStageMediaUrl(choice.mediaUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />}
    {choice.mediaType === "video" && (choice.posterUrl
      ? <img src={resolveStageMediaUrl(choice.posterUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
      : <video src={`${resolveStageMediaUrl(choice.mediaUrl)}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />)}
  </span>
);

const AddForm = ({ kind, accept, onAdd }: { kind: Kind; accept: string; onAdd: (c: StageBackgroundChoice) => Promise<boolean> }) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    const ok = kind === "video" ? file.type.startsWith("video/") : file.type.startsWith("image/");
    if (!ok) return toast.error(kind === "video" ? "Choose a video file" : "Choose an image file");
    setUploading(true);
    const ext = file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg");
    const path = `stage/library/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from("song-covers").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return toast.error("Upload failed");
    setUrl(supabase.storage.from("song-covers").getPublicUrl(path).data.publicUrl);
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    toast.success("Uploaded — tap Add to include it");
  };

  const add = async () => {
    const cleanName = name.trim();
    const cleanUrl = url.trim();
    if (!cleanName) return toast.error("Give this background a name");
    if (!/^(https:\/\/|\/)/i.test(cleanUrl)) return toast.error("Upload a file or paste an https link");
    const saved = await onAdd({ id: crypto.randomUUID(), name: cleanName, backgroundColor: "#000000", mediaType: kind, mediaUrl: cleanUrl });
    if (saved) { setName(""); setUrl(""); }
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Ocean sunset)" aria-label={`New ${kind === "video" ? "motion" : "still"} background name`} />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === "video" ? "Paste video link" : "Paste image link"} type="url" aria-label={`New ${kind === "video" ? "motion" : "still"} background link`} />
      </div>
      <div className="flex gap-2">
        <label className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background text-sm text-foreground hover:bg-muted">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : kind === "video" ? "Upload video" : "Upload image"}
          <input type="file" accept={accept} className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <Button type="button" size="sm" onClick={add} disabled={uploading} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </div>
  );
};

const StageLibraryEditor = ({ library, onSave, onUseForAll, globalMediaUrl }: Props) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const rename = (choice: StageBackgroundChoice) => {
    const next = names[choice.id]?.trim();
    if (next === undefined || next === choice.name) return;
    if (!next) { setNames((n) => ({ ...n, [choice.id]: choice.name })); return toast.error("Name can't be empty"); }
    onSave(library.map((c) => (c.id === choice.id ? { ...c, name: next } : c)), "Name saved");
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-foreground">Every song can use these in Stage Mode. Listeners pick them from the background button; the order here is the order they see.</p>
      {SECTIONS.map(({ kind, title, hint, accept }) => {
        const items = library.filter((c) => c.mediaType === kind);
        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center gap-2">
              {kind === "video" ? <Video className="h-4 w-4 text-gold" /> : <ImageIcon className="h-4 w-4 text-gold" />}
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <span className="text-xs text-muted-foreground">({items.length})</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
            {items.map((choice) => (
              <div
                key={choice.id}
                draggable
                onDragStart={(e) => { setDragId(choice.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (overId !== choice.id) setOverId(choice.id); }}
                onDragLeave={() => { if (overId === choice.id) setOverId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== choice.id) onSave(moveStageChoice(library, dragId, choice.id), "Order saved");
                  setDragId(null); setOverId(null);
                }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                className={`flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-sm text-foreground transition-all ${dragId === choice.id ? "opacity-40" : ""} ${overId === choice.id && dragId !== choice.id ? "ring-1 ring-gold/60" : ""}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-label={`Drag to reorder ${choice.name}`} />
                <Thumb choice={choice} />
                <Input
                  value={names[choice.id] ?? choice.name}
                  onChange={(e) => setNames((n) => ({ ...n, [choice.id]: e.target.value }))}
                  onBlur={() => rename(choice)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  aria-label={`Name for ${choice.name}`}
                  className="h-8 min-w-0 flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Use ${choice.name} for all songs`}
                  title="Use as the default background for all songs"
                  onClick={() => onUseForAll(choice)}
                  className={`h-8 w-8 ${globalMediaUrl === choice.mediaUrl ? "text-gold" : ""}`}
                >
                  <Star className="h-3.5 w-3.5" fill={globalMediaUrl === choice.mediaUrl ? "currentColor" : "none"} />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${choice.name}`} onClick={() => onSave(library.filter((c) => c.id !== choice.id), "Background removed")} className="h-8 w-8">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <AddForm kind={kind} accept={accept} onAdd={(c) => onSave([...library, c], "Background added for all songs")} />
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">The star makes a background the default for every song (songs with their own background keep theirs).</p>
    </div>
  );
};

export default StageLibraryEditor;
