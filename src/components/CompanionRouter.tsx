import { useState } from 'react';
import { Compass, X, ChevronRight } from 'lucide-react';
import { PERSONAS } from '@/personas';
import type { Persona, PersonaTheme } from '@/types';

interface CompanionRouterProps {
  t: PersonaTheme;
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

function getRecommendation(answers: Answer[]): { persona: Persona; reason: string } {
  const key = answers.join('-');
  const rec = RECOMMENDATIONS[key];
  if (rec) {
    const persona = PERSONAS.find((p) => p.id === rec.personaId) ?? PERSONAS[0];
    return { persona, reason: rec.reason };
  }
  // Fallback: match by first answer
  const firstAnswer = answers[0];
  const fallbackMap: Record<string, string> = {
    overwhelmed: 'moses',
    failing: 'peter',
    restless: 'augustine',
    direction: 'ignatius',
    responsibility: 'joseph',
    marriage: 'therese',
  };
  const pid = fallbackMap[firstAnswer] ?? 'joseph';
  const persona = PERSONAS.find((p) => p.id === pid) ?? PERSONAS[0];
  return {
    persona,
    reason: `${persona.name} speaks to men like you. Read the card and see if the voice fits — you can always switch.`,
  };
}

export function CompanionRouter({ t, open, onClose, onSelect }: CompanionRouterProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);

  if (!open) return null;

  const isDone = step >= QUESTIONS.length;
  const { persona: recommended, reason } = isDone ? getRecommendation(answers) : { persona: null, reason: '' };
  // Gate on the resolved persona, not on `isDone`, so TypeScript narrows the null away.
  const showResult = recommended !== null;

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    setStep(step + 1);
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers([]);
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
          {!showResult ? (
            <div className="animate-fade-in">
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
                  className="w-24 h-24 rounded-xl object-cover border-2"
                  style={{ borderColor: recommended.theme.accent, filter: 'contrast(1.1) saturate(0.9)' }}
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
