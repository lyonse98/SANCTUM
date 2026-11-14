import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { PRINT_SERIF } from '@/lib/print';
import { fetchReflection } from '@/lib/reflection';
import { isoDate } from '@/lib/readingsBundle';
import { readTailorMeta } from '@/lib/tailor';
import {
  gratitudeForDate,
  honestLookLine,
  loadTonightResolve,
  saintLine,
  saveTonightResolve,
  tailorEchoLine,
} from '@/lib/tonight';
import type { Audience, PersonaTheme } from '@/types';

interface TonightClosingProps {
  t: PersonaTheme;
  audience: Audience;
}

/**
 * Tonight — the day's closing on Today (Erik's ruling, Nov 12, 2026). The
 * Examen retired as an on-screen tool: its movements — gratitude, one honest
 * look, one resolve — are the SHAPE of this section, not a labeled checklist.
 * Everything here is composed on the device from pieces the day already
 * carried (the morning's challenge, today's saint, the tailored devotional's
 * stated focus). Nothing is checked, streaked, or scored; the section reads
 * in under thirty seconds. The one thing it keeps is tomorrow's resolve,
 * written by the user's own hand and stored on this device only. Stage 1 of
 * the printed-page re-skin (Nov 14, 2026) sets it as the page's closing
 * section, under a double rule — contents and the resolve input unchanged.
 */
export function TonightClosing({ t, audience }: TonightClosingProps) {
  const [now] = useState(() => new Date());
  const dateKey = isoDate(now);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [resolve, setResolve] = useState<string>(() => {
    const stored = loadTonightResolve();
    return stored && stored.date === dateKey ? stored.text : '';
  });

  // The tailored morning, remembered: read once from the on-device tailor meta.
  const [tailorFocus] = useState(() => readTailorMeta(dateKey, audience)?.focus ?? null);

  useEffect(() => {
    let live = true;
    void fetchReflection(dateKey, audience).then((r) => {
      if (live && r?.challenge) setChallenge(r.challenge);
    });
    return () => {
      live = false;
    };
  }, [dateKey, audience]);

  const onResolveChange = (value: string) => {
    setResolve(value);
    saveTonightResolve(value, now);
  };

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}` }}>
      <div className="flex items-center gap-2.5 mb-3">
        <Moon className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <span
          className="text-sm font-bold uppercase tracking-wide"
          style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
        >
          Tonight
        </span>
      </div>

      <p
        className="text-[13px] italic leading-relaxed mb-2.5"
        style={{ fontFamily: PRINT_SERIF, color: t.text }}
      >
        {gratitudeForDate(dateKey)}
      </p>

      <p
        className="text-xs leading-relaxed mb-2.5"
        style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
      >
        {saintLine(now)}
      </p>

      {tailorFocus && (
        <p
          className="text-xs leading-relaxed mb-2.5"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          {tailorEchoLine(tailorFocus)}
        </p>
      )}

      {challenge && (
        <p
          className="text-xs leading-relaxed mb-3.5"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          {honestLookLine(challenge)}
        </p>
      )}

      <label
        htmlFor="tonight-resolve"
        className="block text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5"
        style={{ color: t.textDim }}
      >
        One resolve for tomorrow
      </label>
      <input
        id="tonight-resolve"
        type="text"
        value={resolve}
        onChange={(e) => onResolveChange(e.target.value)}
        placeholder="One thing, kept small enough to keep."
        className="w-full bg-transparent border-b pb-1.5 text-[13px] leading-relaxed outline-none"
        style={{ fontFamily: PRINT_SERIF, borderColor: `${t.border}99`, color: t.text }}
      />
    </div>
  );
}
