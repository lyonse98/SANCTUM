import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import {
  AUDIO_PM_START_HOUR,
  BANK,
  BANNED_BANK_PATTERNS,
  DRAFT_BANK_LINES,
  LECTOR_BANK,
  LEXICON,
  TIME_NEUTRAL_LINT,
  applyLexicon,
  assembleScript,
  bookChapterSpoken,
  citationChapters,
  computeWeekLabel,
  gospelTouchesPassion,
  isSoberDay,
  isTeaserSuppressed,
  pickVariant,
  resolveFeastDay,
  saintLineFor,
  spokenizeOrdinals,
  validateScene,
  type AssembleInputs,
  type PersonaId,
} from './narratorCore';
import { getFeastForDate } from '@/data/feastDays';
import { SAINTS } from '@/data/saints';

const PERSONAS: PersonaId[] = ['henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed'];

// ── The Oct 30, 2026 bundle — the approved samples' own day (spec §10.3) ──────

const OCT30: AssembleInputs = {
  dateISO: '2026-10-30',
  celebration: 'Friday of the 30th week of Ordinary Time',
  gospelCitation: 'Luke 14:1-6',
  gospelText:
    'When he went into the house of one of the rulers of the Pharisees on a Sabbath to eat bread, they were watching him. Behold, a certain man who had dropsy was in front of him. Jesus, answering, spoke to the lawyers and Pharisees, saying, "Is it lawful to heal on the Sabbath?" But they were silent. He took him, and healed him, and let him go. He answered them, "Which of you, if your son or an ox fell into a well, wouldn\'t immediately pull him out on a Sabbath day?" They couldn\'t answer him regarding these things.',
  reflect:
    "Where are you hiding behind the rules or playing it safe instead of stepping into someone else's mess to help them? Jesus saw a hurting man and acted immediately, even with critics watching his every move.",
  challenge:
    'Step toward the person you usually avoid at work or at home today, look them in the eye, and offer them real help with whatever burden they are carrying.',
  facet: 'As a man',
  scene:
    "Jesus is at dinner in a Pharisee's house, and everybody at the table is watching him, waiting to see what he'll do. There's a sick man standing there. And the whole room knows the rule. Listen to what Jesus does with the rule.",
  tomorrowCelebration: 'Saturday of the 30th week of Ordinary Time',
  tomorrowGospelCitation: 'Luke 14:1, 7-11',
};

/** A feria fixture on the persona's own weekday, in the same week as the samples. */
function feriaFixture(persona: PersonaId): AssembleInputs {
  const dates: Record<PersonaId, [string, string]> = {
    henry: ['2026-10-25', 'Sunday of the 30th week of Ordinary Time'],
    coach: ['2026-10-26', 'Monday of the 30th week of Ordinary Time'],
    frank: ['2026-10-27', 'Tuesday of the 30th week of Ordinary Time'],
    ben: ['2026-10-28', 'Wednesday of the 30th week of Ordinary Time'],
    martin: ['2026-10-29', 'Thursday of the 30th week of Ordinary Time'],
    tom: ['2026-10-30', 'Friday of the 30th week of Ordinary Time'],
    ed: ['2026-10-31', 'Saturday of the 30th week of Ordinary Time'],
  };
  const [dateISO, celebration] = dates[persona];
  return { ...OCT30, dateISO, celebration };
}

describe('sync — the function runs the identical core', () => {
  it('audio-render/narratorCore.ts matches src/lib/narratorCore.ts', () => {
    const out = execFileSync('node', ['scripts/sync-narrator-core.mjs', '--check'], { encoding: 'utf8' });
    expect(out).toContain('in sync');
  });
});

