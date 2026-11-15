import { X } from 'lucide-react';
import { PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme } from '@/types';

interface PrintPageHeadProps {
  t: PersonaTheme;
  /** The page's name, set as the chapter head. */
  title: string;
  /** The '‹ Today' return — every sub-view's back walks to Today. */
  onBack: () => void;
  /** Pages that also close (Real Help, About) carry their X on the strip. */
  onClose?: () => void;
}

/**
 * The sub-view head in the printed page's language (Stage 2 of the re-skin,
 * Erik, Nov 14, 2026): a quiet '‹ Today' return line at the top of the
 * content area, the page's name set as a chapter head in the serif voice,
 * and a double rule under it — the same furniture on Companions, Pocket
 * Church, Real Help, and About, so a room is known by its head. The back
 * handler is each page's own, unchanged; only the dress is shared.
 */
export function PrintPageHead({ t, title, onBack, onClose }: PrintPageHeadProps) {
  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-[11px] font-bold uppercase tracking-[0.18em] transition-opacity hover:opacity-70 py-1"
          style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}
        >
          &lsaquo; Today
        </button>
        {onClose ? (
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center transition-all active:scale-90"
            style={{ color: t.textMuted }}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}
      </div>
      <h1
        className="text-center text-[22px] leading-tight mt-2"
        style={{ fontFamily: PRINT_SERIF, fontWeight: 600, color: t.textBright }}
      >
        {title}
      </h1>
      <div aria-hidden="true" style={{ borderTop: `3px double ${t.border}`, margin: '10px 42px 0' }} />
    </div>
  );
}
