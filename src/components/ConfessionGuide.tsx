import { useState, useCallback } from 'react';
import { Scroll, Check, Trash2, ChevronDown } from 'lucide-react';
import { PRINT_CHOSEN_FILL_ALPHA, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';
import {
  getBeatitudes,
  loadExaminationLens,
  saveExaminationLens,
  type ExaminationLens,
} from '@/lib/beatitudes';
import { getCommandments, getDutiesOfState, SACRAMENT_TEACHING } from '@/lib/confession';
import { HELP_SECTIONS } from '@/lib/realHelp';
import { ConfirmEraseSheet } from '@/components/ConfirmEraseSheet';
import { PRAYERS } from '@/data/prayers';
import type { Audience } from '@/types';

interface ConfessionGuideProps {
  t: PersonaTheme;
  audience: Audience;
}

const STORAGE_KEY = 'sanctum_confession_notes';

/** The Confession entry of Real Help — the same shared object FindHelpPage
 *  renders, so the words a man reads here are the words there, by construction. */
const CONFESSION_SECTION = HELP_SECTIONS.find((s) => s.id === 'confession');
/** The Act of Contrition, from the one shared shelf of prayer texts. */
const ACT_OF_CONTRITION = PRAYERS.find((p) => p.title === 'Act of Contrition');

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

  // The wipe confirms first (Erik, Nov 19, 2026): the button opens the
  // shared sheet, and only the sheet's final tap clears the checkmarks.
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);

  const checkedCount = Object.values(notes).filter(Boolean).length;

  return (
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}`, fontFamily: PRINT_SERIF }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scroll className="w-4 h-4" style={{ color: t.accent }} />
          <h3 className={PRINT_STAMP_CLASS} style={{ color: t.accent }}>Confession Prep</h3>
        </div>
        {checkedCount > 0 && (
          <button onClick={() => setWipeConfirmOpen(true)} className="flex items-center gap-1 text-[12px] font-medium transition-all active:scale-95 px-2 py-1 border"
            style={{ backgroundColor: 'rgba(153,27,27,0.08)', borderColor: 'rgba(185,28,28,0.3)', color: '#B91C1C' }}>
            <Trash2 className="w-3 h-3" /> Wipe Notes
          </button>
        )}
      </div>

      <div
        className="flex items-start gap-2.5 mb-4 px-3 py-2.5 border"
        style={{ backgroundColor: 'rgba(153,27,27,0.06)', borderColor: 'rgba(185,28,28,0.25)' }}
      >
        <span className="text-sm flex-shrink-0 mt-px" style={{ color: '#B91C1C' }}>✝️</span>
        <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
          <span className="font-bold" style={{ color: '#991B1B' }}>Notice:</span> This tool is an Examination of
          Conscience to help you prepare for the Sacrament of Reconciliation with a validly ordained priest.
          Sanctum cannot hear confessions, offer counsel as clergy, or grant absolution.
        </p>
      </div>

      {/* The sacrament taught before the examination begins (Pocket Church
          audit, Nov 20, 2026, item 1): what a mortal sin is, kind and
          number, the rite's own steps, and a word for the scrupulous. The
          examination prepares a confession only if the penitent knows what
          a confession is. */}
      <div className="mb-4 px-3 py-3 border" style={{ backgroundColor: `${t.border}14`, borderColor: t.border }}>
        <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
          The Sacrament, Plainly
        </p>
        {SACRAMENT_TEACHING.map((block) => (
          <div key={block.title} className="mb-3 last:mb-0">
            <p className="text-[12px] font-bold mb-1" style={{ color: t.textBright }}>{block.title}</p>
            {block.paragraphs?.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="text-[13px] leading-relaxed mb-1.5 last:mb-0" style={{ color: t.textMuted }}>
                {paragraph}
              </p>
            ))}
            {block.steps && (
              <ol className="space-y-1.5">
                {block.steps.map((step, i) => (
                  <li key={step.slice(0, 24)} className="flex items-start gap-2">
                    <span className="text-[12px] font-bold flex-shrink-0 mt-px" style={{ color: t.accent }}>{i + 1}.</span>
                    <span className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {/* The lens choice — the law, or the blessings. Two options only; the rest
          of the tool (duties of state, your notes, the way out) is the same either way. */}
      <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
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
            className="flex-1 min-h-[44px] px-3 py-2 text-xs font-bold transition-opacity hover:opacity-80 active:opacity-60"
            style={
              lens === option.id
                ? { backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, color: t.accent, border: `1px solid ${t.accent}` }
                : { backgroundColor: `${t.border}1F`, color: t.textDim, border: `1px solid ${t.border}` }
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="text-[13px] leading-relaxed mb-4" style={{ color: t.textDim }}>
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
                className="w-full min-h-[44px] flex items-start gap-2.5 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60 text-left"
                style={isOpen ? { backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, borderColor: t.accent } : { backgroundColor: `${t.border}1F`, borderColor: t.border }}>
                <span className="text-[12px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5" style={{ backgroundColor: t.accentRgba(0.15), color: t.accent }}>{cmd.num}</span>
                <span className="text-[12px] font-medium leading-snug flex-1" style={{ color: isOpen ? t.text : t.textMuted }}>{cmd.title}</span>
                {cmdChecked > 0 && <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: t.accent }}>{cmdChecked}</span>}
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.textDim }} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-7 space-y-1 animate-fade-in">
                  {cmd.questions.map((q, qi) => {
                    const qid = `${id}-${qi}`;
                    const isChecked = notes[qid] || false;
                    return (
                      <button key={qi} onClick={() => toggle(qid)}
                        className="w-full flex items-start gap-2 px-2.5 py-2 transition-opacity hover:opacity-80 text-left"
                        style={isChecked ? { backgroundColor: t.accentRgba(0.06) } : {}}>
                        <div className="w-4 h-4 border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                          {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                        </div>
                        <span className="text-[13px] leading-snug" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.6 } : { color: t.textMuted }}>{q}</span>
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
                className="w-full min-h-[44px] flex items-start gap-2.5 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60 text-left"
                style={isOpen ? { backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, borderColor: t.accent } : { backgroundColor: `${t.border}1F`, borderColor: t.border }}>
                <span className="text-[12px] font-bold flex-shrink-0 mt-0.5 px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: t.accentRgba(0.15), color: t.accent }}>{b.ref.replace('Matthew', 'Mt')}</span>
                <span className="text-[12px] font-medium leading-snug flex-1" style={{ color: isOpen ? t.text : t.textMuted }}>{b.verse}</span>
                {beatChecked > 0 && <span className="text-[12px] tabular-nums flex-shrink-0" style={{ color: t.accent }}>{beatChecked}</span>}
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: t.textDim }} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-7 space-y-1 animate-fade-in">
                  <p className="text-[13px] italic leading-snug px-2.5 py-1.5" style={{ color: t.accent }}>
                    {b.framing}
                  </p>
                  {b.questions.map((q, qi) => {
                    const qid = `${id}-${qi}`;
                    const isChecked = notes[qid] || false;
                    return (
                      <button key={qi} onClick={() => toggle(qid)}
                        className="w-full flex items-start gap-2 px-2.5 py-2 transition-opacity hover:opacity-80 text-left"
                        style={isChecked ? { backgroundColor: t.accentRgba(0.06) } : {}}>
                        <div className="w-4 h-4 border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                          {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                        </div>
                        <span className="text-[13px] leading-snug" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.6 } : { color: t.textMuted }}>{q}</span>
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
        <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>Duties of State</p>
        <div className="space-y-2.5">
          {dutiesOfState.map((duty) => (
            <div key={duty.label}>
              <p className="text-[12px] font-medium mb-1" style={{ color: t.textBright }}>{duty.label}</p>
              <div className="space-y-1">
                {duty.questions.map((q, qi) => {
                  const qid = `duty-${duty.label}-${qi}`;
                  const isChecked = notes[qid] || false;
                  return (
                    <button key={qi} onClick={() => toggle(qid)}
                      className="w-full flex items-start gap-2 px-2.5 py-1.5 transition-opacity hover:opacity-80 text-left"
                      style={isChecked ? { backgroundColor: t.accentRgba(0.06) } : {}}>
                      <div className="w-4 h-4 border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                        style={isChecked ? { backgroundColor: t.accent, borderColor: t.accent, color: '#fff' } : { borderColor: t.borderLight, color: 'transparent' }}>
                        {isChecked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                      </div>
                      <span className="text-[13px] leading-snug" style={isChecked ? { color: t.text, textDecoration: 'line-through', opacity: 0.6 } : { color: t.textMuted }}>{q}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The words themselves, in the door (Pocket Church build, Nov 14, 2026):
          what to do when he goes — the Real Help Confession entry's own script,
          imported from the shared data, not copied — and the Act of Contrition
          from the shared shelf, so the prayer he practices here is the prayer
          in the library, word for word. */}
      {CONFESSION_SECTION && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
          <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
            {CONFESSION_SECTION.scriptLabel}
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
            {CONFESSION_SECTION.script}
          </p>
        </div>
      )}

      {ACT_OF_CONTRITION && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
          <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ color: t.accent }}>
            Act of Contrition
          </p>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
            {ACT_OF_CONTRITION.text}
          </p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t" style={{ borderColor: `${t.border}4D` }}>
        <p className="text-[12px] leading-relaxed text-center" style={{ color: t.textDim }}>
          {checkedCount > 0
            ? `${checkedCount} item${checkedCount > 1 ? 's' : ''} noted. Bring these to the priest. Tap "Wipe Notes" after Confession.`
            : 'No items noted yet. Tap any question that applies to you.'}
        </p>
      </div>

      {/* Wipe Notes, confirmed (Nov 19, 2026): the checkmarks are the
          reader's own examination record — the sheet names them as what
          goes before the wipe runs. */}
      <ConfirmEraseSheet
        open={wipeConfirmOpen}
        t={t}
        title="Wipe your notes"
        goes={['The items you have checked in this examination, on this device.']}
        stays={[
          'The examination itself stays, ready for next time.',
          'Everything else — your profile, your days prayed — stays.',
        ]}
        confirmLabel="Wipe notes"
        onConfirm={() => { setWipeConfirmOpen(false); wipeNotes(); }}
        onCancel={() => setWipeConfirmOpen(false)}
      />
    </div>
  );
}
