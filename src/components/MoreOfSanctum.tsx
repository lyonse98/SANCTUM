import { Church, HeartHandshake, Users, type LucideIcon } from 'lucide-react';
import { PRINT_SERIF } from '@/lib/print';
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
 * re-skin (Nov 14, 2026) sets them as a book's contents: the name, a
 * dotted leader, and the hint where the page number would sit, each row
 * divided from the next by a hairline.
 */
const ROW_CLASS =
  'w-full flex items-baseline gap-2 px-1 py-2.5 text-left transition-opacity hover:opacity-75 active:opacity-60';

export function MoreOfSanctum({ t, onNavigate }: MoreOfSanctumProps) {
  return (
    <section aria-label="More of Sanctum" data-more-of-sanctum className="w-full">
      <p
        className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-center"
        style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
      >
        More of Sanctum
      </p>
      <div>
        {ENTRIES.map((entry) => (
          <button
            key={entry.key}
            data-more-entry={entry.key}
            onClick={() => onNavigate(entry.key)}
            className={ROW_CLASS}
            style={{ borderBottom: `1px solid ${t.border}99` }}
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
              style={{ borderBottom: `1px dotted ${t.textDim}`, transform: 'translateY(-3px)' }}
            />
            <span
              className="text-[11px] italic flex-shrink-0"
              style={{ fontFamily: PRINT_SERIF, color: t.textDim }}
            >
              {entry.hint}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
