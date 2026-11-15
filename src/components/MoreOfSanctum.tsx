import { ChevronRight, Church, HeartHandshake, Users, type LucideIcon } from 'lucide-react';
import { PRINT_PLATE_CLASS, PRINT_SERIF } from '@/lib/print';
import type { PersonaTheme, TabId } from '@/types';

interface MoreOfSanctumProps {
  t: PersonaTheme;
  /** The three destinations — Today is home, never a row here. */
  onNavigate: (view: TabId) => void;
}

interface MoreEntry {
  key: 'companions' | 'church' | 'help';
  label: string;
  hint: string;
  icon: LucideIcon;
}

const ENTRIES: MoreEntry[] = [
  { key: 'companions', label: 'Companions', hint: 'Talk through today with a saint', icon: Users },
  { key: 'church', label: 'Pocket Church', hint: 'Pray · Confession · Ask', icon: Church },
  { key: 'help', label: 'Real Help', hint: 'Priests, counselors, crisis lines', icon: HeartHandshake },
];

/**
 * More of Sanctum (Erik, Nov 13, 2026 — Option B, "Foot of Today"): the
 * three destinations as a block at the foot of Today, under the day itself
 * and above the utilities line. The rows are the old menu sheet's GO rows,
 * unchanged in structure and weight — Real Help rendered exactly like the
 * others, neither hidden nor alarmed; the crisis content itself stays at
 * the top inside Real Help, as it already is. Stage 1 of the printed-page
 * re-skin (Nov 14, 2026) set them as a book's contents — the name, a
 * dotted leader, and the hint where the page number would sit — but as
 * bare lines they did not read as tappable (Erik's revision, Nov 14,
 * 2026), so each row now sits on the printed page's shared ruled plate,
 * the same treatment as the Gospel section's two doors: frame, paper-
 * shade fill, and a weighted accent chevron at the right edge.
 */
const ROW_CLASS = PRINT_PLATE_CLASS;

export function MoreOfSanctum({ t, onNavigate }: MoreOfSanctumProps) {
  return (
    <section aria-label="More of Sanctum" data-more-of-sanctum className="w-full">
      <p
        className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-center"
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
              className="text-[15px] font-semibold flex-shrink-0"
              style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
            >
              {entry.label}
            </span>
            <span
              aria-hidden="true"
              className="flex-1"
              style={{ borderBottom: `1px dotted ${t.textDim}` }}
            />
            <span
              className="text-[11px] italic flex-shrink-0"
              style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
            >
              {entry.hint}
            </span>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
