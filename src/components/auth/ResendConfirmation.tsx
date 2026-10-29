import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { confirmRedirectUrl, resendWaitSeconds } from "@/lib/emailLink";

const inputCls = "w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

interface Props {
  email?: string;
  /** Show an email box (when we don't know the address). */
  askEmail?: boolean;
  /** Start with a wait (a link was just sent). */
  initialWait?: number;
}

/** "Send a new confirmation email" button with a countdown, so people don't spam sign-up. */
const ResendConfirmation = ({ email: initialEmail = "", askEmail = false, initialWait = 0 }: Props) => {
  const [email, setEmail] = useState(initialEmail);
  const [wait, setWait] = useState(initialWait);
  const [sending, setSending] = useState(false);

  useEffect(() => { setEmail(initialEmail); }, [initialEmail]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    const address = email.trim();
    if (!address) return toast.error("Enter your email");
    setSending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: address, options: { emailRedirectTo: confirmRedirectUrl() } });
    setSending(false);
    if (error) {
      if ((error as any).status === 429 || /after \d+ seconds/i.test(error.message)) {
        setWait(resendWaitSeconds(error.message));
        return toast.error("Please wait a moment before asking for another email.");
      }
      return toast.error(error.message);
    }
    setWait(60);
    toast.success("A new confirmation email is on its way. Use the link in the newest email.");
  };

  return (
    <div className="space-y-3">
      {askEmail && (
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} aria-label="Email" />
      )}
      <button
        type="button"
        onClick={resend}
        disabled={sending || wait > 0}
        className="w-full py-3 rounded-lg border border-gold/40 bg-gold/10 text-gold font-semibold hover:bg-gold/20 transition-colors disabled:opacity-50"
      >
        {sending ? "Sending…" : wait > 0 ? `Resend email in ${wait}s` : "Resend confirmation email"}
      </button>
    </div>
  );
};

export default ResendConfirmation;
