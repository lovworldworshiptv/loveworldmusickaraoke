import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { initEngine, stopEngine } from "@/lib/secureDownloads/engine";
import { registerSignOutPrompt } from "@/lib/secureDownloads/signOutPrompt";
import { formatBytes } from "@/lib/secureDownloads/policy";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DevicesDialog from "./DevicesDialog";

/** Starts the offline download engine for the signed-in listener and handles device and sign-out prompts. */
const SecureDownloadsBoot = () => {
  const { user, loading } = useAuth();
  const { waitingFor, items } = useSecureDownloads();
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [askSignOut, setAskSignOut] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) initEngine(user.id).catch(() => undefined);
    else stopEngine();
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => initEngine(user.id).catch(() => undefined), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => { if (waitingFor === "device_limit") setDevicesOpen(true); }, [waitingFor]);

  useEffect(() => {
    const onRevoked = () => toast.info("This device was removed from your account, so its offline songs were cleared.");
    window.addEventListener("lmk-offline-device-revoked", onRevoked);
    return () => window.removeEventListener("lmk-offline-device-revoked", onRevoked);
  }, []);

  useEffect(() => {
    registerSignOutPrompt(() => new Promise<boolean>((resolve) => { answer.current = resolve; setAskSignOut(true); }));
    return () => registerSignOutPrompt(null);
  }, []);
  const close = (ok: boolean) => { answer.current?.(ok); answer.current = null; setAskSignOut(false); };

  const ready = items.filter((i) => i.status === "ready");
  const bytes = ready.reduce((n, i) => n + i.packages.reduce((m, p) => m + p.byteLength, 0), 0);

  return (
    <>
      <DevicesDialog open={devicesOpen} onOpenChange={setDevicesOpen} limitReached={waitingFor === "device_limit"} />
      <AlertDialog open={askSignOut} onOpenChange={(o) => { if (!o) close(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {ready.length
                ? `Your ${ready.length} offline ${ready.length === 1 ? "song" : "songs"} (${formatBytes(bytes)}) will be removed from this device. They stay on your account and come back when you sign in again.`
                : "Songs still saving on this device will stop and be removed. They stay on your account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SecureDownloadsBoot;
