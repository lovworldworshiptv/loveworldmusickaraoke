import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { initEngine, stopEngine } from "@/lib/secureDownloads/engine";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import DevicesDialog from "./DevicesDialog";

/** Starts the offline download engine for the signed-in listener and handles device prompts. */
const SecureDownloadsBoot = () => {
  const { user, loading } = useAuth();
  const { waitingFor } = useSecureDownloads();
  const [devicesOpen, setDevicesOpen] = useState(false);

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

  return <DevicesDialog open={devicesOpen} onOpenChange={setDevicesOpen} limitReached={waitingFor === "device_limit"} />;
};

export default SecureDownloadsBoot;
