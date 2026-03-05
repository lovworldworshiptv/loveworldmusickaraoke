import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { User, Music, Clock, AtSign, Share2, Trash2, Play, Pause } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

interface PublicProfileData {
  user_id: string;
  username: string;
  avatar_url: string | null;
  kingschat_handle: string | null;
}

interface RecentTrack {
  song_id: string;
  played_at: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

interface KaraokeRecording {
  id: string;
  song_id: string;
  song_title: string;
  audio_url: string;
  created_at: string;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [karaoke, setKaraoke] = useState<KaraokeRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingKaraoke, setPlayingKaraoke] = useState<string | null>(null);
  const [karaokeAudio, setKaraokeAudio] = useState<HTMLAudioElement | null>(null);
  const { currentSong, isPlaying } = usePlayer();

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      supabase.rpc("get_public_profile", { p_user_id: userId }),
      supabase.rpc("get_public_recently_played", { p_user_id: userId, p_limit: 5 }),
      supabase.rpc("get_public_karaoke", { p_user_id: userId }),
    ]).then(([profileRes, recentRes, karaokeRes]) => {
      if (profileRes.data && (profileRes.data as any[]).length > 0) {
        setProfile((profileRes.data as any[])[0]);
      }
      setRecentTracks((recentRes.data as RecentTrack[]) || []);
      setKaraoke((karaokeRes.data as KaraokeRecording[]) || []);
      setLoading(false);
    });
  }, [userId]);

  const playKaraokeClip = (rec: KaraokeRecording) => {
    if (playingKaraoke === rec.id) {
      karaokeAudio?.pause();
      setPlayingKaraoke(null);
      return;
    }
    karaokeAudio?.pause();
    const audio = new Audio(rec.audio_url);
    audio.play();
    audio.onended = () => setPlayingKaraoke(null);
    setKaraokeAudio(audio);
    setPlayingKaraoke(rec.id);
  };

  const timeAgo = (date: string) => {
    const hrs = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const timeLeft = (date: string) => {
    const expiresAt = new Date(date).getTime() + 24 * 3600000;
    const left = Math.max(0, expiresAt - Date.now());
    const hrs = Math.floor(left / 3600000);
    const mins = Math.floor((left % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  if (loading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading…</div></AppLayout>;
  if (!profile) return <AppLayout><div className="p-6 text-center text-muted-foreground">User not found</div></AppLayout>;

  // Check if currently listening
  const isListening = currentSong && isPlaying;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto pb-24">
        {/* Profile Header */}
        <div className="glass-card p-6 text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-2xl font-serif font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">{profile.username}</h2>
          {profile.kingschat_handle && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
              <AtSign className="w-3.5 h-3.5" />{profile.kingschat_handle}
            </p>
          )}
        </div>

        {/* Recently Played */}
        {recentTracks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recently Played</h3>
            </div>
            <div className="space-y-2">
              {recentTracks.map((track, i) => (
                <div key={`${track.song_id}-${i}`} className="glass-card p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(track.played_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Karaoke Recordings */}
        {karaoke.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">My Karaoke</h3>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Live for 24h
              </span>
            </div>
            <div className="space-y-2">
              {karaoke.map(rec => (
                <div key={rec.id} className="glass-card p-3 flex items-center gap-3">
                  <button onClick={() => playKaraokeClip(rec)} className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                    {playingKaraoke === rec.id ? <Pause className="w-4 h-4 text-gold" /> : <Play className="w-4 h-4 text-gold ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{rec.song_title}</p>
                    <p className="text-[10px] text-muted-foreground">{timeLeft(rec.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PublicProfile;
