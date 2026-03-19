import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const NotificationCenter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: notifications } = useQuery({
    queryKey: ["user-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*, notification:notifications(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("user_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("user_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("is_read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markRead.mutate(n.id);
    setSelectedNotification(n);
  };

  const handleActionUrl = (url: string) => {
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeepLink = (link: string) => {
    setSelectedNotification(null);
    setOpen(false);
    navigate(link);
  };

  if (!user) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} className="text-xs">
                <Check className="w-3 h-3 mr-1" /> Mark all read
              </Button>
            )}
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
            {!notifications?.length ? (
              <p className="text-center text-muted-foreground py-12 text-sm">No notifications yet</p>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    n.is_read ? "bg-muted/30" : "bg-primary/5 border border-primary/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{n.notification?.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.notification?.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {n.notification?.image_url && (
                      <img src={n.notification.image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedNotification} onOpenChange={(v) => !v && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.notification?.title}</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              {selectedNotification && new Date(selectedNotification.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedNotification?.notification?.image_url && (
            <img
              src={selectedNotification.notification.image_url}
              alt=""
              className="w-full max-h-48 object-cover rounded-lg"
            />
          )}
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {selectedNotification?.notification?.message}
          </p>
          <div className="flex gap-2 pt-2">
            {selectedNotification?.notification?.action_url && (
              <Button size="sm" onClick={() => handleActionUrl(selectedNotification.notification.action_url)}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open Link
              </Button>
            )}
            {selectedNotification?.notification?.deep_link && (
              <Button size="sm" variant="outline" onClick={() => handleDeepLink(selectedNotification.notification.deep_link)}>
                Open in App
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationCenter;
