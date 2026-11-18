import { useEffect, useMemo, useState } from 'react';
import { Church, ExternalLink, Loader2 } from 'lucide-react';
import { COME_HOME_DAYS } from '@/data/comeHome';
import { comeHomeDayIndex } from '@/lib/comeHome';
import { fetchReadingsBundle } from '@/lib/readingsBundle';
import { fetchDailyReadings } from '@/lib/readings';
import { fetchPassageVerses } from '@/lib/bible';
import { pickKeyVerse, type KeyVerse } from '@/lib/keyVerse';
import { contentDate } from '@/lib/dayBoundary';
import { CrisisLine } from '@/components/CrisisLine';
import { SeasonBackdrop } from '@/components/SeasonBackdrop';
import { PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme } from '@/types';

interface ComeHomePageProps {
  t: PersonaTheme;
  accent: string;
  /** Leaves the door and enters the app the ordinary way — through the gate. */
  onEnterApp: () => void;
}

interface GospelFace {
  citation: string;
  keyVerse: KeyVerse | null;
  fullText: string | null;
}

/**
 * The come-home door (Erik, Nov 18, 2026): the surface a bare
 * ?comehome=1 link opens — before the welcome gate, with no track
 * choice asked and nothing to sign. Seven days, keyed to the days
 * since this device first opened the door: each day carries one short
 * static welcome and that day's actual Gospel, and the seventh closes
 * with the way onward — a parish, and the app itself. The privacy
 * shape is the feature: no analytics event fires from this surface,
 * nothing is stored anywhere but this device, and there is no sender
 * to report anything to — the link is identical for everyone.
 */