describe('bank integrity (§10.1)', () => {
  it('every persona carries the full slot set', () => {
    for (const id of PERSONAS) {
      const bank = BANK[id];
      expect(bank.signOnsAM.length, `${id} signOnsAM`).toBeGreaterThanOrEqual(3);
      expect(bank.signOnsPM.length, `${id} signOnsPM`).toBeGreaterThanOrEqual(2);
      expect(bank.signOffs.length, `${id} signOffs`).toBeGreaterThanOrEqual(2);
      expect(bank.sceneLeadIns.length, `${id} sceneLeadIns`).toBeGreaterThanOrEqual(2);
      expect(bank.teaserTemplates.length, `${id} teaserTemplates`).toBeGreaterThanOrEqual(2);
      expect(bank.soberSignOnsAM.length, `${id} soberAM`).toBeGreaterThanOrEqual(1);
      expect(bank.soberSignOnsPM.length, `${id} soberPM`).toBeGreaterThanOrEqual(1);
      expect(bank.frameFeriaAM.length).toBeGreaterThan(10);
      expect(bank.frameFeriaPM.length).toBeGreaterThan(10);
      expect(bank.frameMemorialAM.length).toBeGreaterThan(10);
      expect(bank.frameMemorialPM.length).toBeGreaterThan(10);
      expect(bank.soberFrame.length).toBeGreaterThan(5);
      expect(bank.reflectionHandoff.length).toBeGreaterThan(3);
      expect(bank.challengeHandoff).toContain('{facetLower}');
    }
  });

  it('the voices are the Charter table — and Puck is nowhere', () => {
    const voices = PERSONAS.map((id) => BANK[id].voice);
    expect(voices).toEqual(['Algenib', 'Sadachbia', 'Zubenelgenubi', 'Iapetus', 'Schedar', 'Enceladus', 'Achird']);
    expect(LECTOR_BANK.voice).toBe('Charon');
    expect([...voices, LECTOR_BANK.voice]).not.toContain('Puck');
    expect(BANK.henry.tempo).toBe(0.88);
    expect(BANK.coach.tempo).toBe(1.08);
    expect(BANK.martin.tempo).toBe(0.94);
    expect(BANK.tom.tempo).toBe(0.9);
    expect(BANK.ed.tempo).toBe(1.02);
  });

  it('no bank line carries a Charter banned shape', () => {
    const everyLine: string[] = [];
    for (const id of PERSONAS) {
      const b = BANK[id];
      everyLine.push(
        ...b.signOnsAM, ...b.signOnsPM, ...b.signOffs, ...b.sceneLeadIns,
        ...b.teaserTemplates, ...b.soberSignOnsAM, ...b.soberSignOnsPM,
        b.frameFeriaAM, b.frameFeriaPM, b.frameMemorialAM, b.frameMemorialPM,
        b.soberFrame, b.reflectionHandoff, b.challengeHandoff,
      );
    }
    everyLine.push(LECTOR_BANK.frameSolemnity, LECTOR_BANK.reflectionHandoff, LECTOR_BANK.challengeHandoff);
    for (const line of everyLine) {
      for (const pattern of BANNED_BANK_PATTERNS) {
        expect(pattern.test(line), `"${line}" vs ${pattern}`).toBe(false);
      }
    }
  });

  it('every draft line in the registry is a line the bank actually speaks', () => {
    expect(DRAFT_BANK_LINES.length).toBeGreaterThanOrEqual(50);
    for (const entry of DRAFT_BANK_LINES) {
      if (entry.persona === 'lector') {
        expect(Object.values(LECTOR_BANK)).toContain(entry.text);
      } else {
        const bank = BANK[entry.persona];
        const all = [
          ...bank.signOnsAM, ...bank.signOnsPM, ...bank.signOffs, ...bank.sceneLeadIns,
          ...bank.teaserTemplates, ...bank.soberSignOnsAM, ...bank.soberSignOnsPM,
          bank.frameFeriaAM, bank.frameFeriaPM, bank.frameMemorialAM, bank.frameMemorialPM, bank.soberFrame,
        ];
        expect(all, `${entry.persona}/${entry.slot}`).toContain(entry.text);
      }
    }
  });

  it('the PM boundary constant is 15:00', () => {
    expect(AUDIO_PM_START_HOUR).toBe(15);
  });
});

describe('rotation (§10.2)', () => {
  it('is deterministic for fixed inputs', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickVariant('2026-11-02', 'ben', 'signOnAM', 3)).toBe(pickVariant('2026-11-02', 'ben', 'signOnAM', 3));
    }
  });

  it('spreads 365 days across 3 variants with no dead or hogging variant', () => {
    const counts = [0, 0, 0];
    let iso = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      counts[pickVariant(iso, 'ben', 'signOnAM', 3)] += 1;
      const [y, m, d] = iso.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d) + 86400000);
      iso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
    }
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(60);
  });

  it('AM and PM sign-on sets differ for every persona (the bank intends a difference)', () => {
    for (const id of PERSONAS) {
      const am = new Set(BANK[id].signOnsAM);
      const pm = new Set(BANK[id].signOnsPM);
      const same = am.size === pm.size && [...am].every((l) => pm.has(l));
      expect(same, id).toBe(false);
    }
  });
});

