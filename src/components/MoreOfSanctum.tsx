import { ChevronRight, Church, HeartHandshake, type LucideIcon } from 'lucide-react';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme, TabId } from '@/types';

interface MoreOfSanctumProps {
  t: PersonaTheme;
  /** The two destinations — Today is home, never a row here. */
  onNavigate: (view: TabId) => void;
  /**
   * The come-home door's sender entry (Erik, Nov 18, 2026): a fourth
   * plate under the destinations, opening the share sheet.
   * Optional — the block stands complete without it.
   */
  onBringSomeoneHome?: () => void;
}

interface MoreEntry {
  key: 'church' | 'help';
  label: string;
  hint: string;
  icon: LucideIcon;
}

const ENTRIES: MoreEntry[] = [
  { key: 'church', label: 'Pocket Church', hint: 'Pray · Confession · Ask', icon: Church },
  { key: 'help', label: 'Real Help', hint: 'Priests, counselors, crisis lines', icon: HeartHandshake },
];

/**
 * More of Sanctum (Erik, Nov 13, 2026 — Option B, "Foot of Today"): the
 * destinations as a block at the foot of Today, under the day itself
 * and above the utilities line. The rows are the old menu sheet's GO rows,
 * unchanged in structure and weight — Real Help rendered exactly like the
 * others, neither hidden nor alarmed; the crisis content itself stays at
 * the top inside Real Help, as it already is. A Companions row stood
 * first here until Nov 20, 2026, when the companion's own plate took the
 * top of Today and the row became a duplicate (Erik's ruling) — the
 * companions are reached from the plate and the tab now, not from a
 * contents line at the foot of the page. Stage 1 of the printed-page
 * re-skin (Nov 14, 2026) set them as a book's contents — the name, a
 * dotted leader, and the hint where the page number would sit — but as
 * bare lines they did not read as tappable (Erik's revision, Nov 14,
 * 2026), so each row now sits on the printed page's shared ruled plate,
 * the same treatment as the Gospel section's two doors: frame, paper-
 * shade fill, and a weighted accent chevron at the right edge.
 * The row's spans are overflow-proofed (Erik's field report, Nov 18,
 * 2026): with label, hint, and chevron all flex-shrink-0, the longest
 * row — "Bring someone home" — carried ~394px of unshrinkable content
 * and spilled past its border on a ~360px phone. The hint now
 * truncates first (min-w-0 + truncate), the label truncates only as a
 * second line of defense, and the dotted leader keeps a 16px floor —
 * at widths where everything fits, nothing renders differently.
 */
const ROW_CLASS = PRINT_PLATE_CLASS;

export function MoreOfSanctum({ t, onNavigate, onBringSomeoneHome }: MoreOfSanctumProps) {
  return (
    <section aria-label="More of Sanctum" data-more-of-sanctum className="w-full">
      <p
        className="text-[12px] font-bold uppercase tracking-[0.2em] mb-2 text-center"
        style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
      >
        More of Sanctum
      </p>
      <div className="space-y-2">
        {ENTRIES.map((entry) => (
          <button
            key={entry.key}
            data-more-entry={entry.key}
            onClick={() => onNavigate(entry.key)}
            className={ROW_CLASS}
            style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
          >
            <span
              className="text-[15px] font-semibold min-w-0 truncate"
              style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
            >
              {entry.label}
            </span>
            <span
              aria-hidden="true"
              className="flex-1 min-w-[16px]"
              style={{ borderBottom: `1px dotted ${t.textDim}` }}
            />
            <span
              className="text-[12px] italic min-w-0 truncate"
              style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
            >
              {entry.hint}
            </span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ))}
        {/* The outward door (Erik, Nov 18, 2026): an invitation to hand
            on, not a room of the house — but a door all the same. It
            first stood here as a quiet text line and did not read as
            tappable (Erik's word, same day), so it now wears the same
            ruled plate as the destinations above: frame, paper-shade
            fill, the dotted leader, and the accent chevron. */}
        {onBringSomeoneHome && (
          <button
            data-bring-someone-home
            onClick={onBringSomeoneHome}
            className={ROW_CLASS}
            style={{ border: `1px solid ${t.border}`, backgroundColor: `${t.border}1F` }}
          >
            <span
              className="text-[15px] font-semibold min-w-0 truncate"
              style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
            >
              Bring someone home
            </span>
            <span
              aria-hidden="true"
              className="flex-1 min-w-[16px]"
              style={{ borderBottom: `1px dotted ${t.textDim}` }}
            />
            <span
              className="text-[12px] italic min-w-0 truncate"
              style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
            >
              For a friend away
            </span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
