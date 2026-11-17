import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { PRINT_CHOSEN_FILL_ALPHA, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';
import { PRAYERS } from '@/data/prayers';

interface PrayerLibraryProps {
  t: PersonaTheme;
}

export function PrayerLibrary({ t }: PrayerLibraryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(false);

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>Prayer</h3>
      </div>

      {/* The reference — fourteen texts, collapsed by default. A man who already knows what he
          wants to say finds it in one tap; a man who does not is not made to triage fourteen rows.
          (Lectio Divina left this shelf on Nov 12, 2026 — Erik's ruling: it is not an
          identifiable surface anywhere in the app; the Gospel card on Today is where
          the day's Gospel is prayed.) */}
      <button
        onClick={() => setReferenceOpen((v) => !v)}
        aria-expanded={referenceOpen}
        className="w-full min-h-[48px] flex items-center justify-between px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
        style={{
          backgroundColor: referenceOpen ? `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}` : `${t.border}1F`,
          borderColor: referenceOpen ? t.accent : t.border,
        }}
      >
        <span
          className="text-[12px] font-bold uppercase tracking-widest"
          style={{ fontFamily: PRINT_SERIF, color: referenceOpen ? t.accent : t.textDim }}
        >
          Prayer reference
        </span>
        <span className="flex items-center gap-2" style={{ color: t.textDim }}>
          <span className="text-[12px]" style={{ fontFamily: PRINT_SERIF }}>{PRAYERS.length} prayers</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${referenceOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {referenceOpen && (
        <div className="space-y-1.5 mt-2 animate-fade-in">
          {PRAYERS.map((prayer) => {
            const isOpen = expanded === prayer.title;
            return (
              <div key={prayer.title}>
                <button onClick={() => setExpanded(isOpen ? null : prayer.title)}
                  aria-expanded={isOpen}
                  className="w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
                  style={isOpen ? { backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, borderColor: t.accent } : { backgroundColor: `${t.border}1F`, borderColor: t.border }}>
                  <span className="text-xs font-medium text-left" style={{ fontFamily: PRINT_SERIF, color: isOpen ? t.accent : t.textMuted }}>{prayer.title}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.textDim }} />
                </button>
                {isOpen && (
                  <div className="mt-1.5 px-3 py-3 border animate-fade-in" style={{ backgroundColor: `${t.border}14`, borderColor: t.border }}>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ fontFamily: PRINT_SERIF, color: t.text }}>{prayer.text}</p>
                    {prayer.source && <p className="text-[12px] mt-2 italic" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>— {prayer.source}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