describe('calendar resolution — drift checks against the app data', () => {
  it('the ported feast table agrees with getFeastForDate on all of 2026', () => {
    let mismatches = 0;
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const dt = new Date(2026, month - 1, day, 12);
        if (dt.getMonth() !== month - 1) continue;
        const iso = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const ported = resolveFeastDay(iso);
        const app = getFeastForDate(dt);
        const a = ported ? `${ported.name}|${ported.rank}` : 'null';
        const b = app ? `${app.name}|${app.rank}` : 'null';
        if (a !== b) mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
  });

  it('the ported saint lines are the first sentences of the app bios', () => {
    const seen = new Set<string>();
    for (const saint of SAINTS) {
      if (seen.has(saint.feastDate)) continue;
      seen.add(saint.feastDate);
      const expected = saint.shortBio.split(/(?<=[.!?])\s/)[0].trim();
      expect(saintLineFor(`2026-${saint.feastDate}`), saint.name).toBe(expected);
    }
    expect(seen.size).toBeGreaterThan(80);
  });
});

describe('week labels (§10.2, §12.6)', () => {
  // Lectionary strings fetched from the app's own API at build time (Nov 2, 2026).
  const LECT: [string, string][] = [
    ['2026-01-14', 'Wednesday of the 1st week of Ordinary Time'],
    ['2026-03-05', 'Thursday of the 2nd week of Lent'],
    ['2026-04-15', 'Wednesday of the 2nd week of Easter'],
    ['2026-10-30', 'Friday of the 30th week of Ordinary Time'],
  ];

  it('computed labels agree with the lectionary strings', () => {
    // Agreement = same weekday, same week number, same season. The one stylistic
    // delta: the API's "week of Ordinary Time" vs the samples' spoken "Week in
    // Ordinary Time" — normalized away on both sides here (§12.6 records it).
    const normalize = (s: string) => s.toLowerCase().replace('week in ordinary time', 'week of ordinary time');
    for (const [iso, lectionary] of LECT) {
      expect(normalize(spokenizeOrdinals(lectionary)), iso).toBe(normalize(computeWeekLabel(iso) ?? ''));
    }
  });

  it('computes the weeks the frames need on feast days', () => {
    expect(computeWeekLabel('2026-04-29')).toBe('Wednesday of the Fourth Week of Easter');
    expect(computeWeekLabel('2026-06-03')).toBe('Wednesday of the Ninth Week in Ordinary Time');
    expect(computeWeekLabel('2026-09-16')).toBe('Wednesday of the Twenty-Fourth Week in Ordinary Time');
    expect(computeWeekLabel('2026-11-05')).toBe('Thursday of the Thirty-First Week in Ordinary Time');
    expect(computeWeekLabel('2026-12-10')).toBe('Thursday of the Second Week of Advent');
  });

  it('declines where the lectionary has no week label', () => {
    expect(computeWeekLabel('2026-12-28')).toBeNull(); // Christmas season
    expect(computeWeekLabel('2026-02-19')).toBeNull(); // Ash Wednesday stub week
  });
});

