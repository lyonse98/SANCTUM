import { useEffect, useState } from 'react';
import { ChevronDown, Moon } from 'lucide-react';
import { ExamenChecklist } from '@/components/ExamenChecklist';
import type { Audience, PersonaTheme } from '@/types';

interface EveningExamenProps {
  t: PersonaTheme;
  audience: Audience;
  /** The Examen's onward doors, passed through to the checklist. */
  onOpenConfession?: () => void;
  onOpenHelp?: () => void;
  /**
   * A reminder's tap (or the examen tool route) forces the section open whatever
   * the hour — the one landing that may arrive already expanded. Also re-opens it
   * if it becomes true after mount.
   */
  forceOpen?: boolean;
  /** Increment to ask the section to open (the Gospel card's Evening Examen door). */
  openSignal?: number;
}

/**
 * The Evening Examen on Today, as an expandable section (Erik's ruling, Nov 12, 2026:
 * the six checkboxes inline on the Gospel screen were too much). At rest it is a
 * single quiet row — title, one line, a chevron. Tapping opens the full checklist
 * in place; tapping again folds it away. Nothing is persisted: each visit starts
 * folded, except a notification landing, which arrives open on purpose.
 */
export function EveningExamen({ t, audience, onOpenConfession, onOpenHelp, forceOpen = false, openSignal = 0 }: EveningExamenProps) {
  const [expanded, setExpanded] = useState(forceOpen);

  useEffect(() => {
    if (forceOpen) setExpanded(true);
  }, [forceOpen]);

  useEffect(() => {
    if (openSignal > 0) setExpanded(true);
  }, [openSignal]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="evening-examen-body"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.99]"
      >
        <Moon className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
        <span className="flex-1 min-w-0">
          <span
            className="block text-sm font-bold font-display uppercase tracking-wide"
            style={{ color: t.textBright }}
          >
            Evening Examen
          </span>
          <span className="block text-[11px] leading-snug mt-0.5" style={{ color: t.textDim }}>
            Close the day with Ignatius — gratitude, one honest look, one resolve.
          </span>
        </span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
          style={{ color: t.textDim, transform: expanded ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {expanded && (
        <div id="evening-examen-body" className="px-4 pb-4 animate-fade-in">
          <ExamenChecklist
            t={t}
            audience={audience}
            onOpenConfession={onOpenConfession}
            onOpenHelp={onOpenHelp}
            framed={false}
          />
        </div>
      )}
    </div>
  );
}
