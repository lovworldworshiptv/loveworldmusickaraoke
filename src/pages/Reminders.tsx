import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Bell, Plus, Trash2, Music, X, Search, Play, Clock, AlarmClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { toast } from "sonner";
import { getDownloadedMeta, getDownloadedAudioUrl, type DownloadedTrack } from "@/lib/downloadManager";

interface Reminder {
  id: string;
  title: string;
  song_id: string | null;
  song_title: string | null;
  reminder_date: string;
  reminder_time: string;
  is_active: boolean;
}

const Reminders = () => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [downloadedSongs, setDownloadedSongs] = useState<DownloadedTrack[]>([]);
  const [songSearch, setSongSearch] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedSong, setSelectedSong] = useState<{ id: string; title: string } | null>(null);

  // Active alarm state
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const [alarmAudio, setAlarmAudio] = useState<HTMLAudioElement | null>(null);
  const [snoozed, setSnoozed] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("reminder_date", { ascending: true });
    if (data) setReminders(data as Reminder[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // Load downloaded songs for picker
  const loadDownloaded = async () => {
    const meta = await getDownloadedMeta();
    setDownloadedSongs(meta);
    setShowSongPicker(true);
  };

  // Check for due reminders every 30s
  useEffect(() => {
    if (!reminders.length) return;
    const check = () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5);
      for (const r of reminders) {
        if (r.reminder_date === todayStr && r.reminder_time.slice(0, 5) === timeStr && r.is_active) {
          triggerAlarm(r);
          break;
        }
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [reminders]);

  const triggerAlarm = async (r: Reminder) => {
    setActiveAlarm(r);
    // Try to play the downloaded song
    if (r.song_id) {
      try {
        const url = await getDownloadedAudioUrl(r.song_id);
        if (url) {
          const audio = new Audio(url);
          audio.loop = true;
          audio.play().catch(() => {});
          setAlarmAudio(audio);
        }
      } catch {}
    }
    // Also send browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(r.title, { body: r.song_title ? `♪ ${r.song_title}` : "Time for prayer & study!", icon: "/launchericon-192x192.png" });
    }
  };

  const stopAlarm = async () => {
    alarmAudio?.pause();
    setAlarmAudio(null);
    if (activeAlarm) {
      await (supabase as any).from("reminders").update({ is_active: false }).eq("id", activeAlarm.id);
      setReminders(prev => prev.filter(r => r.id !== activeAlarm.id));
    }
    setActiveAlarm(null);
    setSnoozed(false);
  };

  const snoozeAlarm = () => {
    alarmAudio?.pause();
    setAlarmAudio(null);
    setSnoozed(true);
    // Snooze 5 minutes
    setTimeout(() => {
      if (activeAlarm) triggerAlarm(activeAlarm);
      setSnoozed(false);
    }, 5 * 60 * 1000);
    toast.info("Snoozed for 5 minutes");
    setActiveAlarm(null);
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !date || !time) {
      toast.error("Please fill in title, date and time");
      return;
    }
    const { error } = await (supabase as any).from("reminders").insert({
      user_id: user.id,
      title: title.trim(),
      song_id: selectedSong?.id || null,
      song_title: selectedSong?.title || null,
      reminder_date: date,
      reminder_time: time,
    });
    if (error) { toast.error("Failed to save reminder"); return; }
    toast.success("Reminder set!");
    setTitle(""); setDate(""); setTime(""); setSelectedSong(null); setShowForm(false);
    fetchReminders();
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success("Reminder deleted");
  };

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AlarmClock className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-serif font-bold text-foreground">Reminders</h2>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-full gradient-gold text-primary-foreground text-sm font-semibold">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        {/* Alarm Modal */}
        {activeAlarm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-md">
            <div className="glass-card p-8 max-w-sm w-[calc(100%-2rem)] text-center animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Bell className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">{activeAlarm.title}</h3>
              {activeAlarm.song_title && (
                <p className="text-sm text-muted-foreground mb-6">♪ {activeAlarm.song_title}</p>
              )}
              <div className="flex gap-3 justify-center">
                <button onClick={snoozeAlarm} className="px-6 py-2.5 rounded-full bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors">
                  Snooze 5m
                </button>
                <button onClick={stopAlarm} className="px-6 py-2.5 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors">
                  Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Reminder Form */}
        {showForm && (
          <div className="glass-card p-5 mb-6 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-serif font-bold text-foreground">New Reminder</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text" placeholder="Reminder title (e.g. Morning Prayer)"
                value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Song selection */}
              <div>
                {selectedSong ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border">
                    <Music className="w-4 h-4 text-gold flex-shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{selectedSong.title}</span>
                    <button onClick={() => setSelectedSong(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={loadDownloaded}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-solid transition-colors"
                  >
                    <Music className="w-4 h-4" />
                    {isPremium ? "Pick a downloaded song" : "Premium: Pick a downloaded song"}
                  </button>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={!title.trim() || !date || !time}
                className="w-full py-2.5 rounded-lg gradient-gold text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Set Reminder
              </button>
            </div>
          </div>
        )}

        {/* Song Picker Modal */}
        {showSongPicker && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowSongPicker(false)} />
            <div className="relative w-full max-w-md max-h-[70vh] glass-card rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-base font-serif font-bold text-foreground">Pick Downloaded Song</h3>
                <button onClick={() => setShowSongPicker(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Search downloads..." value={songSearch} onChange={e => setSongSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
                {downloadedSongs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No downloaded songs. Download premium songs first.</p>
                ) : (
                  downloadedSongs
                    .filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.artist.toLowerCase().includes(songSearch.toLowerCase()))
                    .map(song => (
                      <button key={song.id} onClick={() => { setSelectedSong({ id: song.id, title: song.title }); setShowSongPicker(false); setSongSearch(""); }}
                        className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Music className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reminders List */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : reminders.length === 0 ? (
          <div className="text-center py-12">
            <AlarmClock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No reminders set yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create one to never miss prayer time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reminders.map(r => {
              const dateObj = new Date(`${r.reminder_date}T${r.reminder_time}`);
              const isPast = dateObj < new Date();
              return (
                <div key={r.id} className={`glass-card p-4 flex items-center gap-3 ${isPast ? "opacity-50" : ""}`}>
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.reminder_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {r.reminder_time.slice(0, 5)}
                    </p>
                    {r.song_title && (
                      <p className="text-xs text-gold mt-0.5 truncate">♪ {r.song_title}</p>
                    )}
                  </div>
                  <button onClick={() => deleteReminder(r.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Reminders;