describe('frame forms (§10.2 golden fixtures)', () => {
  it('feria frames reproduce the approved character-sheet wording for all seven', () => {
    const expected: Record<PersonaId, string> = {
      henry: "It's Sunday of the Thirtieth Week in Ordinary Time. No feast today. An ordinary day — and He shows up in those, same as the great ones.",
      coach: 'Monday of the Thirtieth Week in Ordinary Time. No feast today. Just a regular Monday — and regular days are where this gets built.',
      frank: "Tuesday of the Thirtieth Week in Ordinary Time. No feast today. Plain workday — He's in it all the same.",
      ben: "It's Wednesday of the Thirtieth Week in Ordinary Time. No feast today — an ordinary Wednesday.",
      martin: 'Thursday of the Thirtieth Week in Ordinary Time. The calendar gives no feast today — an ordinary hour, kept like all the rest.',
      tom: 'Friday of the Thirtieth Week in Ordinary Time. No feast on the calendar tonight. An ordinary watch — He keeps those, too.',
      ed: "It's Saturday of the Thirtieth Week in Ordinary Time. No feast today — just an ordinary Saturday, the kind most of life is made of.",
    };
    for (const id of PERSONAS) {
      const s = assembleScript(feriaFixture(id));
      expect(s.persona).toBe(id);
      expect(s.headPM, id).toContain(expected[id]);
      if (id !== 'tom') expect(s.headAM, id).toContain(expected[id]);
    }
    // Tom's AM head is the end-of-watch draft, and must differ from his PM frame.
    const tom = assembleScript(feriaFixture('tom'));
    expect(tom.headAM).toContain('An ordinary watch, ending');
    expect(tom.headAM).not.toBe(tom.headPM);
  });

  it('memorial with a saint entry: the frame names the saint and speaks one factual line', () => {
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-04-29',
      celebration: 'Saint Catherine of Siena, Virgin and Doctor of The Church, Patron of Europe',
      gospelCitation: 'John 6:35-40',
    });
    expect(s.persona).toBe('ben');
    expect(s.headAM).toContain(
      "It's Wednesday of the Fourth Week of Easter — and today the Church gives us Saint Catherine of Siena, Virgin and Doctor of The Church, Patron of Europe. A Dominican tertiary who counseled popes and cared for the dying.",
    );
  });

  it('memorial without a saint entry: no line is invented', () => {
    expect(saintLineFor('2026-09-16')).toBeNull();
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-09-16',
      celebration: 'Saints Cornelius, Pope, and Cyprian, Bishop, Martyrs',
      gospelCitation: 'Luke 7:31-35',
    });
    expect(s.persona).toBe('ben');
    expect(s.headAM).toContain(
      "It's Wednesday of the Twenty-Fourth Week in Ordinary Time — and today the Church gives us Saints Cornelius, Pope, and Cyprian, Bishop, Martyrs.",
    );
    // The frame ends at the celebration — no biographical sentence follows it.
    expect(s.headAM).not.toContain('reconciliation');
  });

  it('a saint the app knows gets his line (Martin de Porres, Nov 3)', () => {
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-11-03',
      celebration: 'Saint Martin de Porres, Religious',
    });
    expect(s.persona).toBe('frank');
    expect(s.headAM).toContain('A Dominican lay brother in Lima');
  });

  it('solemnity: the Lector reads, both heads the same ritual frame', () => {
    const s = assembleScript({ ...OCT30, dateISO: '2026-11-01', celebration: 'All Saints', gospelCitation: 'Matthew 5:1-12' });
    expect(s.lector).toBe(true);
    expect(s.persona).toBe('lector');
    expect(s.headAM).toBe('Sunday — and today the Church keeps the Solemnity of All Saints.');
    expect(s.headPM).toBe(s.headAM);
    expect(s.teaserIncluded).toBe(false);
    expect(s.sceneIncluded).toBe(false);
  });

  it('solemnity with a "The" name: the article folds into the formula', () => {
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-12-08',
      celebration: 'The Immaculate Conception of the Blessed Virgin Mary',
      gospelCitation: 'Luke 1:26-38',
    });
    expect(s.lector).toBe(true);
    expect(s.headAM).toBe('Tuesday — and today the Church keeps the Solemnity of the Immaculate Conception of the Blessed Virgin Mary.');
  });

  it('All Souls: the weekday brother reads the commemoration frame, teaser present', () => {
    const s = assembleScript({ ...OCT30, dateISO: '2026-11-02', celebration: 'All Souls', gospelCitation: 'John 6:37-40' });
    expect(s.lector).toBe(false);
    expect(s.persona).toBe('coach');
    expect(s.sober).toBe(false);
    expect(s.headAM).toContain('Monday — today is All Souls, the Commemoration of All the Faithful Departed.');
    expect(s.teaserIncluded).toBe(true);
  });
});

