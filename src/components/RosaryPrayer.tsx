import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, CircleDot } from 'lucide-react';
import { PRINT_CHOSEN_FILL_ALPHA, PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';
import type { PersonaTheme } from '@/types';
import { PRAYERS } from '@/data/prayers';

interface RosaryPrayerProps {
  t: PersonaTheme;
}

type MysterySet = 'joyful' | 'sorrowful' | 'glorious' | 'luminous';

interface Mystery {
  name: string;
  scripture: string;
  fruit: string;
  /** One or two plain lines to actually contemplate, drawn from the cited Scripture. */
  meditation: string;
}

export const MYSTERIES: Record<MysterySet, Mystery[]> = {
  joyful: [
    { name: 'The Annunciation', scripture: 'Luke 1:26–38', fruit: 'Humility',
      meditation: 'The angel waits for her answer. Mary asks one question, then gives God her whole life in a sentence: “Be it done unto me according to thy word.”' },
    { name: 'The Visitation', scripture: 'Luke 1:39–56', fruit: 'Love of neighbor',
      meditation: 'Mary hurries to Elizabeth, and the child in Elizabeth’s womb leaps. Her answer to praise is the Magnificat — she points everything back to God.' },
    { name: 'The Nativity', scripture: 'Luke 2:1–20', fruit: 'Poverty of spirit',
      meditation: 'The Son of God is born in a stable and laid in a feeding trough. Shepherds — the lowest men in the county — are the first ones told.' },
    { name: 'The Presentation', scripture: 'Luke 2:22–40', fruit: 'Obedience',
      meditation: 'Forty days old, and already Simeon calls Him a light — and tells His mother a sword will pierce her soul. She offers Him anyway.' },
    { name: 'The Finding in the Temple', scripture: 'Luke 2:41–52', fruit: 'Joy in finding Jesus',
      meditation: 'Three days of searching end in the Temple, where the boy is about His Father’s business. Mary does not understand — and keeps it all in her heart.' },
  ],
  sorrowful: [
    { name: 'The Agony in the Garden', scripture: 'Matthew 26:36–46', fruit: 'Sorrow for sin',
      meditation: 'He asks that the cup pass, sweats blood, and then surrenders: “Not as I will, but as thou wilt.” His friends sleep through it.' },
    { name: 'The Scourging at the Pillar', scripture: 'John 19:1', fruit: 'Purity',
      meditation: 'Pilate has Him whipped — an innocent man torn open to quiet a crowd. He says nothing in His own defense.' },
    { name: 'The Crowning with Thorns', scripture: 'Matthew 27:27–31', fruit: 'Courage',
      meditation: 'A crown of thorns, a reed for a scepter, soldiers spitting and mocking. The King is crowned with contempt — and does not call down heaven.' },
    { name: 'The Carrying of the Cross', scripture: 'John 19:17', fruit: 'Patience',
      meditation: 'He carries the wood of His own execution through the streets. Every step is a choice to keep going toward the hill.' },
    { name: 'The Crucifixion', scripture: 'Luke 23:33–46', fruit: 'Perseverance',
      meditation: 'Nailed between criminals, He forgives His killers, gives His mother to John, and breathes His last trusting the Father: “Into thy hands I commend my spirit.”' },
  ],
  glorious: [
    { name: 'The Resurrection', scripture: 'John 20:1–18', fruit: 'Faith',
      meditation: 'The tomb is empty before dawn. Mary Magdalene hears her name — “Mary” — and the grief breaks: He is alive, and He calls her by name.' },
    { name: 'The Ascension', scripture: 'Acts 1:6–11', fruit: 'Hope',
      meditation: 'Forty days after rising, He ascends before their eyes, promising the Spirit. They return to Jerusalem not crushed, but waiting in prayer.' },
    { name: 'The Descent of the Holy Spirit', scripture: 'Acts 2:1–13', fruit: 'Wisdom',
      meditation: 'Wind and fire in an upper room, and the men who hid behind locked doors preach in the open street. Three thousand are baptized that day.' },
    { name: 'The Assumption', scripture: 'Revelation 12:1', fruit: 'Grace of a happy death',
      meditation: 'A woman clothed with the sun. Where Mary has gone — body and soul into heaven — is where her Son means to bring all of us.' },
    { name: 'The Coronation', scripture: 'Revelation 12:1', fruit: 'Trust in Mary\'s intercession',
      meditation: 'Mary reigns not by grasping but by having said yes. The handmaid is queen, and her crown is her Son’s gift, not her ambition.' },
  ],
  luminous: [
    { name: 'The Baptism of Jesus', scripture: 'Matthew 3:13–17', fruit: 'Openness to the Holy Spirit',
      meditation: 'Jesus wades into the Jordan He does not need, and heaven opens: “This is my beloved Son.” He begins His work by standing with sinners.' },
    { name: 'The Wedding at Cana', scripture: 'John 2:1–11', fruit: 'To Jesus through Mary',
      meditation: '“They have no wine.” At His mother’s word, water becomes wine — the first sign, given at a wedding feast, before the hour had come.' },
    { name: 'The Proclamation of the Kingdom', scripture: 'Mark 1:14–15', fruit: 'Repentance',
      meditation: '“The time is accomplished: repent, and believe the gospel.” The Kingdom is not a place on a map; it starts wherever a man turns back to God.' },
    { name: 'The Transfiguration', scripture: 'Matthew 17:1–8', fruit: 'Desire for holiness',
      meditation: 'On the mountain His face shines like the sun, and the Father repeats the word from the Jordan: “Hear ye him.” Glory, shown briefly, to carry them through the Cross.' },
    { name: 'The Institution of the Eucharist', scripture: 'Matthew 26:26–29', fruit: 'Adoration',
      meditation: '“This is my body… this is my blood.” The night before He dies, He gives Himself as food — and tells them to do this in His memory.' },
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

/**
 * The prayer texts are read off the one shared shelf (src/data/prayers.ts) —
 * the same texts the Prayer Library prints — so the Rosary can never drift
 * into a second, divergent copy. That drift is exactly what the Pocket
 * Church audit found (Nov 20, 2026): the Rosary's own Hail, Holy Queen was
 * truncated while the library's copy was complete. One shelf, one text.
 */
const shelfText = (title: string) => PRAYERS.find((p) => p.title === title)?.text ?? '';

const OUR_FATHER = shelfText('Our Father');
const HAIL_MARY = shelfText('Hail Mary');
const GLORY_BE = shelfText('Glory Be');
const APOSTLES_CREED = shelfText('Apostles\' Creed');
const HAIL_HOLY_QUEEN = shelfText('Hail, Holy Queen');

const FATIMA_PRAYER =
  'O my Jesus, forgive us our sins,\nsave us from the fires of hell,\nlead all souls to Heaven,\nespecially those most in need\nof Thy mercy.';

/** The Rosary's traditional ending: the versicle after the Salve Regina and
 *  the concluding prayer (the collect for the feast of the Holy Rosary). */
const CONCLUDING_PRAYER =
  'V. Pray for us, O holy Mother of God.\nR. That we may be made worthy of the promises of Christ.\n\nLet us pray.\n\nO God, whose only-begotten Son, by His life, death, and resurrection, has purchased for us the rewards of eternal life, grant, we beseech Thee, that meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord.\n\nAmen.';

/** What each of the three introductory Hail Marys is offered for. */
const INTRO_HAIL_MARY_FOR = ['faith', 'hope', 'love'];

type Phase =
  | { kind: 'creed' }
  | { kind: 'our-father-intro' }
  | { kind: 'intro-hail-mary'; index: number }
  | { kind: 'intro-glory-be' }
  | { kind: 'decade'; decadeIndex: number; beadIndex: number }
  | { kind: 'hail-holy-queen' }
  | { kind: 'concluding' };

/** Creed, Our Father, three Hail Marys, Glory Be, five decades of eleven
 *  steps, the Hail, Holy Queen, and the concluding prayer. */
function totalSteps(): number {
  return 1 + 1 + 3 + 1 + 5 * 11 + 1 + 1;
}

function stepFromPhase(phase: Phase): number {
  if (phase.kind === 'creed') return 0;
  if (phase.kind === 'our-father-intro') return 1;
  if (phase.kind === 'intro-hail-mary') return 1 + phase.index;
  if (phase.kind === 'intro-glory-be') return 5;
  if (phase.kind === 'hail-holy-queen') return totalSteps() - 2;
  if (phase.kind === 'concluding') return totalSteps() - 1;
  return 6 + phase.decadeIndex * 11 + phase.beadIndex;
}

function phaseFromStep(step: number): Phase {
  if (step === 0) return { kind: 'creed' };
  if (step === 1) return { kind: 'our-father-intro' };
  if (step >= 2 && step <= 4) return { kind: 'intro-hail-mary', index: step - 1 };
  if (step === 5) return { kind: 'intro-glory-be' };
  if (step === totalSteps() - 2) return { kind: 'hail-holy-queen' };
  if (step >= totalSteps() - 1) return { kind: 'concluding' };
  const relative = step - 6;
  const decadeIndex = Math.floor(relative / 11);
  const beadIndex = relative % 11;
  return { kind: 'decade', decadeIndex, beadIndex };
}

function prayerForPhase(phase: Phase): { title: string; text: string; sub?: string } {
  if (phase.kind === 'creed') return { title: 'Apostles\' Creed', text: APOSTLES_CREED, sub: 'Begin with the sign of the cross.' };
  if (phase.kind === 'our-father-intro') return { title: 'Our Father', text: OUR_FATHER, sub: 'Then three Hail Marys for faith, hope, and love.' };
  if (phase.kind === 'intro-hail-mary') {
    return {
      title: `Hail Mary ${phase.index} of 3`,
      text: HAIL_MARY,
      sub: `For ${INTRO_HAIL_MARY_FOR[phase.index - 1]}.`,
    };
  }
  if (phase.kind === 'intro-glory-be') return { title: 'Glory Be', text: GLORY_BE };
  if (phase.kind === 'hail-holy-queen') return { title: 'Hail, Holy Queen', text: HAIL_HOLY_QUEEN };
  if (phase.kind === 'concluding') return { title: 'Concluding Prayer', text: CONCLUDING_PRAYER, sub: 'Finish with the sign of the cross.' };
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
    <div className="px-1 pt-4" style={{ borderTop: `3px double ${t.border}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CircleDot className="w-4 h-4" style={{ color: t.accent }} />
        <h3 className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          The Holy Rosary
        </h3>
      </div>

      {/* Mystery set selector — small plates; the day's set wears the accent. */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(Object.keys(MYSTERIES) as MysterySet[]).map((set) => (
          <button
            key={set}
            onClick={() => handleSetChange(set)}
            aria-pressed={mysterySet === set}
            className="min-h-[40px] px-3 py-1.5 text-[12px] font-bold transition-opacity hover:opacity-80 active:opacity-60"
            style={
              mysterySet === set
                ? { backgroundColor: `${t.accent}${PRINT_CHOSEN_FILL_ALPHA}`, color: t.accent, border: `1px solid ${t.accent}` }
                : { backgroundColor: `${t.border}1F`, color: t.textDim, border: `1px solid ${t.border}` }
            }
          >
            <span style={{ fontFamily: PRINT_SERIF }}>{SET_LABELS[set]}</span>
          </button>
        ))}
      </div>

      {/* Mystery name banner (during decades) — a ruled inset, now carrying
          the meditation itself, not only the mystery's name (audit item 4). */}
      {currentMystery && (
        <div
          className="px-4 py-3 mb-4 border text-center animate-fade-in"
          style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.2) }}
        >
          <p className="text-[12px] uppercase tracking-widest font-bold mb-1" style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
            {SET_LABELS[mysterySet]} Mystery · {phase.kind === 'decade' ? phase.decadeIndex + 1 : 1} of 5
          </p>
          <p className="text-sm font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {currentMystery.name}
          </p>
          <p className="text-[12px] mt-1" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            {currentMystery.scripture} · Fruit: {currentMystery.fruit}
          </p>
          <p className="text-[13px] leading-relaxed mt-2" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {currentMystery.meditation}
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

      {/* Prayer text — a ruled inset on the leaf. */}
      <div
        className="px-4 py-4 mb-4 border"
        style={{ backgroundColor: `${t.border}14`, borderColor: t.border }}
      >
        <p className={PRINT_STAMP_CLASS} style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          {prayer.title}
        </p>
        {prayer.sub && (
          <p className="text-[12px] italic mt-2" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            {prayer.sub}
          </p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap mt-2" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
          {prayer.text}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] uppercase tracking-widest font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            Progress
          </span>
          <span className="text-[12px] font-bold" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
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

      {/* Controls — plates to step back or restart; the way forward is solid. */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="min-h-[48px] flex items-center gap-1 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-30"
          style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.textMuted }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-bold" style={{ fontFamily: PRINT_SERIF }}>Back</span>
        </button>

        <button
          onClick={handleReset}
          className="min-h-[48px] flex items-center gap-1 px-3 py-2.5 border transition-opacity hover:opacity-80 active:opacity-60"
          style={{ backgroundColor: `${t.border}1F`, borderColor: t.border, color: t.textDim }}
          aria-label="Restart rosary"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleNext}
          disabled={step === maxStep}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-1.5 px-4 py-2.5 transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50"
          style={{ backgroundColor: t.accent, color: '#ffffff' }}
        >
          <span className="text-xs font-bold" style={{ fontFamily: PRINT_SERIF }}>
            {step === maxStep ? 'Complete' : 'Next Prayer'}
          </span>
          {step < maxStep && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {step === maxStep && (
        <p className="text-center text-xs italic mt-4 animate-fade-in" style={{ fontFamily: PRINT_SERIF, color: t.accent }}>
          You have prayed the Rosary. May Mary present your intentions to her Son.
        </p>
      )}
    </div>
  );
}
