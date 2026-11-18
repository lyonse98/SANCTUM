import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { SaintOfDay } from '@/data/saints';
import { patronBioLine, patronFeastLabel } from '@/lib/patronSaint';
import { companionForSaint } from '@/lib/saintCompanion';
import { PRINT_SERIF } from '@/lib/print';
import type { Audience, Persona } from '@/types';

interface PatronPlateColors {
  border: string;
  fill: string;
  /** The opaque ground the bio sheet stands on. */
  card: string;
  textBright: string;
  textMuted: string;
  textDim: string;
  accent: string;
}

interface PatronPlateProps {
  patron: SaintOfDay;
  audience: Audience;
  colors: PatronPlateColors;
  /** Opens the companion chat when the patron is one of the track's companions. */
  onOpenCompanion?: (persona: Persona) => void;
  className?: string;
}

/**
 * The "Your patron" plate (Erik, Nov 18, 2026): the year's chosen patron,
 * named with their feast. It stands in Settings whenever a patron is
 * chosen, and on Today on the feast day itself. Tapping it walks to the
 * companion chat when the patron is one of the reader's own companions;
 * otherwise it opens a small sheet with the shelf's own line for them —
 * there is no saints-library surface behind it, by design.
 */
export function PatronPlate({ patron, audience, colors, onOpenCompanion, className }: PatronPlateProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const companion = companionForSaint(patron.name, audience);

  const handleTap = () => {
    if (companion && onOpenCompanion) {
      onOpenCompanion(companion);
      return;
    }
    setSheetOpen(true);
  };

  return (
    <div className={className} data-patron-plate>
      <button
        onClick={handleTap}
        className="w-full min-h-[48px] flex items-center gap-2.5 px-3.5 py-3 text-left transition-opacity hover:opacity-80 active:opacity-60"
        style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.fill }}
      >
        <span className="flex-1 min-w-0">
          <span
            className="block text-[12px] font-bold uppercase tracking-[0.2em]"
            style={{ fontFamily: PRINT_SERIF, color: colors.accent }}
          >
            Your patron
          </span>
          <span className="block text-[15px] font-semibold mt-0.5" style={{ fontFamily: PRINT_SERIF, color: colors.textBright }}>
            {patron.name}
          </span>
          <span className="block text-[13px]" style={{ fontFamily: PRINT_SERIF, color: colors.textMuted }}>
            Feast &middot; {patronFeastLabel(patron)}
            {companion ? ' · Talk with them' : ''}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.accent }} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-label={patron.name}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[15px] font-semibold" style={{ fontFamily: PRINT_SERIF, color: colors.textBright }}>
                {patron.name}
              </p>
              <button onClick={() => setSheetOpen(false)} aria-label="Close" style={{ color: colors.textDim }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] mb-2" style={{ fontFamily: PRINT_SERIF, color: colors.accent }}>
              Feast &middot; {patronFeastLabel(patron)}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: colors.textMuted }}>
              {patronBioLine(patron)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
