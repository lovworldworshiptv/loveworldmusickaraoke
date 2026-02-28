import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface PopupData {
  enabled: boolean;
  delay_seconds: number;
  show_frequency: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_position: string;
  primary_button_text: string | null;
  primary_button_url: string | null;
  primary_button_new_tab: boolean;
  secondary_button_text: string | null;
  secondary_button_url: string | null;
  secondary_button_new_tab: boolean;
  bg_color: string | null;
  text_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
  border_radius: string | null;
  max_width: string | null;
}

const STORAGE_KEY = "homepage_popup_last_shown";

function shouldShow(frequency: string): boolean {
  const last = localStorage.getItem(STORAGE_KEY);
  if (!last) return true;
  if (frequency === "every_visit") return true;
  if (frequency === "once_per_session") {
    return !sessionStorage.getItem(STORAGE_KEY);
  }
  if (frequency === "once_per_day") {
    const lastDate = new Date(last).toDateString();
    return lastDate !== new Date().toDateString();
  }
  return true;
}

function markShown(frequency: string) {
  const now = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, now);
  if (frequency === "once_per_session") {
    sessionStorage.setItem(STORAGE_KEY, now);
  }
}

const HomepagePopup = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase
      .from("homepage_popup")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPopup(data as unknown as PopupData);
      });
  }, []);

  useEffect(() => {
    if (!popup?.enabled) return;
    if (!shouldShow(popup.show_frequency)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      markShown(popup.show_frequency);
    }, (popup.delay_seconds || 2) * 1000);
    return () => clearTimeout(timer);
  }, [popup]);

  const close = () => setVisible(false);

  if (!visible || !popup) return null;

  const isBackground = popup.image_position === "background" && popup.image_url;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={close}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full overflow-hidden shadow-2xl animate-fade-in-up"
        style={{
          maxWidth: popup.max_width || "480px",
          borderRadius: popup.border_radius || "16px",
          backgroundColor: isBackground ? "transparent" : (popup.bg_color || "#1a1a2e"),
          color: popup.text_color || "#ffffff",
        }}
      >
        {/* Background image */}
        {isBackground && popup.image_url && (
          <div className="absolute inset-0">
            <img src={popup.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundColor: `${popup.bg_color || "#1a1a2e"}cc` }} />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top banner image */}
        {popup.image_position === "top" && popup.image_url && (
          <img src={popup.image_url} alt="" className="w-full h-48 object-cover" />
        )}

        {/* Content */}
        <div className="relative z-[1] p-6 space-y-4">
          {popup.title && (
            <h2 className="text-xl font-serif font-bold leading-tight">{popup.title}</h2>
          )}
          {popup.description && (
            <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{popup.description}</p>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            {popup.primary_button_text && popup.primary_button_url && (
              <a
                href={popup.primary_button_url}
                target={popup.primary_button_new_tab ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: popup.button_color || "#d4af37",
                  color: popup.button_text_color || "#000000",
                }}
              >
                {popup.primary_button_text}
              </a>
            )}
            {popup.secondary_button_text && popup.secondary_button_url && (
              <a
                href={popup.secondary_button_url}
                target={popup.secondary_button_new_tab ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm border transition-opacity hover:opacity-80"
                style={{
                  borderColor: popup.button_color || "#d4af37",
                  color: popup.text_color || "#ffffff",
                }}
              >
                {popup.secondary_button_text}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepagePopup;