describe('suppression and sober gear (§10.2)', () => {
  it('Good Friday: sober, teaser suppressed', () => {
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-04-03',
      celebration: "Good Friday of the Lord's Passion",
      gospelCitation: 'John 18:1—19:42',
    });
    expect(s.persona).toBe('tom');
    expect(s.sober).toBe(true);
    expect(isTeaserSuppressed('2026-04-03')).toBe(true);
    expect(s.teaserIncluded).toBe(false);
    expect(s.headAM).toContain(BANK.tom.soberSignOnsAM[0]);
    expect(s.headAM).toContain(BANK.tom.soberFrame);
  });

  it('Holy Saturday: sober, teaser suppressed', () => {
    const s = assembleScript({ ...OCT30, dateISO: '2026-04-04', celebration: 'Holy Saturday', gospelCitation: 'John 18:1—19:42' });
    expect(s.sober).toBe(true);
    expect(s.teaserIncluded).toBe(false);
    expect(isSoberDay('2026-04-04', 'Luke 24:1-12')).toBe(true);
  });

  it('Palm Sunday: sober via the Passion citation, teaser present, brother reads', () => {
    const s = assembleScript({
      ...OCT30,
      dateISO: '2026-03-29',
      celebration: 'Palm Sunday of the Lord\'s Passion',
      gospelCitation: 'Matthew 26:14—27:66',
    });
    expect(s.persona).toBe('henry');
    expect(s.lector).toBe(false);
    expect(s.sober).toBe(true);
    expect(s.teaserIncluded).toBe(true);
  });

  it('a plain Thursday: Martin, nothing sober, bell is his', () => {
    const s = assembleScript({ ...OCT30, dateISO: '2026-11-05', celebration: 'Thursday of the 31st week of Ordinary Time' });
    expect(s.persona).toBe('martin');
    expect(s.sober).toBe(false);
    expect(s.teaserIncluded).toBe(true);
  });

  it('citation parsing spans chapters and spots the Passion', () => {
    expect(citationChapters('Luke 14:1, 7-11')).toEqual({ book: 'Luke', chapters: [14] });
    expect(citationChapters('Matthew 26:14—27:66')?.chapters).toEqual([26, 27]);
    expect(gospelTouchesPassion('John 18:1—19:42')).toBe(true);
    expect(gospelTouchesPassion('Luke 22:14—23:56')).toBe(true);
    expect(gospelTouchesPassion('Mark 10:46-52')).toBe(false);
    expect(bookChapterSpoken('Luke 14:1, 7-11')).toBe('Luke, chapter fourteen');
  });
});

