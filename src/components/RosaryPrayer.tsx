import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, CircleDot } from 'lucide-react';
import type { PersonaTheme } from '@/types';

interface RosaryPrayerProps {
  t: PersonaTheme;
}

type MysterySet = 'joyful' | 'sorrowful' | 'glorious' | 'luminous';

interface Mystery {
  name: string;
  scripture: string;
  fruit: string;
}

const MYSTERIES: Record<MysterySet, Mystery[]> = {
  joyful: [
    { name: 'The Annunciation', scripture: 'Luke 1:26–38', fruit: 'Humility' },
    { name: 'The Visitation', scripture: 'Luke 1:39–56', fruit: 'Love of neighbor' },
    { name: 'The Nativity', scripture: 'Luke 2:1–20', fruit: 'Poverty of spirit' },
    { name: 'The Presentation', scripture: 'Luke 2:22–40', fruit: 'Obedience' },
    { name: 'The Finding in the Temple', scripture: 'Luke 2:41–52', fruit: 'Joy in finding Jesus' },
  ],
  sorrowful: [
    { name: 'The Agony in the Garden', scripture: 'Matthew 26:36–46', fruit: 'Sorrow for sin' },
    { name: 'The Scourging at the Pillar', scripture: 'John 19:1', fruit: 'Purity' },
    { name: 'The Crowning with Thorns', scripture: 'Matthew 27:27–31', fruit: 'Courage' },
    { name: 'The Carrying of the Cross', scripture: 'John 19:17', fruit: 'Patience' },
    { name: 'The Crucifixion', scripture: 'Luke 23:33–46', fruit: 'Perseverance' },
  ],
  glorious: [
    { name: 'The Resurrection', scripture: 'John 20:1–18', fruit: 'Faith' },
    { name: 'The Ascension', scripture: 'Acts 1:6–11', fruit: 'Hope' },
    { name: 'The Descent of the Holy Spirit', scripture: 'Acts 2:1–13', fruit: 'Wisdom' },
    { name: 'The Assumption', scripture: 'Revelation 12:1', fruit: 'Grace of a happy death' },
    { name: 'The Coronation', scripture: 'Revelation 12:1', fruit: 'Trust in Mary\'s intercession' },
  ],
  luminous: [
    { name: 'The Baptism of Jesus', scripture: 'Matthew 3:13–17', fruit: 'Openness to the Holy Spirit' },
    { name: 'The Wedding at Cana', scripture: 'John 2:1–11', fruit: 'To Jesus through Mary' },
    { name: 'The Proclamation of the Kingdom', scripture: 'Mark 1:14–15', fruit: 'Repentance' },
    { name: 'The Transfiguration', scripture: 'Matthew 17:1–8', fruit: 'Desire for holiness' },
    { name: 'The Institution of the Eucharist', scripture: 'Matthew 26:26–29', fruit: 'Adoration' },
  ],
};

const SET_LABELS: Record<MysterySet, string> = {
  joyful: 'Joyful',
  sorrowful: 'Sorrowful',
  glorious: 'Glorious',
  luminous: 'Luminous',
};

function defaultMysterySet(): MysterySet {
  const day = new Date().getDay();
  if (day === 0 || day === 3) return 'glorious';
  if (day === 1 || day === 6) return 'joyful';
  if (day === 2 || day === 5) return 'sorrowful';
  return 'luminous';
}

const OUR_FATHER =
  'Our Father, who art in heaven,\nhallowed be Thy name;\nThy kingdom come;\nThy will be done on earth\nas it is in heaven.\n\nGive us this day our daily bread;\nand forgive us our trespasses,\nas we forgive those who trespass\nagainst us;\nand lead us not into temptation,\nbut deliver us from evil.\n\nAmen.';

const HAIL_MARY =
  'Hail Mary, full of grace,\nthe Lord is with thee.\nBlessed art thou among women,\nand blessed is the fruit of\nthy womb, Jesus.\n\nHoly Mary, Mother of God,\npray for us sinners,\nnow and at the hour of our death.\n\nAmen.';

