import { useState } from 'react';
import { PRINT_SERIF } from '@/lib/print';
import { loadDaysPrayed } from '@/lib/daysPrayed';
import type { PersonaTheme } from '@/types';

interface DaysPrayedMarkProps {
  t: PersonaTheme;
}

/**
 * The days-prayed mark (Play 1b, retention build Nov 16, 2026): one quiet
 * line on Today — a small flame beside the cumulative count of days
 * prayed. The count comes whole from the tally lib and only ever grows;
 * this mark adds nothing to it and keeps nothing of its own. The flame
 * speaks for today only: filled in the day's accent when today already
 * counts, a muted outline when it does not yet. There is no history
 * here, and nothing about any other day.
 */
export function DaysPrayedMark({ t }: DaysPrayedMarkProps) {
  const [{ totalDays, prayedToday }] = useState(() => loadDaysPrayed());

  return (
    <p
      data-days-prayed-mark
      className="flex items-center justify-center gap-1.5 text-[12px]"
      style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5 flex-shrink-0"
        aria-hidden="true"
        data-flame-lit={prayedToday}
      >
        <path
          d="M12 2.5c.8 3.8-3.8 5.9-3.8 9.7a3.8 3.8 0 0 0 7.6 0c0-1.9-.9-3.2-1.9-4.7-.2 1.1-.9 1.9-1.9 2.4.4-2.3.2-5-.5-7z"
          fill={prayedToday ? t.accent : 'none'}
          stroke={prayedToday ? t.accent : t.textDim}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span>{`${totalDays} ${totalDays === 1 ? 'day prayed' : 'days prayed'}`}</span>
    </p>
  );
}
