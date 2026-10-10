import { useEffect, useState } from "react";
import { Headphones, Heart, Download, Mic, Gamepad2, ListMusic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Personal listening statistics, stored on the account so they follow the user to any device. */
const MyStats = ({ userId }: { userId: string }) => {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const count = (table: "recently_played" | "favorites" | "downloads" | "karaoke_recordings" | "game_sessions" | "playlists") =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId).then((r) => r.count ?? 0);
    Promise.all([count("recently_played"), count("favorites"), count("downloads"), count("karaoke_recordings"), count("game_sessions"), count("playlists")])
      .then(([plays, favs, dls, karaoke, games, playlists]) => setStats({ plays, favs, dls, karaoke, games, playlists }))
      .catch(() => setStats(null));
  }, [userId]);

  if (!stats) return null;
  const items = [
    { label: "Plays", value: stats.plays, icon: Headphones },
    { label: "Favorites", value: stats.favs, icon: Heart },
    { label: "Downloads", value: stats.dls, icon: Download },
    { label: "Karaoke", value: stats.karaoke, icon: Mic },
    { label: "Games", value: stats.games, icon: Gamepad2 },
    { label: "Playlists", value: stats.playlists, icon: ListMusic },
  ];
  return (
    <div className="glass-card p-4 mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">My Stats & Activity</h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-muted/40 p-3 text-center">
            <Icon className="w-4 h-4 mx-auto text-gold mb-1" />
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyStats;
