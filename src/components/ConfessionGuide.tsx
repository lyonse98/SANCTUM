import { useState, useCallback } from 'react';
import { Scroll, Check, Trash2, ChevronDown } from 'lucide-react';
import type { PersonaTheme } from '@/types';

interface ConfessionGuideProps {
  t: PersonaTheme;
}

interface Commandment {
  num: string;
  title: string;
  questions: string[];
}

const COMMANDMENTS: Commandment[] = [
  {
    num: 'I',
    title: 'I am the Lord your God; you shall not have strange gods before Me',
    questions: [
      'Have I put anything — work, money, pleasure, sports, politics — above God?',
      'Have I neglected daily prayer or skipped Mass on Sundays?',
      'Have I dabbled in the occult, horoscopes, tarot, or New Age practices?',
      'Have I received Communion in a state of mortal sin?',
    ],
  },
  {
    num: 'II',
    title: 'You shall not take the name of the Lord in vain',
    questions: [
      'Have I used God\'s name carelessly or in anger?',
      'Have I sworn falsely or taken an oath I could not keep?',
      'Have I spoken disrespectfully of holy things?',
    ],
  },
  {
    num: 'III',
    title: 'Remember to keep holy the Lord\'s Day',
    questions: [
      'Have I missed Mass on Sundays or Holy Days without serious reason?',
      'Have I arrived late or left early without need?',
      'Have I done unnecessary work on Sundays that could have been done another day?',
    ],
  },
  {
    num: 'IV',
    title: 'Honor your father and mother',
    questions: [
      'Have I been disobedient or disrespectful to my parents or those in authority?',
      'Have I neglected my family — spouse, children, parents — in their needs?',
      'Have I failed to lead my household in faith?',
    ],
  },
  {
    num: 'V',
    title: 'You shall not kill',
    questions: [
      'Have I held hatred or grudges against anyone?',
      'Have I caused physical or emotional harm to another?',
      'Have I abused alcohol or drugs, or harmed my body?',
      'Have I led anyone into sin through my words or actions?',
    ],
  },
  {
    num: 'VI',
    title: 'You shall not commit adultery',
    questions: [
      'Have I been unfaithful to my spouse in thought, word, or deed?',
      'Have I viewed pornography or engaged in lustful thoughts?',
      'Have I dressed or acted immodestly?',
      'Have I used contraception or supported practices against life?',
    ],
  },
  {
    num: 'VII',
    title: 'You shall not steal',
    questions: [
      'Have I stolen or damaged property belonging to others?',
      'Have I cheated in business or failed to pay debts?',
      'Have I been greedy or failed to share with those in need?',
      'Have I wasted time or resources at work?',
    ],
  },
  {
    num: 'VIII',
    title: 'You shall not bear false witness',
    questions: [
      'Have I lied, gossiped, or spread rumors?',
      'Have I damaged someone\'s reputation through my words?',
      'Have I failed to defend the truth when I should have?',
      'Have I been a hypocrite — professing one thing and living another?',
    ],
  },
  {
    num: 'IX',
    title: 'You shall not covet your neighbor\'s wife',
    questions: [
      'Have I entertained lustful thoughts about another person?',
      'Have I been jealous of others\' marriages or relationships?',
      'Have I failed to guard my eyes and imagination?',
    ],
  },
  {
    num: 'X',
    title: 'You shall not covet your neighbor\'s goods',
    questions: [
      'Have I been envious of what others have?',
      'Have I been greedy or discontented with what God has given me?',
      'Have I failed to be generous with my resources?',
    ],
  },
];

const DUTIES_OF_STATE = [
  { label: 'As a Husband', questions: [
    'Have I loved my wife sacrificially, as Christ loved the Church?',
    'Have I led my family in prayer and faith?',
    'Have I been patient, or have I been harsh or controlling?',
  ]},
  { label: 'As a Father', questions: [
    'Have I been present with my children — not just physically, but emotionally?',
    'Have I taught them the faith by word and example?',
    'Have I disciplined with love, not anger?',
  ]},
  { label: 'As a Worker', questions: [
    'Have I worked diligently, as for the Lord and not for men?',
    'Have I been honest in my dealings?',
    'Have I let work become an idol at the expense of family and faith?',
  ]},
];

const STORAGE_KEY = 'sanctum_confession_notes';

