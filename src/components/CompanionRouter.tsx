import { useState } from 'react';
import { Compass, X, ChevronRight, PenLine } from 'lucide-react';
import { PERSONAS, personasForAudience } from '@/personas';
import { matchCompanionsByNeed, type CompanionMatch } from '@/lib/companionMatch';
import type { Audience, Persona, PersonaTheme } from '@/types';

interface CompanionRouterProps {
  t: PersonaTheme;
  audience: Audience;
  open: boolean;
  onClose: () => void;
  onSelect: (persona: Persona) => void;
}

type Answer = string;

interface Question {
  id: string;
  prompt: string;
  options: { label: string; value: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'brings',
    prompt: 'What brings you here?',
    options: [
      { label: "I'm overwhelmed", value: 'overwhelmed' },
      { label: 'I keep failing', value: 'failing' },
      { label: "I'm restless", value: 'restless' },
      { label: 'I need direction', value: 'direction' },
      { label: "I'm buried in responsibility", value: 'responsibility' },
      { label: 'My marriage or family', value: 'marriage' },
    ],
  },
  {
    id: 'process',
    prompt: 'How do you process things?',
    options: [
      { label: 'In my head', value: 'head' },
      { label: 'Through emotion', value: 'emotion' },
      { label: 'Through action', value: 'action' },
      { label: 'Through discipline', value: 'discipline' },
    ],
  },
  {
    id: 'need',
    prompt: 'What do you most need right now?',
    options: [
      { label: 'To be understood', value: 'understood' },
      { label: 'To be challenged', value: 'challenged' },
      { label: 'To be steadied', value: 'steadied' },
      { label: 'To be taught', value: 'taught' },
    ],
  },
];

