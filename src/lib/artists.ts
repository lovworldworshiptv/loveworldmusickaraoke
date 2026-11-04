import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Artist {
  id: string; slug: string; name: string; image_url: string | null; cover_url: string | null;
  description: string | null; is_verified: boolean;
}

/** Splits a free-text artist field ("A, B & C feat. D") into trimmed names. */
export function splitArtistNames(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\s*(?:,|&|\bfeat\.?(?=\s)|\bft\.?(?=\s))\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ArtistPart = { name: string; artist?: Artist };

/** Matches each name case-insensitively against known artists. */
export function matchArtists(value: string | null | undefined, artists: Artist[]): ArtistPart[] {
  const byName = new Map(artists.map((a) => [a.name.trim().toLowerCase(), a]));
  return splitArtistNames(value).map((name) => ({ name, artist: byName.get(name.toLowerCase()) }));
}

export function slugify(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export const ARTISTS_KEY = ["artists"];

export function useArtists() {
  return useQuery({
    queryKey: ARTISTS_KEY,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("artists").select("*").order("name");
      if (error) throw error;
      return (data || []) as Artist[];
    },
  });
}
