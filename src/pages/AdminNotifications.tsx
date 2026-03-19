import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";

const AdminNotifications = () => {
  const { session } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [segment, setSegment] = useState("all");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body: any = { title, message, segment };
      if (imageUrl) body.image_url = imageUrl;
      if (deepLink) body.deep_link = deepLink;
      if (actionUrl) body.action_url = actionUrl;
      if (scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString();

      const { data, error } = await supabase.functions.invoke("send-notification", {
        body,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(scheduledAt ? "Notification scheduled!" : "Notification sent!");
      setTitle("");
      setMessage("");
      setImageUrl("");
      setDeepLink("");
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
    onError: (err: any) => {
      toast.error("Failed: " + (err.message || "Unknown error"));
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "scheduled": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Loader2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (!isAdmin) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Send Notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            <ImageUploadPicker bucket="notification-images" label="Notification Image (optional)" value={imageUrl} onChange={setImageUrl} />
            <Input placeholder="Deep Link (optional, e.g. /albums)" value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />

            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Audience</label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="free">Free Users</SelectItem>
                    <SelectItem value="premium">Premium Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Schedule (optional)</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            </div>

            <Button onClick={() => sendMutation.mutate()} disabled={!title || !message || sendMutation.isPending} className="w-full">
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : scheduledAt ? (
                <Clock className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {scheduledAt ? "Schedule Notification" : "Send Now"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : !notifications?.length ? (
              <div className="text-center py-8 text-muted-foreground">No notifications sent yet</div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n: any) => (
                  <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {statusIcon(n.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{n.title}</p>
                        <Badge variant="outline" className="text-[10px]">{n.segment}</Badge>
                        <Badge variant={n.status === "sent" ? "default" : n.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                          {n.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {n.sent_at ? `Sent: ${new Date(n.sent_at).toLocaleString()}` : n.scheduled_at ? `Scheduled: ${new Date(n.scheduled_at).toLocaleString()}` : new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminNotifications;
