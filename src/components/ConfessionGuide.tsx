import { useState, useCallback } from 'react';
import { Scroll, Check, Trash2, ChevronDown } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  getBeatitudes,
  loadExaminationLens,
  saveExaminationLens,
  type ExaminationLens,
} from '@/lib/beatitudes';
import { getCommandments, getDutiesOfState } from '@/lib/confession';
import type { Audience } from '@/types';

interface ConfessionGuideProps {
  t: PersonaTheme;
  audience: Audience;
}

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

export function ConfessionGuide({ t, audience }: ConfessionGuideProps) {
  const commandments = getCommandments(audience);
  const dutiesOfState = getDutiesOfState(audience);
  const beatitudes = getBeatitudes(audience);
  const [notes, setNotes] = useState<Record<string, boolean>>(() => loadNotes());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lens, setLens] = useState<ExaminationLens>(() => loadExaminationLens());

  const chooseLens = useCallback((next: ExaminationLens) => {
    setLens(next);
    saveExaminationLens(next);
    setExpanded(null);
  }, []);

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

      {/* The lens choice — the law, or the blessings. Two options only; the rest
          of the tool (duties of state, your notes, the way out) is the same either way. */}
      <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: t.accent }}>
        Examine by:
      </p>
      <div className="flex gap-1.5 mb-4" role="group" aria-label="Examination lens">
        {(
          [
            { id: 'commandments', label: 'The Ten Commandments' },
            { id: 'beatitudes', label: 'The Beatitudes' },
          ] as { id: ExaminationLens; label: string }[]
        ).map((option) => (
          <button
            key={option.id}
            onClick={() => chooseLens(option.id)}
            aria-pressed={lens === option.id}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all border"
            style={
              lens === option.id
                ? { backgroundColor: t.accentRgba(0.15), color: t.accent, borderColor: t.accentRgba(0.4) }
                : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}80` }
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed mb-4" style={{ color: t.textDim }}>
        {lens === 'commandments'
          ? 'Examine your conscience by the Ten Commandments and your duties of state. Tap anything that applies — it stays private on your device.'
          : 'Examine your conscience by the Beatitudes — the shape of the blessed life, and where you refused it. Tap anything that applies — it stays private on your device.'}
      </p>

      {lens === 'commandments' && (
      <div className="space-y-1.5 mb-4">
        {commandments.map((cmd) => {
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
      )}

      {lens === 'beatitudes' && (
      <div className="space-y-1.5 mb-4">
        {beatitudes.map((b, bi) => {
          const id = `beat-${bi}`;
          const isOpen = expanded === id;
          const beatChecked = b.questions.filter((_, qi) => notes[`${id}-${qi}`]).length;
          return (
            <div key={b.ref}>
              <button onClick={() => setExpanded(isOpen ? null : id)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left"
                style={isOpen ? { backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.3) } : { backgroundColor: `${t.border}40`, borderColor: `${t.border}4D` }}>
                <span className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: t.accentRgba(0.15), color: t.accent }}>{b.ref.replace('Matthew', 'Mt')}</span>
                <span className="text-[11px] font-medium leading-snug flex-1" style={{ color: isOpen ? t.text : t.textMuted }}>{b.verse}</span>
                {beatChecked > 0 && <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: t.accent }}>{beatChecked}</span>}
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.textDim }} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-7 space-y-1 animate-fade-in">
                  <p className="text-[11px] italic leading-snug px-2.5 py-1.5" style={{ color: t.accent }}>
                    {b.framing}
                  </p>
                  {b.questions.map((q, qi) => {
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
      )}

      <div className="pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: t.accent }}>Duties of State</p>
        <div className="space-y-2.5">
          {dutiesOfState.map((duty) => (
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