const RECOMMENDATIONS: Record<string, { personaId: string; reason: string }> = {
  'overwhelmed-head-taught': { personaId: 'ignatius', reason: 'Ignatius is a methodical thinker who helps you find God in the chaos. He will not give you airy answers — he sends you into prayer with a concrete question and helps you weigh what comes back.' },
  'overwhelmed-emotion-understood': { personaId: 'david', reason: 'David knows the whole of a man\'s emotional life — anger, fear, grief, shame — without flinching. He will not shame you for what you feel. He will teach you to pour it out before God like a psalm.' },
  'overwhelmed-action-steadied': { personaId: 'joseph', reason: 'Joseph carried a household through chaos without anyone writing it down. He trusts the body first — work, sleep, food, the feel of wood in the hands. When you are spiraling, he sends you to your hands before your head.' },
  'overwhelmed-discipline-challenged': { personaId: 'moses', reason: 'Moses burned out leading a million complainers through a desert for forty years. His father-in-law had to tell him to delegate. He knows what it is to be exhausted, angry, and ready to quit — and he will help you find the next step without quitting.' },
  'failing-emotion-understood': { personaId: 'peter', reason: 'Peter swore he would never fall and denied Christ three times. He sits with a man who has failed because he has been there, and he knows the look Jesus gave him across that fire. The story is not over.' },
  'failing-action-challenged': { personaId: 'peter', reason: 'Peter is the man who cut off the ear, jumped out of the boat, said "not me, Lord." He understands impulsivity and failure. He will not let you hide from your brothers, but he will not let you stay down.' },
  'failing-discipline-challenged': { personaId: 'paul', reason: 'Paul was the persecutor turned apostle. He knows what it is to become someone entirely new. He will challenge passivity and comfort, but always grounded in grace — never crushing the wounded.' },
  'failing-head-taught': { personaId: 'augustine', reason: 'Augustine spent years doing the thing he hated and praying for the virtue he was afraid to receive. He knows the divided will. He will not moralize at you — he has been there, for years.' },
  'restless-head-taught': { personaId: 'augustine', reason: 'Augustine chased pleasure, prestige, and truth for thirty years and found them all wanting. "Our heart is restless until it rests in You." He speaks to the man whose mind will not stop and whose will will not hold.' },
  'restless-emotion-understood': { personaId: 'david', reason: 'David is passionate, raw, and honest. He chased and fell and rose through tears. He will help you bring your restlessness before God as worship — not as a problem to solve, but as a psalm to pray.' },
  'restless-action-challenged': { personaId: 'paul', reason: 'Paul channeled his restless energy into the race. He will help you redirect your drive from chasing to running — "I have fought the good fight, I have finished the race."' },
  'restless-discipline-steadied': { personaId: 'ignatius', reason: 'Ignatius was a man of ambition and vanity before a cannonball stopped him. He does not crush a man\'s drive — he redirects it. He will help you sort ambition from vanity and find the greater glory.' },
  'direction-head-taught': { personaId: 'ignatius', reason: 'Ignatius gave the Church the Spiritual Exercises — the art of discerning God\'s will. He teaches you to read the movements of your own heart like a general reads terrain. He will send you into prayer with a concrete question.' },
  'direction-emotion-understood': { personaId: 'david', reason: 'David is the warrior-poet who learned to listen. He will help you bring your desires before God honestly and trust the tug of the heart when it is grounded in faith.' },
  'direction-action-steadied': { personaId: 'joseph', reason: 'Joseph trusted dreams. God spoke to him four times in the night. He will help you trust the nudge, the instinct, the pull — and act on it with steady hands.' },
  'direction-discipline-challenged': { personaId: 'ignatius', reason: 'Ignatius discerned his vocation from a sickbed. He will give you concrete steps — pray this passage, make the examen, write down where you felt consolation. He trusts that God speaks in the doing.' },
  'responsibility-head-steadied': { personaId: 'joseph', reason: 'Joseph carried the weight of the Holy Family without recognition. He knows what it is to lead a household through chaos. He will steady you and send you to the work in front of you.' },
  'responsibility-emotion-understood': { personaId: 'moses', reason: 'Moses never wanted the job. He argued with God at the burning bush, begged Him to send someone else, and then carried the people anyway. He understands the weight of responsibility you did not ask for — and the anger that comes with it.' },
  'responsibility-action-steadied': { personaId: 'joseph', reason: 'Joseph is the craftsman. He trusts the body: work, sleep, food. When you are buried, he sends you to your hands before your head. One concrete step at a time.' },
  'responsibility-discipline-challenged': { personaId: 'paul', reason: 'Paul endured shipwrecks, prisons, and beatings — and kept running. He will challenge you to endure, but he will also remind you that grace is sufficient. You do not have to bootstrap this.' },
  'marriage-head-taught': { personaId: 'therese', reason: 'Thérèse grew up inside the only marriage the Church has ever canonized — Louis and Zélie Martin, nine children, a business, and daily prayer. She will help you see what the small daily kindnesses in your marriage are actually building.' },
  'marriage-emotion-understood': { personaId: 'therese', reason: 'Thérèse loved her sisters in the cloister when they were difficult, and she says plainly that love is a decision you make with your will — often before your feelings agree. She will not tell you to feel differently. She will show you what to do next.' },
  'marriage-action-steadied': { personaId: 'therese', reason: 'Thérèse taught the Little Way: greatness is not in the great deed but in the small one done with love. She will give you one small, doable thing to do for your wife today — and it will matter more than you think.' },
  'marriage-discipline-challenged': { personaId: 'therese', reason: 'Thérèse never did anything the world would call great. She did a hundred small duties with great love and became a Doctor of the Church. She will hold you to that standard, because she lived it.' },
};

