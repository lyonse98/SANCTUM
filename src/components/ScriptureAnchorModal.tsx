import { X, BookOpen } from 'lucide-react';
import type { PersonaTheme } from '@/types';

interface ScriptureAnchorModalProps {
  open: boolean;
  onClose: () => void;
  t: PersonaTheme;
}

const ANCHORS: { verse: string; ref: string; reflection: string }[] = [
  {
    verse: 'Be still, and know that I am God.',
    ref: 'Psalm 46:10',
    reflection: 'Stillness is not idleness. It is the active surrender of your strength to His. Stop striving for a moment. He is still God when you are not working.',
  },
  {
    verse: 'I can do all things through Christ who strengthens me.',
    ref: 'Philippians 4:13',
    reflection: 'Not "I can do everything." All things — the things He has actually given you. The strength is His, borrowed for the task. You do not carry it alone.',
  },
  {
    verse: 'The Lord is my shepherd; I shall not want.',
    ref: 'Psalm 23:1',
    reflection: 'Want is the engine of restlessness. The shepherd provides what you actually need, not what you think you need. Trust the shepherd to know the difference.',
  },
  {
    verse: 'Wait for the Lord; be strong, and let your heart take courage.',
    ref: 'Psalm 27:14',
    reflection: 'Waiting is not passivity. It is the courage to hold your position until the order comes. Most men break formation because they cannot stand the silence.',
  },
  {
    verse: 'Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the Lord your God is with you wherever you go.',
    ref: 'Joshua 1:9',
    reflection: 'Courage is commanded, not suggested. The presence of God is not a feeling — it is a fact. You are not alone in the room you are standing in.',
  },
  {
    verse: 'Come to me, all who labor and are heavy laden, and I will give you rest.',
    ref: 'Matthew 11:28',
    reflection: 'Rest is not earned. It is received. The labor stops at the foot of the cross. Lay the weight down — it was never yours to carry.',
  },
  {
    verse: 'Trust in the Lord with all your heart, and do not lean on your own understanding.',
    ref: 'Proverbs 3:5',
    reflection: 'Your understanding is limited, anxious, and reactive. His is eternal. When the picture does not make sense, trust the One who sees the whole canvas.',
  },
];

function getDayIndex(): number {
  const start = new Date(2026, 0, 1);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff % ANCHORS.length;
}

export function ScriptureAnchorModal({ open, onClose, t }: ScriptureAnchorModalProps) {
  if (!open) return null;

  const anchor = ANCHORS[getDayIndex()];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up border"
        style={{ backgroundColor: t.bg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: `${t.border}66` }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4) }}>
              <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
            </div>
            <h2 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Scripture Anchor</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90" style={{ color: t.textDim, backgroundColor: `${t.border}40` }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-4" style={{ color: t.accent }}>
            Today's Anchor
          </p>
          <blockquote
            className="text-lg font-display leading-relaxed mb-3 italic"
            style={{ color: t.textBright }}
          >
            "{anchor.verse}"
          </blockquote>
          <p className="text-xs font-bold mb-6" style={{ color: t.textDim }}>
            — {anchor.ref}
          </p>
          <div className="rounded-lg border p-4 text-left" style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66` }}>
            <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
              {anchor.reflection}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-5 py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95"
            style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4), color: t.accent }}
          >
            Hold This Today
          </button>
        </div>
      </div>
    </div>
  );
}
