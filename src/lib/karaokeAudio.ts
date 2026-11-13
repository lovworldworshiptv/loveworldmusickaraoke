import { supabase } from "@/integrations/supabase/client";

const MARK = "/karaoke-recordings/";

/** Karaoke recordings are private: turn a stored link into a short-lived signed link (signed-in only). */
export async function karaokeAudioUrl(stored: string): Promise<string> {
  const i = stored.indexOf(MARK);
  if (i < 0) return stored;
  const path = decodeURIComponent(stored.slice(i + MARK.length).split("?")[0]);
  const { data, error } = await supabase.storage.from("karaoke-recordings").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw error ?? new Error("Recording unavailable");
  return data.signedUrl;
}