const RECOMMENDATIONS_WOMEN: Record<string, { personaId: string; reason: string }> = {
  'overwhelmed-head-taught': { personaId: 'teresa', reason: 'Teresa mapped the interior life like a castle with seven dwellings — she takes an overwhelmed mind and gives it rooms to walk through, one at a time. Methodical, honest, and never airy.' },
  'overwhelmed-emotion-understood': { personaId: 'magdalene', reason: 'Mary Magdalene stayed at the cross and came weeping to the tomb. She will not hurry your feelings or tidy them up. She knows what it is to love Jesus with your whole heart in the middle of grief.' },
  'overwhelmed-action-steadied': { personaId: 'clare', reason: 'Clare steadied fifty sisters for forty years on almost nothing. When everything feels like too much, she starts with one thing let go of — and the hands empty enough to hold what matters.' },
  'overwhelmed-discipline-challenged': { personaId: 'catherine', reason: 'Catherine of Siena wrote to popes the way other people breathe. She will not let overwhelm become an hiding place — she will hand you the truth and the next faithful step, in that order.' },
  'failing-emotion-understood': { personaId: 'magdalene', reason: 'Magdalene was misjudged for centuries for sins she never committed — and Jesus entrusted her with the first news of Easter anyway. She sits with a woman who has failed or been shamed, and she does not flinch.' },
  'failing-action-challenged': { personaId: 'joan', reason: 'Joan was captured, chained, and tried — and she never stopped answering truthfully. She understands the woman who acts fast and pays for it. She will get you back on your feet and pointed at the real fight.' },
  'failing-discipline-challenged': { personaId: 'catherine', reason: 'Catherine’s most famous sentence is a challenge: be who God meant you to be and you will set the world on fire. She names the failure plainly — and then names the woman underneath it, whom she refuses to give up on.' },
  'failing-head-taught': { personaId: 'teresa', reason: 'Teresa spent twenty years in tepid, distracted prayer before anything changed. She knows the divided heart from the inside, and she teaches — patiently, exactly — how a woman begins again.' },
  'restless-head-taught': { personaId: 'teresa', reason: 'Teresa’s restless mind became the Church’s map of prayer. She will give your thoughts somewhere true to go: dwelling by dwelling, toward the King at the center.' },
  'restless-emotion-understood': { personaId: 'magdalene', reason: 'Magdalene’s restlessness ended at a tomb garden, searching for the one she loved. She understands a heart that will not settle for less than Jesus himself — because hers would not.' },
  'restless-action-challenged': { personaId: 'joan', reason: 'Joan took a peasant girl’s energy and put it entirely at God’s disposal. She will help you aim your drive instead of apologizing for it — once the call is tested, no more shrinking.' },
  'restless-discipline-steadied': { personaId: 'clare', reason: 'Clare redirected a noblewoman’s whole ambition into one small convent and one great love. She knows how restlessness quiets: not by doing less, but by wanting one thing completely.' },
  'direction-head-taught': { personaId: 'teresa', reason: 'Teresa is the Church’s teacher of prayer — how to tell where you are with God, what is dryness, what is growth, what is a trap. Discernment, in her hands, is a craft you can learn.' },
  'direction-emotion-understood': { personaId: 'mary', reason: 'Mary pondered everything in her heart before she understood any of it. If you need direction and your heart is loud, she teaches the older way: keep the things, turn them over, and let God ripen them.' },
  'direction-action-steadied': { personaId: 'joan', reason: 'Joan did not act on a feeling — she let the Church examine her first, then rode. She will steady your hand: test the call, then obey it without theatrics.' },
  'direction-discipline-challenged': { personaId: 'catherine', reason: 'Catherine discerned her vocation in a tiny cell and then walked into the politics of nations. She pairs self-knowledge with obedience — and she will press you on both.' },
  'responsibility-head-steadied': { personaId: 'monica', reason: 'Monica carried a household, a hard marriage, and a lost son for decades — with her mind fixed on God the whole time. She steadies women who carry people: hope as a discipline, not a mood.' },
  'responsibility-emotion-understood': { personaId: 'monica', reason: 'Monica wept in front of a bishop until he answered her. She knows the tears that come with responsibility you did not choose, and she will teach you to make them into prayer instead of despair.' },
  'responsibility-action-steadied': { personaId: 'clare', reason: 'Clare ran a community on prayer and whatever arrived at the door that day. For the woman buried in responsibility, she is relentlessly practical: hold less, trust more, do the next true thing.' },
  'responsibility-discipline-challenged': { personaId: 'catherine', reason: 'Catherine carried the wounds of the whole Church as her own responsibility — and let it make her bolder, not bitter. She will challenge you to carry your load the same way.' },
  'marriage-head-taught': { personaId: 'therese-women', reason: 'Thérèse grew up inside the only marriage the Church has ever canonized — Louis and Zélie Martin, nine children, a business, and daily prayer. She will help you see what the small daily kindnesses in your marriage are actually building.' },
  'marriage-emotion-understood': { personaId: 'therese-women', reason: 'Thérèse loved the sisters who were hardest to love, and she says plainly that love is a decision of the will — often before the feelings agree. She will not tell you to feel differently. She will show you the next small thing.' },
  'marriage-action-steadied': { personaId: 'therese-women', reason: 'Thérèse taught the Little Way: holiness is the small act done with great love. She will give you one small, doable thing to do for your husband today — and it will matter more than you think.' },
  'marriage-discipline-challenged': { personaId: 'therese-women', reason: 'Thérèse never did anything the world calls great. She did a hundred small duties with great love and became a Doctor of the Church. She will hold you to that standard, because she lived it.' },
};

