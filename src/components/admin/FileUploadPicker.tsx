import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileAudio, ChevronDown, X, FileVideo } from "lucide-react";
import { toast } from "sonner";

interface FileUploadPickerProps {
  bucket: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  type?: "audio" | "video";
}

interface StorageFile {
  name: string;
  url: string;
}

const FileUploadPicker = ({ bucket, label, value, onChange, accept = "audio/*", type = "audio" }: FileUploadPickerProps) => {
  const [existing, setExisting] = useState<StorageFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchExisting = async () => {
    const { data } = await supabase.storage.from(bucket).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (data) {
      setExisting(data.filter(f => !f.name.startsWith(".")).map(f => ({
        name: f.name,
        url: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
      })));
    }
  };

  useEffect(() => { fetchExisting(); }, [bucket]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(publicUrl);
    toast.success(`${label} uploaded!`);
    setUploading(false);
    setShowPicker(false);
    fetchExisting();
  };

  const Icon = type === "video" ? FileVideo : FileAudio;

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>

      {value && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted">
          <Icon className="w-4 h-4 text-gold flex-shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">{value.split("/").pop()}</span>
          <button type="button" onClick={() => onChange("")}
            className="p-1 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowPicker(!showPicker)}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-left min-w-0">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate text-foreground">{value ? "Change file" : "Choose existing"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
        </button>
        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : "gradient-gold text-primary-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> {uploading ? "..." : "Upload"}
          <input type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        </label>
      </div>

      <input placeholder={`Or paste ${type} URL`} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-xs" />

      {showPicker && (
        <div className="border border-border rounded-lg bg-card max-h-48 overflow-y-auto">
          {existing.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No files uploaded yet</p>
          ) : (
            <div className="space-y-0.5 p-2">
              {existing.map(f => (
                <button key={f.name} type="button" onClick={() => { onChange(f.url); setShowPicker(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${value === f.url ? "bg-primary/10 text-gold" : "hover:bg-muted text-foreground"}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploadPicker;
