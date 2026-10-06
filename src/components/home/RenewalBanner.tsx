import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, X } from "lucide-react";

/** Gentle in-app renewal reminder shown on Home when Premium/Trial expires within 7 days. */
const RenewalBanner = () => {
  const { user } = useAuth();
  const [days, setDays] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) { setDays(null); return; }
    supabase.from("user_subscriptions").select("subscription, subscription_expiry_date").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data || !(data.subscription === "premium" || data.subscription === "trial") || !data.subscription_expiry_date) { setDays(null); return; }
        const expiry = new Date(data.subscription_expiry_date).getTime();
        const d = Math.floor((expiry - Date.now()) / 86400000);
        setDays(d >= 0 && d <= 7 ? d : null);
      });
  }, [user]);

  useEffect(() => {
    const key = `renewal_banner_dismissed_${new Date().toISOString().slice(0, 10)}`;
    setDismissed(localStorage.getItem(key) === "1");
  }, []);

  if (days === null || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(`renewal_banner_dismissed_${new Date().toISOString().slice(0, 10)}`, "1");
    setDismissed(true);
  };

  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

  return (
    <div className="px-4 md:px-8 mb-2">
      <div className="glass-card rounded-2xl border-gold/30 px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4 text-gold" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Your Premium access ends {when}</p>
          <p className="text-xs text-foreground/70 truncate">Renew now to keep offline downloads and premium features.</p>
        </div>
        <Link to="/subscription" className="shrink-0 rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] text-white text-xs font-semibold px-4 py-2">
          Renew now
        </Link>
        <button onClick={dismiss} aria-label="Dismiss reminder" className="p-1.5 rounded-full hover:bg-muted text-foreground/60 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default RenewalBanner;
