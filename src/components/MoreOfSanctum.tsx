import { Church, HeartHandshake, Users, type LucideIcon } from 'lucide-react';
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
 * the top inside Real Help, as it already is.
 */
export function MoreOfSanctum({ t, onNavigate }: MoreOfSanctumProps) {
  const rowStyle: React.CSSProperties = {
    backgroundColor: t.card,
    borderColor: `${t.border}99`,
  };

  return (
    <section aria-label="More of Sanctum" data-more-of-sanctum className="w-full">
      <p
        className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-center"
        style={{ color: t.textDim }}
      >
        More of Sanctum
      </p>
      <div className="space-y-2">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.key}
              data-more-entry={entry.key}
              onClick={() => onNavigate(entry.key)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.99]"
              style={rowStyle}
            >
              <Icon className="w-5 h-5 flex-shrink-0" style={{ color: t.accent }} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold" style={{ color: t.textBright }}>
                  {entry.label}
                </span>
                <span className="block text-[11px]" style={{ color: t.textDim }}>
                  {entry.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
