import { useState } from 'react';
import { Compass, X, ChevronRight, PenLine } from 'lucide-react';
import { personasForAudience } from '@/personas';
import { matchCompanionsByNeed, type CompanionMatch } from '@/lib/companionMatch';
import { QUESTIONS, recommendCompanion, type QuizAnswers, type QuizNeed, type QuizVoice } from '@/lib/companionQuiz';
import { PRINT_SERIF } from '@/lib/print';
import type { Audience, Persona, PersonaTheme } from '@/types';

interface CompanionRouterProps {
  t: PersonaTheme;
  audience: Audience;
  open: boolean;
  onClose: () => void;
  onSelect: (persona: Persona) => void;
}

/**
 * Help Me Choose (deepened, Erik, Nov 19, 2026). Two roads in, as
 * before: say it in your own words and the on-device matcher answers,
 * or take the guided questions. The questions are four now — what
 * brings you (the carrying, word for word the question it has always
 * been), what you need in Erik's four words (comfort / challenge /
 * company / wisdom), how you process, and how you like to be spoken
 * to (gently / directly). The engine lives in companionQuiz: the
 * hand-authored tables first, affinity scoring behind them, and every
 * recommendation carries a one-line why composed from the answers and
 * the companion's own data.
 */
export function CompanionRouter({ t, audience, open, onClose, onSelect }: CompanionRouterProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  // The typable path (Nov 12, 2026): the user states the need in their own words
  // and the on-device matcher answers. `submittedNeed` non-null means the typed
  // results — or the honest no-match — are what the modal is showing.
  const [needText, setNeedText] = useState('');
  const [submittedNeed, setSubmittedNeed] = useState<string | null>(null);

  if (!open) return null;

  const isDone = step >= QUESTIONS.length;
  const result = isDone
    ? recommendCompanion(
        {
          brings: answers[QUESTIONS.findIndex((q) => q.id === 'brings')] ?? '',
          need: (answers[QUESTIONS.findIndex((q) => q.id === 'need')] ?? 'comfort') as QuizNeed,
          process: answers[QUESTIONS.findIndex((q) => q.id === 'process')] ?? '',
          voice: (answers[QUESTIONS.findIndex((q) => q.id === 'voice')] ?? 'gentle') as QuizVoice,
        } satisfies QuizAnswers,
        audience,
      )
    : null;
  const recommended = result?.persona ?? null;
  // Gate on the resolved persona, not on `isDone`, so TypeScript narrows the null away.
  const showResult = recommended !== null && submittedNeed === null;
  const typedMatches: CompanionMatch[] = submittedNeed
    ? matchCompanionsByNeed(submittedNeed, personasForAudience(audience))
    : [];

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    setStep(step + 1);
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers([]);
    setNeedText('');
    setSubmittedNeed(null);
  };

  const handleSubmitNeed = () => {
    if (needText.trim().length < 3) return;
    setSubmittedNeed(needText);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: t.card, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ backgroundColor: t.card, borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
              Help Me Choose
            </h3>
          </div>
          <button onClick={onClose} className="p-1 transition-opacity hover:opacity-70" style={{ color: t.textMuted }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {submittedNeed !== null ? (
            <div className="animate-fade-in">
              <p className="text-[12px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
                In your words
              </p>
              <p className="text-sm italic leading-relaxed mb-5" style={{ color: t.textMuted }}>
                &ldquo;{submittedNeed}&rdquo;
              </p>
              {typedMatches.length > 0 ? (
                <>
                  <div className="space-y-2.5 mb-5">
                    {typedMatches.map(({ persona: p, reason: why }) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelect(p);
                          handleRestart();
                        }}
                        className="w-full min-h-[48px] flex items-center gap-3 px-3.5 py-3 border text-left transition-opacity hover:opacity-80 active:opacity-60"
                        style={{ backgroundColor: `${t.border}1F`, borderColor: t.border }}
                      >
                        <img
                          src={p.portrait}
                          alt={p.name}
                          className="portrait-grade w-12 h-12 rounded-full object-cover flex-shrink-0"
                          style={{ boxShadow: `inset 0 0 0 1.5px ${p.theme.accent}55` }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
                            {p.name}
                          </span>
                          <span className="block text-[12px] leading-snug mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
                            {why}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} strokeWidth={2.5} />
                      </button>
                    ))}
                  </div>
                  <p className="text-[13px] leading-relaxed text-center mb-4" style={{ color: t.textDim }}>
                    Matched on this device, from the words you used — nothing was sent anywhere.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed mb-5" style={{ color: t.textMuted }}>
                  Nothing in the cast matches those words plainly — that happens, and it is not a dead end.
                  Answer four short questions, or browse the whole cast and trust your eye.
                </p>
              )}
              <button
                onClick={handleRestart}
                className="w-full py-2.5 text-xs font-bold border transition-all active:scale-95 mb-2"
                style={{ backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.35), color: t.accent }}
              >
                Answer the questions instead
              </button>
              <button
                onClick={() => {
                  handleRestart();
                  onClose();
                }}
                className="w-full py-2 text-xs font-medium border transition-all active:scale-95"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textDim }}
              >
                See the whole cast
              </button>
            </div>
          ) : !showResult ? (
            <div className="animate-fade-in">
              {/* Say it in your own words — offered once, at the door, before the
                  questions begin. Matching happens on-device (companionMatch). */}
              {step === 0 && answers.length === 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <PenLine className="w-3.5 h-3.5" style={{ color: t.accent }} />
                    <p className="text-[12px] uppercase tracking-widest font-bold" style={{ color: t.accent }}>
                      Or say it in your own words
                    </p>
                  </div>
                  <textarea
                    value={needText}
                    onChange={(e) => setNeedText(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="What do you need to talk about?"
                    aria-label="What do you need to talk about?"
                    className="w-full border px-3.5 py-2.5 text-sm leading-relaxed resize-none outline-none"
                    style={{ backgroundColor: 'transparent', borderColor: t.border, fontFamily: PRINT_SERIF, color: t.text }}
                  />
                  <button
                    onClick={handleSubmitNeed}
                    disabled={needText.trim().length < 3}
                    className="w-full mt-2 py-2.5 text-xs font-bold border transition-all active:scale-95 disabled:opacity-40"
                    style={{ backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.35), color: t.accent }}
                  >
                    Find who fits
                  </button>
                  <div className="flex items-center gap-3 mt-5">
                    <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
                    <span className="text-[12px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
                      or answer four questions
                    </span>
                    <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center gap-1.5 mb-5">
                {QUESTIONS.map((_, i) => (
                  <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: i <= step ? t.accent : `${t.border}66` }} />
                ))}
              </div>

              <p className="text-[12px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h4 className="text-base font-bold mb-4" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
                {QUESTIONS[step].prompt}
              </h4>

              <div className="space-y-2">
                {QUESTIONS[step].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(opt.value)}
                    className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 border transition-opacity hover:opacity-80 active:opacity-60 text-left"
                    style={{
                      backgroundColor: `${t.border}1F`,
                      borderColor: t.border,
                      color: t.text,
                    }}
                  >
                    <span className="text-sm font-medium" style={{ fontFamily: PRINT_SERIF }}>{opt.label}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: t.accent }} strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center animate-fade-in">
              <p className="text-[12px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
                Your Companion
              </p>
              <div className="flex justify-center mb-4">
                <img
                  src={recommended.portrait}
                  alt={recommended.name}
                  className="portrait-grade w-24 h-24 rounded-full object-cover"
                  style={{ boxShadow: `inset 0 0 0 2px ${recommended.theme.accent}55` }}
                />
              </div>
              <h3 className="text-lg font-bold" style={{ fontFamily: PRINT_SERIF, color: recommended.theme.textBright }}>
                {recommended.name}
              </h3>
              <p className="text-xs mb-4" style={{ color: t.textDim }}>
                {recommended.title}
              </p>
              {/* The one-line why (Nov 19, 2026): the carrying, the need,
                  the companion's own manner, her tagline — composed by
                  the engine from the answers and the persona bank. */}
              <p
                data-quiz-why
                className="text-sm leading-relaxed mb-4"
                style={{ fontFamily: PRINT_SERIF, color: t.text }}
              >
                {result?.why}
              </p>
              <div
                className="px-4 py-3 border mb-5 text-left"
                style={{ backgroundColor: t.accentRgba(0.05), borderColor: t.accentRgba(0.15) }}
              >
                <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
                  {result?.reason}
                </p>
              </div>
              <button
                onClick={() => {
                  onSelect(recommended);
                  handleRestart();
                }}
                className="w-full py-3 text-sm font-bold transition-all active:scale-95 mb-2"
                style={{ backgroundColor: recommended.theme.accent, color: '#ffffff' }}
              >
                Talk with {recommended.name}
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2 text-xs font-medium border transition-all active:scale-95"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textDim }}
              >
                Answer Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