const FALLBACK_WOMEN: Record<string, string> = {
  overwhelmed: 'monica',
  failing: 'magdalene',
  restless: 'teresa',
  direction: 'mary',
  responsibility: 'monica',
  marriage: 'therese-women',
};

function getRecommendation(answers: Answer[], audience: Audience): { persona: Persona; reason: string } {
  const cast = personasForAudience(audience);
  const resolve = (id: string): Persona => cast.find((p) => p.id === id) ?? cast[0];
  const key = answers.join('-');
  const rec = (audience === 'women' ? RECOMMENDATIONS_WOMEN : RECOMMENDATIONS)[key];
  if (rec) return { persona: resolve(rec.personaId), reason: rec.reason };
  // Fallback: match by first answer
  const firstAnswer = answers[0];
  const fallbackMap: Record<string, string> = audience === 'women'
    ? FALLBACK_WOMEN
    : {
        overwhelmed: 'moses',
        failing: 'peter',
        restless: 'augustine',
        direction: 'ignatius',
        responsibility: 'joseph',
        marriage: 'therese',
      };
  const persona = resolve(fallbackMap[firstAnswer] ?? cast[0].id);
  return {
    persona,
    reason: `${persona.name} speaks to ${audience === 'women' ? 'women' : 'men'} like you. Read the card and see if the voice fits — you can always switch.`,
  };
}