const GLORY_BE =
  'Glory be to the Father,\nand to the Son,\nand to the Holy Spirit.\n\nAs it was in the beginning,\nis now, and ever shall be,\nworld without end.\n\nAmen.';

const FATIMA_PRAYER =
  'O my Jesus, forgive us our sins,\nsave us from the fires of hell,\nlead all souls to Heaven,\nespecially those most in need\nof Thy mercy.';

const HAIL_HOLY_QUEEN =
  'Hail, Holy Queen, Mother of Mercy,\nour life, our sweetness, and our hope.\nTo thee do we cry, poor banished children of Eve;\nto thee do we send up our sighs,\nmourning and weeping in this valley of tears.\n\nTurn then, most gracious Advocate,\nthine eyes of mercy toward us,\nand after this our exile,\nshow unto us the blessed fruit of thy womb, Jesus.\n\nO clement, O loving, O sweet Virgin Mary!';

const APOSTLES_CREED =
  'I believe in God, the Father almighty,\nCreator of heaven and earth,\nand in Jesus Christ, his only Son, our Lord,\nwho was conceived by the Holy Spirit,\nborn of the Virgin Mary,\nsuffered under Pontius Pilate,\nwas crucified, died and was buried;\nhe descended into hell;\non the third day he rose again from the dead;\nhe ascended into heaven,\nand is seated at the right hand of God\nthe Father almighty;\nfrom there he will come to judge\nthe living and the dead.\n\nI believe in the Holy Spirit,\nthe holy catholic Church,\nthe communion of saints,\nthe forgiveness of sins,\nthe resurrection of the body,\nand life everlasting.\n\nAmen.';

type Phase =
  | { kind: 'creed' }
  | { kind: 'our-father-intro' }
  | { kind: 'decade'; decadeIndex: number; beadIndex: number }
  | { kind: 'closing' };

function totalSteps(): number {
  return 1 + 1 + 5 * 11 + 1;
}

function stepFromPhase(phase: Phase): number {
  if (phase.kind === 'creed') return 0;
  if (phase.kind === 'our-father-intro') return 1;
  if (phase.kind === 'closing') return totalSteps() - 1;
  return 2 + phase.decadeIndex * 11 + phase.beadIndex;
}

function phaseFromStep(step: number): Phase {
  if (step === 0) return { kind: 'creed' };
  if (step === 1) return { kind: 'our-father-intro' };
  if (step >= totalSteps() - 1) return { kind: 'closing' };
  const relative = step - 2;
  const decadeIndex = Math.floor(relative / 11);
  const beadIndex = relative % 11;
  return { kind: 'decade', decadeIndex, beadIndex };
}

function prayerForPhase(phase: Phase): { title: string; text: string; sub?: string } {
  if (phase.kind === 'creed') return { title: 'Apostles\' Creed', text: APOSTLES_CREED, sub: 'Begin with the sign of the cross.' };
  if (phase.kind === 'our-father-intro') return { title: 'Our Father', text: OUR_FATHER, sub: 'Then three Hail Marys for faith, hope, and love.' };
  if (phase.kind === 'closing') return { title: 'Hail, Holy Queen', text: HAIL_HOLY_QUEEN, sub: 'Finish with the sign of the cross.' };
  const { beadIndex } = phase;
  if (beadIndex === 0) return { title: 'Our Father', text: OUR_FATHER };
  if (beadIndex >= 1 && beadIndex <= 10) return { title: `Hail Mary ${beadIndex} of 10`, text: HAIL_MARY };
  return { title: 'Glory Be & Fatima Prayer', text: `${GLORY_BE}\n\n${FATIMA_PRAYER}` };
}

function decadeBeads(phase: Phase): { filled: number; total: number } {
  if (phase.kind !== 'decade') return { filled: 0, total: 10 };
  if (phase.beadIndex === 0) return { filled: 0, total: 10 };
  if (phase.beadIndex <= 10) return { filled: phase.beadIndex, total: 10 };
  return { filled: 10, total: 10 };
}

