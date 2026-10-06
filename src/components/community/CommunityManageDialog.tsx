import { useEffect, useState } from "react";
import { ShieldCheck, ShieldMinus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Member { user_id: string; username: string; avatar_url: string | null }
interface CommunityLite { id: string; name: string; description: string | null }
type RoleFilter = "all" | "moderators" | "members";

export default function CommunityManageDialog({ community, onClose, onSaved }: {
  community: CommunityLite | null; onClose: () => void;
  onSaved: (id: string, patch: { name?: string; description?: string | null; memberDelta?: number }) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [moderatorIds, setModeratorIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [removing, setRemoving] = useState(false);
  const [modBusy, setModBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!community) return;
    setName(community.name); setDesc(community.description || ""); setSelected(new Set()); setFilter(""); setRoleFilter("all");
    (supabase.rpc as any)("get_community_members_admin", { p_community_id: community.id })
      .then(({ data, error }: any) => { if (error) toast.error("Could not load members"); setMembers(data || []); });
    (supabase.rpc as any)("search_community_moderators", { p_community_id: community.id, p_query: "" })
      .then(({ data }: any) => setModeratorIds(new Set(((data || []) as { user_id: string; is_moderator: boolean }[]).filter((r) => r.is_moderator).map((r) => r.user_id))));
  }, [community?.id]);

  const saveDetails = async () => {
    if (!community || !name.trim()) return;
    setSaving(true);
    const patch = { name: name.trim().slice(0, 80), description: desc.trim().slice(0, 500) || null };
    const { error } = await supabase.from("communities").update(patch).eq("id", community.id);
    setSaving(false);
    if (error) { toast.error("Could not save details"); return; }
    onSaved(community.id, patch);
    toast.success("Community details saved");
  };

  const remove = async (ids: string[]) => {
    if (!community || ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} member${ids.length > 1 ? "s" : ""} from ${community.name}?`)) return;
    setRemoving(true);
    const { data, error } = await supabase.from("community_members").delete().eq("community_id", community.id).in("user_id", ids).select("user_id");
    setRemoving(false);
    if (error) { toast.error("Could not remove members"); return; }
    const gone = new Set((data || []).map((r) => r.user_id));
    setMembers((m) => m.filter((x) => !gone.has(x.user_id)));
    setSelected(new Set());
    onSaved(community.id, { memberDelta: -gone.size });
    toast.success(`Removed ${gone.size} member${gone.size === 1 ? "" : "s"}`);
  };

  const toggleModerator = async (m: Member) => {
    if (!community || modBusy) return;
    const isMod = moderatorIds.has(m.user_id);
    setModBusy(m.user_id);
    const { error } = await supabase.rpc("set_community_moderator", { p_community_id: community.id, p_user_id: m.user_id, p_enabled: !isMod });
    setModBusy(null);
    if (error) { toast.error("Could not update moderator"); return; }
    setModeratorIds((s) => { const n = new Set(s); isMod ? n.delete(m.user_id) : n.add(m.user_id); return n; });
    toast.success(isMod ? "Moderator removed" : "Moderator appointed");
  };

  const q = filter.trim().toLowerCase();
  const shown = members
    .filter((m) => !q || m.username.toLowerCase().includes(q))
    .filter((m) => roleFilter === "all" || (roleFilter === "moderators" ? moderatorIds.has(m.user_id) : !moderatorIds.has(m.user_id)));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const roleChip = (value: RoleFilter, label: string, count: number) => (
    <button key={value} onClick={() => setRoleFilter(value)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${roleFilter === value ? "gradient-gold text-foreground" : "bg-secondary/60 text-foreground hover:bg-secondary"}`}>
      {label} ({count})
    </button>
  );

  return <Dialog open={!!community} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="community-page glass-card border-gold/20 rounded-2xl max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Manage community</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <label className="text-sm text-foreground" htmlFor="cm-name">Name</label>
        <Input id="cm-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <label className="text-sm text-foreground" htmlFor="cm-desc">Description</label>
        <Textarea id="cm-desc" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} rows={3} />
        <Button onClick={saveDetails} disabled={saving || !name.trim()} className="w-full">{saving ? "Saving…" : "Save details"}</Button>
      </div>
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Members ({members.length})</p>
          <Button size="sm" variant="destructive" disabled={selected.size === 0 || removing} onClick={() => remove([...selected])}>
            <UserMinus className="h-4 w-4" /> Remove selected{selected.size ? ` (${selected.size})` : ""}
          </Button>
        </div>
        <Input aria-label="Search members" placeholder="Search members by username…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by role">
          {roleChip("all", "All", members.length)}
          {roleChip("moderators", "Moderators", members.filter((m) => moderatorIds.has(m.user_id)).length)}
          {roleChip("members", "Members", members.filter((m) => !moderatorIds.has(m.user_id)).length)}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {shown.length === 0 ? <p className="text-sm text-foreground">No members match.</p> : shown.map((m) => {
            const isMod = moderatorIds.has(m.user_id);
            return <div key={m.user_id} className="flex items-center gap-3 py-1.5">
              <input type="checkbox" aria-label={`Select ${m.username}`} checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} className="h-4 w-4 accent-[hsl(var(--gold))]" />
              {m.avatar_url && <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground break-words">{m.username}</p>
                {isMod && <p className="text-[11px] text-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Moderator</p>}
              </div>
              <Button size="sm" variant="ghost" className="text-foreground" disabled={!!modBusy} onClick={() => toggleModerator(m)}
                title={isMod ? "Remove moderator" : "Appoint as moderator"} aria-label={`${isMod ? "Remove moderator" : "Appoint moderator"} ${m.username}`}>
                {isMod ? <ShieldMinus className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" className="text-foreground" disabled={removing} onClick={() => remove([m.user_id])} aria-label={`Remove ${m.username}`}><UserMinus className="h-4 w-4" /></Button>
            </div>;
          })}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