export function CompanionRouter({ t, audience, open, onClose, onSelect }: CompanionRouterProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  // The typable path (Nov 12, 2026): the user states the need in their own words
  // and the on-device matcher answers. `submittedNeed` non-null means the typed
  // results — or the honest no-match — are what the modal is showing.
  const [needText, setNeedText] = useState('');
  const [submittedNeed, setSubmittedNeed] = useState<string | null>(null);

  if (!open) return null;

  const isDone = step >= QUESTIONS.length;
  const { persona: recommended, reason } = isDone ? getRecommendation(answers, audience) : { persona: null, reason: '' };
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
        className="w-full max-w-md rounded-2xl border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto chat-scroll"
        style={{ backgroundColor: t.bg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ backgroundColor: t.bg, borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
              Help Me Choose
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-opacity hover:opacity-70" style={{ color: t.textMuted }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {submittedNeed !== null ? (
            <div className="animate-fade-in">
              <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
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
                        className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all active:scale-[0.98]"
                        style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66` }}
                      >
                        <img
                          src={p.portrait}
                          alt={p.name}
                          className="portrait-arch portrait-grade w-12 h-12 rounded-lg object-cover border flex-shrink-0"
                          style={{ borderColor: p.theme.accent }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold font-display" style={{ color: t.textBright }}>
                            {p.name}
                          </span>
                          <span className="block text-[11px] leading-snug mt-0.5" style={{ color: t.textMuted }}>
                            {why}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: t.textDim }} />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-center mb-4" style={{ color: t.textDim }}>
                    Matched on this device, from the words you used — nothing was sent anywhere.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed mb-5" style={{ color: t.textMuted }}>
                  Nothing in the cast matches those words plainly — that happens, and it is not a dead end.
                  Answer three short questions, or browse the whole cast and trust your eye.
                </p>
              )}
              <button
                onClick={handleRestart}
                className="w-full py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 mb-2"
                style={{ backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.35), color: t.accent }}
              >
                Answer the questions instead
              </button>
              <button
                onClick={() => {
                  handleRestart();
                  onClose();
                }}
                className="w-full py-2 rounded-lg text-xs font-medium border transition-all active:scale-95"
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
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: t.accent }}>
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
                    className="w-full rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed resize-none outline-none"
                    style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.text }}
                  />
                  <button
                    onClick={handleSubmitNeed}
                    disabled={needText.trim().length < 3}
                    className="w-full mt-2 py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 disabled:opacity-40"
                    style={{ backgroundColor: t.accentRgba(0.1), borderColor: t.accentRgba(0.35), color: t.accent }}
                  >
                    Find who fits
                  </button>
                  <div className="flex items-center gap-3 mt-5">
                    <span className="flex-1 h-px" style={{ backgroundColor: `${t.border}66` }} />
                    <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
                      or answer three questions
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

              <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h4 className="text-base font-bold font-display mb-4" style={{ color: t.textBright }}>
                {QUESTIONS[step].prompt}
              </h4>

              <div className="space-y-2">
                {QUESTIONS[step].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(opt.value)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all active:scale-[0.98] text-left"
                    style={{
                      backgroundColor: `${t.border}40`,
                      borderColor: `${t.border}66`,
                      color: t.text,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = t.accentRgba(0.08);
                      e.currentTarget.style.borderColor = t.accentRgba(0.3);
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = `${t.border}40`;
                      e.currentTarget.style.borderColor = `${t.border}66`;
                    }}
                  >
                    <span className="text-sm font-medium">{opt.label}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: t.textDim }} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center animate-fade-in">
              <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
                Your Companion
              </p>
              <div className="flex justify-center mb-4">
                <img
                  src={recommended.portrait}
                  alt={recommended.name}
                  className="portrait-arch portrait-grade w-24 h-24 rounded-xl object-cover border-2"
                  style={{ borderColor: recommended.theme.accent }}
                />
              </div>
              <h3 className="text-lg font-bold font-display" style={{ color: recommended.theme.textBright }}>
                {recommended.name}
              </h3>
              <p className="text-xs mb-4" style={{ color: t.textDim }}>
                {recommended.title}
              </p>
              <div
                className="rounded-lg px-4 py-3 border mb-5 text-left"
                style={{ backgroundColor: t.accentRgba(0.05), borderColor: t.accentRgba(0.15) }}
              >
                <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
                  {reason}
                </p>
              </div>
              <button
                onClick={() => {
                  onSelect(recommended);
                  handleRestart();
                }}
                className="w-full py-3 rounded-lg text-sm font-bold transition-all active:scale-95 mb-2"
                style={{ backgroundColor: recommended.theme.accent, color: '#ffffff' }}
              >
                Talk with {recommended.name}
              </button>
              <button
                onClick={handleRestart}
                className="w-full py-2 rounded-lg text-xs font-medium border transition-all active:scale-95"
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
