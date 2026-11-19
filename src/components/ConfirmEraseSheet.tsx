import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';

/**
 * The one confirmation sheet for every delete-data action (Erik's rule
 * from live testing, Nov 19, 2026): no erasure fires on a single tap.
 * First the sheet — in plain words, what goes and what stays — and only
 * the sheet's own final tap carries the deletion out. The register is
 * the app's print voice and the styling stays calm: no red, no alarm,
 * just an exact account of the act before it is taken. Callers supply
 * the scope lines; this component owns the shape, so every destructive
 * door in the app reads the same way by construction.
 */
export interface ConfirmEraseSheetProps {
  open: boolean;
  t: PersonaTheme;
  /** The act, named as a stamped heading — e.g. "Erase everything". */
  title: string;
  /** One plain sentence before the lists, when the act needs it. */
  intro?: string;
  /** What the act removes, one line each. */
  goes: string[];
  /** What the act cannot or does not touch, one line each. */
  stays: string[];
  /** The final tap's label — the act itself, never "OK" or "Yes". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmEraseSheet({
  open,
  t,
  title,
  intro,
  goes,
  stays,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmEraseSheetProps) {
  if (!open) return null;

  return (
    <div
      data-confirm-erase-sheet
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-6 animate-slide-up"
        style={{ backgroundColor: t.bg, borderColor: t.border, fontFamily: PRINT_SERIF }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={PRINT_STAMP_CLASS} style={{ color: t.accent }}>
          Before you do
        </p>
        <h2 className="text-base font-bold mt-1.5 mb-2" style={{ color: t.textBright }}>
          {title}
        </h2>
        {intro && (
          <p className="text-[13px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
            {intro}
          </p>
        )}

        <p className="text-[12px] font-bold uppercase tracking-widest mb-1" style={{ color: t.textDim }}>
          What goes
        </p>
        <ul className="mb-4 space-y-1">
          {goes.map((line) => (
            <li key={line} className="text-[13px] leading-relaxed flex gap-2" style={{ color: t.text }}>
              <span aria-hidden style={{ color: t.accent }}>·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="text-[12px] font-bold uppercase tracking-widest mb-1" style={{ color: t.textDim }}>
          What stays
        </p>
        <ul className="mb-5 space-y-1">
          {stays.map((line) => (
            <li key={line} className="text-[13px] leading-relaxed flex gap-2" style={{ color: t.textMuted }}>
              <span aria-hidden style={{ color: t.accent }}>·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <button
          data-confirm-erase-confirm
          onClick={onConfirm}
          className="w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide border transition-all active:scale-95 mb-2"
          style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
        >
          {confirmLabel}
        </button>
        <button
          data-confirm-erase-cancel
          onClick={onCancel}
          className="w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wide transition-all active:scale-95"
          style={{ color: t.textMuted }}
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
