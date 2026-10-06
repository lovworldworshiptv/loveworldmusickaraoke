import { useEffect, useState } from "react";
import { ShieldCheck, ShieldMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ModeratorUser { user_id: string; username: string; avatar_url: string | null; is_moderator: boolean }

export default function CommunityModeratorsDialog({ community, onClose }: {
  community: { id: string; name: string } | null; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ModeratorUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setQuery(""); setUsers([]); }, [community?.id]);
  useEffect(() => {
    if (!community) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_community_moderators", { p_community_id: community.id, p_query: query.trim() });
      if (cancelled) return;
      setLoading(false);
      if (error) { setUsers([]); toast.error("Could not load moderators"); return; }
      setUsers(data || []);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [community?.id, query, refresh]);
  const toggle = async (person: ModeratorUser) => {
    if (!community || busy) return;
    setBusy(person.user_id);
    const { error } = await supabase.rpc("set_community_moderator", { p_community_id: community.id, p_user_id: person.user_id, p_enabled: !person.is_moderator });
    setBusy(null);
    if (error) { toast.error("Could not update moderator"); return; }
    toast.success(person.is_moderator ? "Moderator removed" : "Moderator appointed");
    setRefresh((value) => value + 1);
  };
  return <Dialog open={!!community} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="community-page glass-card border-gold/20 rounded-2xl">
      <DialogHeader><DialogTitle>Moderators · {community?.name}</DialogTitle></DialogHeader>
      <Input aria-label="Search users for moderator" placeholder="Search by username…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading ? <p className="text-sm text-foreground">Loading…</p> : users.length === 0 ? <p className="text-sm text-foreground">{query.trim().length >= 2 ? "No users found." : "No moderators appointed."}</p> : users.map((person) => <div key={person.user_id} className="flex items-center gap-3 py-2">
          {person.avatar_url && <img src={person.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />}
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground break-words">{person.username}</p>{person.is_moderator && <p className="text-xs text-foreground">Moderator</p>}</div>
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => toggle(person)}>
            {person.is_moderator ? <ShieldMinus className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{person.is_moderator ? "Remove" : "Appoint"}
          </Button>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}