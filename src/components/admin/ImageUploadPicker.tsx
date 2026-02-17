import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Image, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadPickerProps {
  bucket: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
}

interface StorageFile {
  name: string;
  url: string;
}

const ImageUploadPicker = ({ bucket, label, value, onChange }: ImageUploadPickerProps) => {
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

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>

      {/* Preview */}
      {value && (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border bg-muted">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange("")}
            className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowPicker(!showPicker)}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-left min-w-0">
          <Image className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate text-foreground">{value ? "Change image" : "Choose existing"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
        </button>
        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : "gradient-gold text-primary-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> {uploading ? "..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        </label>
      </div>

      {/* URL fallback */}
      <input placeholder="Or paste image URL" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-xs" />

      {/* Picker dropdown */}
      {showPicker && (
        <div className="border border-border rounded-lg bg-card max-h-48 overflow-y-auto">
          {existing.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No images uploaded yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-2">
              {existing.map(f => (
                <button key={f.name} type="button" onClick={() => { onChange(f.url); setShowPicker(false); }}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${value === f.url ? "border-primary" : "border-transparent hover:border-border"}`}>
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploadPicker;