export function RosaryPrayer({ t }: RosaryPrayerProps) {
  const [mysterySet, setMysterySet] = useState<MysterySet>(defaultMysterySet);
  const [step, setStep] = useState(0);

  const maxStep = totalSteps() - 1;
  const phase = useMemo(() => phaseFromStep(step), [step]);
  const prayer = prayerForPhase(phase);
  const beads = decadeBeads(phase);
  const mysteries = MYSTERIES[mysterySet];
  const currentMystery = phase.kind === 'decade' ? mysteries[phase.decadeIndex] : null;
  const progress = Math.round((step / maxStep) * 100);

  const handleNext = () => setStep((s) => Math.min(s + 1, maxStep));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 0));
  const handleReset = () => setStep(0);
  const handleSetChange = (set: MysterySet) => {
    setMysterySet(set);
    setStep(0);
  };

  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CircleDot className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
          The Holy Rosary
        </h3>
      </div>

      {/* Mystery set selector */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(Object.keys(MYSTERIES) as MysterySet[]).map((set) => (
          <button
            key={set}
            onClick={() => handleSetChange(set)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border"
            style={
              mysterySet === set
                ? { backgroundColor: t.accentRgba(0.15), color: t.accent, borderColor: t.accentRgba(0.4) }
                : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}80` }
            }
          >
            {SET_LABELS[set]}
          </button>
        ))}
      </div>

      {/* Mystery name banner (during decades) */}
      {currentMystery && (
        <div
          className="rounded-lg px-4 py-3 mb-4 border text-center animate-fade-in"
          style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.2) }}
        >
          <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: t.accent }}>
            {SET_LABELS[mysterySet]} Mystery · {phase.kind === 'decade' ? phase.decadeIndex + 1 : 1} of 5
          </p>
          <p className="text-sm font-bold font-display" style={{ color: t.textBright }}>
            {currentMystery.name}
          </p>
          <p className="text-[11px] mt-1" style={{ color: t.textDim }}>
            {currentMystery.scripture} · Fruit: {currentMystery.fruit}
          </p>
        </div>
      )}

      {/* Bead progress (during decades) */}
      {phase.kind === 'decade' && (
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < beads.filled ? t.accent : `${t.border}80`,
                transform: i < beads.filled ? 'scale(1.15)' : 'scale(1)',
                boxShadow: i === beads.filled - 1 ? `0 0 8px ${t.accentRgba(0.5)}` : 'none',
              }}
            />
          ))}
        </div>
      )}

      {/* Prayer text */}
      <div
        className="rounded-lg px-4 py-4 mb-4 border"
        style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}33` }}
      >
        <p className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: t.accent }}>
          {prayer.title}
        </p>
        {prayer.sub && (
          <p className="text-[11px] italic mb-2" style={{ color: t.textDim }}>
            {prayer.sub}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
          {prayer.text}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
            Progress
          </span>
          <span className="text-[10px] font-bold" style={{ color: t.textDim }}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${t.border}80` }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: t.accent }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="flex items-center gap-1 px-3 py-2.5 rounded-lg border transition-all active:scale-95 disabled:opacity-30"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textMuted }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-bold">Back</span>
        </button>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-2.5 rounded-lg border transition-all active:scale-95"
          style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textDim }}
          aria-label="Restart rosary"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleNext}
          disabled={step === maxStep}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: t.accent, color: '#ffffff' }}
        >
          <span className="text-xs font-bold">
            {step === maxStep ? 'Complete' : 'Next Prayer'}
          </span>
          {step < maxStep && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {step === maxStep && (
        <p className="text-center text-xs mt-4 animate-fade-in" style={{ color: t.accent }}>
          You have prayed the Rosary. May Mary present your intentions to her Son.
        </p>
      )}
    </div>
  );
}
