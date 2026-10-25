import { useState } from "react";
import { BookOpenCheck, CalendarDays, ChevronRight, Headphones, Minus, Plus, Type, Quote, HandHeart, BookMarked, Smartphone } from "lucide-react";
import { formatDevotionalDate, type RhapsodyDevotional } from "@/lib/rhapsodyDaily";
import { SETTING_KEYS, useSetting, rhapsodyCtaLink, type RhapsodyAppCta } from "@/lib/siteSettings";

interface CardProps {
  devotional: RhapsodyDevotional | null;
  loading: boolean;
  onOpen: (listen?: boolean) => void;
}

/** Featured "Rhapsody Daily" section at the top of the Articles page. */
export function RhapsodyDailyCard({ devotional, loading, onOpen }: CardProps) {
  const cta = useSetting<RhapsodyAppCta>(SETTING_KEYS.rhapsodyAppCta);
  const ctaLink = rhapsodyCtaLink(cta, typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!devotional) {
    if (!loading) return null;
    return (
      <section className="mb-8" aria-label="Rhapsody Daily">
        <div className="h-6 w-40 rounded-full bg-muted/40 animate-pulse mb-3" />
        <div className="h-56 rounded-3xl bg-muted/40 animate-pulse" />
      </section>
    );
  }
  const d = devotional;
  return (
    <section className="mb-8" aria-label="Rhapsody Daily">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-xl font-serif font-bold text-foreground">
          <BookOpenCheck className="w-5 h-5 text-gold" /> Rhapsody Daily
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gold bg-gold/10 px-2.5 py-1 rounded-full">
          <CalendarDays className="w-3.5 h-3.5" /> {formatDevotionalDate(d.date)}
        </span>
      </div>

      <div className="glass-card rhapsody-card rounded-3xl overflow-hidden border border-gold/40 glow-gold flex flex-col md:flex-row">
        {d.imageUrl && (
          <button onClick={() => onOpen()} className="md:w-2/5 aspect-[16/10] md:aspect-auto overflow-hidden group" aria-label={`Read ${d.title}`}>
            <img src={d.imageUrl} alt={d.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          </button>
        )}
        <div className="p-5 lg:p-6 flex-1 flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold mb-2">Rhapsody of Realities</p>
          <h4 className="text-2xl font-serif font-bold text-foreground leading-tight mb-3">{d.title}</h4>
          {d.openingScripture && (
            <p className="text-sm font-serif italic text-foreground/90 border-l-2 border-gold pl-3 mb-4 line-clamp-4">
              {d.openingScripture}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button onClick={() => onOpen()} className="gradient-gold text-primary-foreground text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5">
              Read Today's Devotional <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {d.audioUrl && (
              <button onClick={() => onOpen(true)} className="group/listen bg-secondary/60 text-foreground text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-colors hover:gradient-gold hover:text-primary-foreground">
                <Headphones className="w-3.5 h-3.5 text-gold group-hover/listen:text-primary-foreground" /> Listen
              </button>
            )}
            {ctaLink && (
              <a href={ctaLink} target="_blank" rel="noopener noreferrer"
                className="border border-gold/60 text-gold text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-1.5 hover:gradient-gold hover:text-primary-foreground hover:border-transparent transition-colors">
                <Smartphone className="w-3.5 h-3.5" /> {cta!.label}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface ReaderProps {
  devotional: RhapsodyDevotional;
  autoListen?: boolean;
  onBack: () => void;
}

/** Full-page reader for today's devotional. */
export function RhapsodyDailyReader({ devotional: d, autoListen, onBack }: ReaderProps) {
  const [fontSize, setFontSize] = useState(18);
  const [audioFailed, setAudioFailed] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
        ← Back to Articles
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground gradient-gold px-2.5 py-1 rounded-full">Rhapsody Daily</span>
        <span className="text-[11px] font-medium text-foreground">{formatDevotionalDate(d.date)}</span>
      </div>

      {d.imageUrl && (
        <div className="w-full aspect-[16/9] rounded-3xl overflow-hidden mb-6 shadow-2xl">
          <img src={d.imageUrl} alt={d.title} className="w-full h-full object-cover" />
        </div>
      )}

      <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-5 leading-tight tracking-tight">{d.title}</h1>

      {d.audioUrl && !audioFailed && (
        <div className="glass-card rounded-2xl p-3 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center flex-shrink-0">
            <Headphones className="w-4 h-4 text-primary-foreground" />
          </div>
          <audio src={d.audioUrl} controls preload="none" autoPlay={autoListen} onError={() => setAudioFailed(true)} className="w-full h-10" />
        </div>
      )}

      {d.openingScripture && (
        <blockquote className="relative rounded-2xl border border-gold/40 bg-gold/10 p-5 mb-6">
          <Quote className="absolute -top-3 left-4 w-6 h-6 text-gold bg-background rounded-full p-1" />
          <p className="font-serif italic text-foreground leading-relaxed" style={{ fontSize: `${Math.max(15, fontSize - 1)}px` }}>
            {d.openingScripture}
          </p>
        </blockquote>
      )}

      <div className="flex items-center gap-2 mb-6 rounded-full glass-card px-3 py-1.5 w-fit">
        <Type className="w-4 h-4 text-gold" />
        <button aria-label="Smaller text" onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="text-foreground hover:text-gold p-1.5 rounded-full hover:bg-gold/10 transition-colors">
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-xs text-foreground font-semibold w-8 text-center tabular-nums">{fontSize}</span>
        <button aria-label="Larger text" onClick={() => setFontSize(Math.min(28, fontSize + 2))} className="text-foreground hover:text-gold p-1.5 rounded-full hover:bg-gold/10 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <article
        className="font-serif text-foreground mb-8 max-w-[65ch] [&_p]:mb-5 [&_a]:text-gold [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-bold [&_i]:italic [&_em]:italic"
        style={{ fontSize: `${fontSize}px`, lineHeight: "1.9" }}
        dangerouslySetInnerHTML={{ __html: d.bodyHtml }}
      />

      {d.prayer && (
        <section className="rounded-2xl gradient-gold p-[1px] mb-6">
          <div className="rounded-2xl bg-background/95 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold mb-2">
              <HandHeart className="w-4 h-4" /> {d.prayerLabel}
            </h2>
            <p className="font-serif text-foreground leading-relaxed" style={{ fontSize: `${fontSize}px` }}>{d.prayer}</p>
          </div>
        </section>
      )}

      {d.furtherStudy && (
        <section className="glass-card rounded-2xl p-5 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gold mb-2">
            <BookMarked className="w-4 h-4" /> {d.furtherStudyTitle}
          </h2>
          <p className="text-foreground font-medium">{d.furtherStudy}</p>
        </section>
      )}

      {(d.oneYear || d.twoYear) && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {d.oneYear && (
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold mb-1">{d.oneYearTitle}</p>
              <p className="text-sm text-foreground font-medium">{d.oneYear}</p>
            </div>
          )}
          {d.twoYear && (
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gold mb-1">{d.twoYearTitle}</p>
              <p className="text-sm text-foreground font-medium">{d.twoYear}</p>
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        Source: <a href="https://read.rhapsodyofrealities.org/" target="_blank" rel="noopener noreferrer" className="text-gold underline">Rhapsody of Realities</a>
      </p>
      <div className="h-8" />
    </div>
  );
}