function loadNotes(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

export function ConfessionGuide({ t }: ConfessionGuideProps) {
  const [notes, setNotes] = useState<Record<string, boolean>>(() => loadNotes());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setNotes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveNotes(next);
      return next;
    });
  }, []);

  const wipeNotes = useCallback(() => {
    setNotes({});
    saveNotes({});
  }, []);

  const checkedCount = Object.values(notes).filter(Boolean).length;

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scroll className="w-4 h-4" style={{ color: t.accent }} />
          <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>Confession Prep</h3>
        </div>
        {checkedCount > 0 && (
          <button onClick={wipeNotes} className="flex items-center gap-1 text-[11px] font-medium transition-all active:scale-95 px-2 py-1 rounded-lg border"
            style={{ backgroundColor: 'rgba(153,27,27,0.08)', borderColor: 'rgba(185,28,28,0.3)', color: '#B91C1C' }}>
            <Trash2 className="w-3 h-3" /> Wipe Notes
          </button>
        )}
      </div>

      <div
        className="flex items-start gap-2.5 mb-4 rounded-lg px-3 py-2.5 border"
        style={{ backgroundColor: 'rgba(153,27,27,0.06)', borderColor: 'rgba(185,28,28,0.25)' }}
      >
        <span className="text-sm flex-shrink-0 mt-px" style={{ color: '#B91C1C' }}>✝️</span>
        <p className="text-[10px] leading-relaxed" style={{ color: t.textMuted }}>
          <span className="font-bold" style={{ color: '#991B1B' }}>Notice:</span> This tool is an Examination of
          Conscience to help you prepare for the Sacrament of Reconciliation with a validly ordained priest.
          Sanctum cannot hear confessions, offer counsel as clergy, or grant absolution.
        </p>
      </div>

      <p className="text-[11px] leading-relaxed mb-4" style={{ color: t.textDim }}>
        Examine your conscience by the Ten Commandments and your duties of state. Tap anything that applies — it stays private on your device.
      </p>

      <div className="space-y-1.5 mb-4">
        {COMMANDMENTS.map((cmd) => {
          const id = `cmd-${cmd.num}`;
          const isOpen = expanded === id;
          const cmdChecked = cmd.questions.filter((_, qi) => notes[`${id}-${qi}`]).length;
          return (
            <div key={cmd.num}>
              <button onClick={() => setExpanded(isOpen ? null : id)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left"
                style={isOpen ? { backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.3) } : { backgroundColor: `${t.border}40`, borderColor: `${t.border}4D` }}>
                <span className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: t.accentRgba(0.15), color: t.accent }}>{cmd.num}</span>
                <span className="text-[11px] font-medium leading-snug flex-1" style={{ color: isOpen ? t.text : t.textMuted }}>{cmd.title}</span>
                {cmdChecked > 0 && <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: t.accent }}>{cmdChecked}</span>}
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.textDim }} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-7 space-y-1 animate-fade-in">
                  {cmd.questions.map((q, qi) => {
                    const qid = `${id}-${qi}`;
                    const isChecked = notes[qid] || false;
                    return (
                      <button key={qi} onClick={() => toggle(qid)}
                        className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg transition-all text-left"
                        style={isChecked ? { backgroundColor: t.accentRgba(0.06) } : {}}>
                        <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                          {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                        </div>
                        <span className="text-[11px] leading-snug" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.6 } : { color: t.textMuted }}>{q}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: t.accent }}>Duties of State</p>
        <div className="space-y-2.5">
          {DUTIES_OF_STATE.map((duty) => (
            <div key={duty.label}>
              <p className="text-[11px] font-medium mb-1" style={{ color: t.textBright }}>{duty.label}</p>
              <div className="space-y-1">
                {duty.questions.map((q, qi) => {
                  const qid = `duty-${duty.label}-${qi}`;
                  const isChecked = notes[qid] || false;
                  return (
                    <button key={qi} onClick={() => toggle(qid)}
                      className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg transition-all text-left"
                      style={isChecked ? { backgroundColor: t.accentRgba(0.06) } : {}}>
                      <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                        style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                        {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </div>
                      <span className="text-[11px] leading-snug" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.6 } : { color: t.textMuted }}>{q}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
        <p className="text-[11px] leading-relaxed text-center" style={{ color: t.textDim }}>
          {checkedCount > 0
            ? `${checkedCount} item${checkedCount > 1 ? 's' : ''} noted. Bring these to the priest. Tap "Wipe Notes" after Confession.`
            : 'No items noted yet. Tap any question that applies to you.'}
        </p>
      </div>
    </div>
  );
}
