import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ListMusic, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AddToPlaylistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string;
  songTitle: string;
}

const AddToPlaylistModal = ({ open, onOpenChange, songId, songTitle }: AddToPlaylistModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const { data: playlists = [] } = useQuery({
    queryKey: ["user-playlists-for-add", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("playlists")
        .select("id, name, playlist_songs(song_id)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const isSongInPlaylist = (pl: any) =>
    (pl.playlist_songs || []).some((ps: any) => ps.song_id === songId);

  const addToPlaylist = async (playlistId: string) => {
    setAddingTo(playlistId);
    try {
      const { data: existing } = await supabase
        .from("playlist_songs")
        .select("id")
        .eq("playlist_id", playlistId)
        .eq("song_id", songId)
        .maybeSingle();

      if (existing) {
        toast.info("Song already in this playlist");
        setAddingTo(null);
        return;
      }

      const { data: maxOrder } = await supabase
        .from("playlist_songs")
        .select("sort_order")
        .eq("playlist_id", playlistId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = ((maxOrder as any)?.sort_order ?? -1) + 1;

      const { error } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id: playlistId, song_id: songId, sort_order: nextOrder });

      if (error) throw error;
      toast.success("Added to playlist!");
      queryClient.invalidateQueries({ queryKey: ["user-playlists-for-add"] });
      queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    } catch {
      toast.error("Failed to add to playlist");
    } finally {
      setAddingTo(null);
    }
  };

  const createAndAdd = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("playlists")
        .insert({ name: newName.trim(), user_id: user.id })
        .select("id")
        .single();
      if (error) throw error;

      await supabase
        .from("playlist_songs")
        .insert({ playlist_id: data.id, song_id: songId, sort_order: 0 });

      toast.success(`Created "${newName.trim()}" and added song!`);
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["user-playlists-for-add"] });
      queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    } catch {
      toast.error("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add to Playlist</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{songTitle}</p>
        </DialogHeader>

        {/* Create new */}
        <form onSubmit={(e) => { e.preventDefault(); createAndAdd(); }} className="flex gap-2">
          <Input
            placeholder="New playlist name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={!newName.trim() || creating} className="gap-1 shrink-0">
            <Plus className="w-3.5 h-3.5" /> New
          </Button>
        </form>

        {/* Existing playlists */}
        <div className="max-h-60 overflow-y-auto space-y-1">
          {playlists.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No playlists yet</p>
          ) : (
            playlists.map((pl: any) => {
              const alreadyIn = isSongInPlaylist(pl);
              return (
                <button
                  key={pl.id}
                  onClick={() => !alreadyIn && addToPlaylist(pl.id)}
                  disabled={alreadyIn || addingTo === pl.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    alreadyIn ? "opacity-60 cursor-default" : "hover:bg-muted/60"
                  }`}
                >
                  <ListMusic className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate flex-1">{pl.name}</span>
                  {alreadyIn ? (
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                  ) : addingTo === pl.id ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToPlaylistModal;