describe('time-neutrality of the main segment (§10.2)', () => {
  it('no main segment carries time-of-day language, across every variant combination', () => {
    for (const id of PERSONAS) {
      const bank = BANK[id];
      for (let signOff = 0; signOff < bank.signOffs.length; signOff++) {
        for (let teaser = 0; teaser < bank.teaserTemplates.length; teaser++) {
          for (let lead = 0; lead < bank.sceneLeadIns.length; lead++) {
            const s = assembleScript({
              ...feriaFixture(id),
              forceSelections: { signOff, teaser, sceneLeadIn: lead },
            });
            const main = `${s.mainA}\n${s.mainB}`.toLowerCase();
            for (const word of TIME_NEUTRAL_LINT) {
              // The one standing exception: Tom's approved second sign-off is night
              // language by design (the Charter's deliberate change of key).
              if (id === 'tom' && signOff === 1 && word === 'tonight') continue;
              expect(main.includes(word), `${id} signOff=${signOff} teaser=${teaser} lead=${lead} word=${word}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it("Tom's exception is exactly one line", () => {
    const offenders: string[] = [];
    for (const id of PERSONAS) {
      const b = BANK[id];
      const mainSlotLines = [...b.signOffs, ...b.teaserTemplates, ...b.sceneLeadIns, b.reflectionHandoff, b.challengeHandoff];
      for (const line of mainSlotLines) {
        const lower = line.toLowerCase();
        if (TIME_NEUTRAL_LINT.some((w) => lower.includes(w))) offenders.push(`${id}: ${line}`);
      }
    }
    expect(offenders).toEqual(['tom: The watch goes on tonight. He keeps watch with you. Rest when you can.']);
  });

  it('heads carry no raw digits — spoken numbers come from the helper', () => {
    for (const id of PERSONAS) {
      const s = assembleScript(feriaFixture(id));
      expect(/\d/.test(s.headAM), id).toBe(false);
      expect(/\d/.test(s.headPM), id).toBe(false);
    }
  });
});

describe('the verbatim contract (§10.3) — Ben, Oct 30, 2026', () => {
  // The approved character-pass payloads (ben-a.txt / ben-b.txt) are reconstructed
  // inline: segment A is the head (now split off) + main-through-acclamation;
  // segment B is the reflection-through-teaser. The one deliberate deviation from
  // the sample payload is the teaser: the sample's line was written for that day
  // alone ("stays at this same table"); production speaks the slot-generalized
  // template. Everything else must match byte-for-byte.
  const sampleA = [
    'Morning, brother. Before the house wakes — the Gospel first.',
    "It's Friday of the Thirtieth Week in Ordinary Time. No feast today — an ordinary Friday.",
    `Here's the scene: ${OCT30.scene}`,
    'A reading from the holy Gospel according to Luke.',
    OCT30.gospelText,
    'The Gospel of the Lord.',
    'Praise to you, Lord Jesus Christ.',
  ].join('\n\n');

  const sampleB = [
    "Sit with that a second. Here's today's reflection.",
    OCT30.reflect,
    "And today's challenge — as a man. One thing, today:",
    OCT30.challenge,
    'Same time tomorrow, brother. Pray first. Then fight.',
    "Tomorrow's Saturday, still the Thirtieth Week — and the Gospel stays at this same table: Luke, chapter fourteen.",
  ].join('\n\n');

  const assembled = assembleScript({
    ...OCT30,
    forcePersona: 'ben',
    forceSelections: { signOnAM: 1, signOff: 1, sceneLeadIn: 0, teaser: 0 },
  });

  it('the head split reproduces segment A exactly', () => {
    const [headA, headB, ...mainParts] = sampleA.split('\n\n');
    expect(assembled.headAM).toBe(`${headA}\n\n${headB}`);
    expect(assembled.mainA).toBe(mainParts.join('\n\n'));
  });

  it('segment B matches except the generalized teaser line', () => {
    const productionTeaser =
      "Tomorrow's Saturday, still the Thirtieth Week — and the Gospel is Luke, chapter fourteen.";
    expect(assembled.mainB).toBe(sampleB.replace(sampleB.split('\n\n').pop()!, productionTeaser));
  });

  it('Zone 1 appears byte-for-byte in the assembled main', () => {
    const main = `${assembled.mainA}\n\n${assembled.mainB}`;
    expect(main).toContain(OCT30.gospelText);
    expect(main).toContain(OCT30.reflect);
    expect(main).toContain(OCT30.challenge);
    // And the audit script carries them too.
    expect(assembled.script).toContain(OCT30.gospelText);
  });

  it('a null scene omits the scene and its lead-in, and nothing else moves', () => {
    const s = assembleScript({ ...OCT30, scene: null, forceSelections: { signOnAM: 1 } });
    expect(s.sceneIncluded).toBe(false);
    expect(s.mainA.startsWith('A reading from the holy Gospel according to Luke.')).toBe(true);
    expect(s.mainA).toContain(OCT30.gospelText);
  });
});

describe('the scene lint (§10.5)', () => {
  it('accepts the samples’ scene body', () => {
    expect(validateScene(OCT30.scene)).toEqual({ ok: true });
  });

  it('rejects over-length, interpretation, and first-person shapes', () => {
    expect(validateScene('x'.repeat(281)).ok).toBe(false);
    expect(validateScene('A quiet room. This means we must listen.').ok).toBe(false);
    expect(validateScene('A table, a crowd. It teaches us patience.').ok).toBe(false);
    expect(validateScene('A table. We learn who matters here.').ok).toBe(false);
    expect(validateScene('Jesus is really saying something here, in the room.').ok).toBe(false);
    expect(validateScene('In my experience, rooms like this go quiet.').ok).toBe(false);
    expect(validateScene(null).ok).toBe(false);
    expect(validateScene('').ok).toBe(false);
  });

  it('a valid short scene of pure passage fact passes', () => {
    expect(
      validateScene('A synagogue on the Sabbath. A man with a withered hand stands where everyone can see him.'),
    ).toEqual({ ok: true });
  });
});

describe('the lexicon (§13)', () => {
  it('ships exactly one proven entry', () => {
    expect(LEXICON).toEqual([['sonor', 'son or']]);
  });

  it('transforms its fixture payload and leaves a clean payload untouched', () => {
    expect(applyLexicon('Which of you, if your sonor an ox fell into a well')).toBe(
      'Which of you, if your son or an ox fell into a well',
    );
    const clean = 'A reading from the holy Gospel according to Luke.';
    expect(applyLexicon(clean)).toBe(clean);
  });
});