export function ComeHomePage({ t, accent, onEnterApp }: ComeHomePageProps) {
  // The day's place in the arc is settled at first sight; the first
  // open is the only thing this surface ever records, on-device only.
  const [dayIndex] = useState(() => comeHomeDayIndex());
  const day = COME_HOME_DAYS[dayIndex];
  const isLastDay = dayIndex === COME_HOME_DAYS.length - 1;

  const [gospel, setGospel] = useState<GospelFace | null>(null);
  const [gospelLoading, setGospelLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // The same readings machinery Today uses: the server-assembled
      // bundle first, the direct path behind it.
      const bundle = await fetchReadingsBundle(contentDate());
      if (!active) return;
      if (bundle?.citations.gospel) {
        setGospel({
          citation: bundle.citations.gospel,
          keyVerse: bundle.gospelVerses ? pickKeyVerse(bundle.gospelVerses) : null,
          fullText: bundle.texts.gospel?.text ?? null,
        });
        setGospelLoading(false);
        return;
      }
      const citations = await fetchDailyReadings(contentDate());
      if (!active) return;
      if (citations?.gospel) {
        const verses = await fetchPassageVerses(citations.gospel);
        if (!active) return;
        setGospel({
          citation: citations.gospel,
          keyVerse: verses ? pickKeyVerse(verses) : null,
          fullText: verses ? verses.verses.map((v) => v.text).join(' ') : null,
        });
      }
      if (active) setGospelLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const dayLabel = useMemo(() => `Day ${dayIndex + 1} of ${COME_HOME_DAYS.length}`, [dayIndex]);

  return (
    <div className="fixed inset-0 overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <SeasonBackdrop />
      <div
        className="relative z-10 min-h-full flex flex-col items-center px-5 py-8 pb-16 max-w-2xl mx-auto"
        style={{
          backgroundColor: t.card,
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <div className="w-full text-center mb-6">
          <Church className="w-5 h-5 mx-auto mb-2" style={{ color: accent }} strokeWidth={2.2} aria-hidden="true" />
          <p
            className="text-[12px] font-bold uppercase tracking-[0.22em] mb-1"
            style={{ fontFamily: PRINT_SERIF, color: accent }}
          >
            Sanctum
          </p>
          <p className="text-[13px]" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            Someone thought you might like to see this.
          </p>
          <p
            data-come-home-day
            className="text-[12px] font-bold uppercase tracking-[0.18em] mt-3"
            style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
          >
            {dayLabel}
          </p>
        </div>

        {/* The day's welcome — static words, written for this door. */}
        <div className="w-full mb-6" data-come-home-welcome>
          <h1
            className="text-[22px] leading-tight text-center mb-4"
            style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
          >
            {day.title}
          </h1>
          <p
            className="italic leading-relaxed text-center mb-1.5"
            style={{ fontFamily: PRINT_SERIF, color: t.text, fontSize: 15 }}
          >
            &ldquo;{day.scripture}&rdquo;
          </p>
          <p className="text-[12px] uppercase tracking-widest font-bold text-center mb-4" style={{ color: t.textDim }}>
            {day.citation}
          </p>
          <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted, fontSize: 15 }}>
            {day.body}
          </p>
        </div>

        {/* Today's Gospel — the day's actual Gospel, the same one the
            whole Church hears today. */}
        <div
          className="w-full pt-5 mb-6"
          style={{ borderTop: `1px solid ${t.border}` }}
          data-come-home-gospel
        >
          <p
            className="text-[12px] font-bold uppercase tracking-[0.2em] mb-3"
            style={{ fontFamily: PRINT_SERIF, color: accent }}
          >
            Today&rsquo;s Gospel{gospel ? ` · ${gospel.citation}` : ''}
          </p>
          {gospelLoading && (
            <div className="flex items-center gap-2" style={{ color: t.textDim }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[12px]">Loading today&rsquo;s Gospel&hellip;</span>
            </div>
          )}
          {!gospelLoading && gospel?.keyVerse && (
            <p className="italic leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: t.textBright, fontSize: 15 }}>
              &ldquo;{gospel.keyVerse.text}&rdquo;
            </p>
          )}
          {!gospelLoading && gospel?.fullText && (
            <p className="leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.text, fontSize: 14 }}>
              {gospel.fullText}
            </p>
          )}
          {!gospelLoading && !gospel && (
            <p className="text-[13px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
              Today&rsquo;s Gospel could not be loaded just now — the welcome above is the day&rsquo;s word.
            </p>
          )}
        </div>

        {/* The seventh day's way onward — a parish, and the app itself. */}
        {isLastDay && (
          <div className="w-full space-y-2 mb-6" data-come-home-onward>
            <a
              href="https://discovermass.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60"
              style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.textBright }}
            >
              <Church className="w-4 h-4" style={{ color: accent }} />
              <span className="text-[13px] font-semibold" style={{ fontFamily: PRINT_SERIF }}>
                Find a parish near you
              </span>
              <ExternalLink className="w-3 h-3" style={{ color: t.textDim }} />
            </a>
            <button
              onClick={onEnterApp}
              className="w-full min-h-[48px] flex items-center justify-center px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60"
              style={{ backgroundColor: accent, borderColor: accent, color: '#fff' }}
            >
              <span className="text-[13px] font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF }}>
                Enter Sanctum
              </span>
            </button>
            <p className="text-[13px] text-center leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
              Sanctum is a daily Gospel, a short reflection, and companions for the road — free, and
              nothing you write is stored on a server. Real Help — priests, directors, therapists —
              waits inside, one tap from the home page.
            </p>
          </div>
        )}

        {/* The door is never locked behind anyone: the app is one tap
            away on every day, not only the last. */}
        {!isLastDay && (
          <button
            onClick={onEnterApp}
            className="mb-6 text-[13px] underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-70"
            style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
          >
            Just take me to the app
          </button>
        )}
        {isLastDay && (
          <p className="mb-6 text-[13px] text-center" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            Come back tomorrow, or any day. This page will be here.
          </p>
        )}

        <CrisisLine muted={t.textMuted} bright={t.textBright} className="mt-auto" />
      </div>
    </div>
  );
}
