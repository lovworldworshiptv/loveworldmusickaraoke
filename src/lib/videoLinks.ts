import { supabase } from "@/integrations/supabase/client";

/** True for KingsSpace "watch" pages, which are web pages rather than video files. */
export const isKingsSpacePage = (url: string) => {
  try {
    return /(^|\.)kingsspace\.online$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export interface ResolvedVideo {
  url: string;
  thumbnail: string | null;
  source: "youtube" | "kingsspace" | "direct";
}

/**
 * Checks a pasted video link on the backend and returns a playable URL.
 * Throws with a readable message when the link can't be played.
 */
export async function resolveVideoLink(raw: string): Promise<ResolvedVideo> {
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) throw new Error("Enter a full https:// video link");
  const { data, error } = await supabase.functions.invoke("resolve-video-url", { body: { url } });
  if (error) {
    let msg = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) msg = body.error;
    } catch { /* keep default message */ }
    throw new Error(msg);
  }
  if (!data?.url) throw new Error(data?.error || "Couldn't check this video link");
  return data as ResolvedVideo;
}
