/**
 * The proofread pins (Nov 13, 2026). A full pass over every spoken bank line —
 * all fourteen weekday personas, both Lectors, both tracks, plus the shared
 * ritual formulas — and a mechanical sweep of ~1,000 assembled scripts found
 * the banks grammatically clean: no doubled words, no agreement or article
 * slips, no digits, slashes, or ampersands in any template, no punctuation a
 * TTS engine would stumble on. These tests pin the classes that can recur
 * mechanically, so a future bank edit that reintroduces one fails here rather
 * than reaching a listener's ear.
 *
 * Scope note: the pins cover the BANK (Zone 3 framing text). Zone 1 (Gospel,
 * reflection, challenge) is verbatim by contract and never linted; the saint
 * lines and celebration names are drift-pinned ports of the app's data tables
 * and are likewise outside these rules.
 */
import { describe, it, expect } from 'vitest';
import {
  ACCLAMATION,
  BANK,
  BANK_WOMEN,
  COMMEMORATION_FRAME,
  GOSPEL_CLOSE,
  GOSPEL_INTRO,
  LECTOR_BANK,
  LECTOR_BANK_WOMEN,
  addDaysISO,
  assembleScript,
  resolveFeastDay,
  type AssembleInputs,
  type NarratorId,
  type PersonaBank,
} from './narratorCore';

// ── Every spoken string the bank can utter ────────────────────────────────────

interface BankLine {
  where: string;
  slot: string;
  text: string;
}

function collectBankLines(): BankLine[] {
  const out: BankLine[] = [];
  const grab = (id: string, bank: PersonaBank) => {
    const arrays: [string, string[]][] = [
      ['signOnsAM', bank.signOnsAM],
      ['signOnsPM', bank.signOnsPM],
      ['signOffs', bank.signOffs],
      ['sceneLeadIns', bank.sceneLeadIns],
      ['teaserTemplates', bank.teaserTemplates],
      ['soberSignOnsAM', bank.soberSignOnsAM],
      ['soberSignOnsPM', bank.soberSignOnsPM],
    ];
    for (const [slot, lines] of arrays) {
      lines.forEach((text, i) => out.push({ where: `${id}.${slot}[${i}]`, slot, text }));
    }
    const singles: [string, string][] = [
      ['frameFeriaAM', bank.frameFeriaAM],
      ['frameFeriaPM', bank.frameFeriaPM],
      ['frameMemorialAM', bank.frameMemorialAM],
      ['frameMemorialPM', bank.frameMemorialPM],
      ['reflectionHandoff', bank.reflectionHandoff],
      ['challengeHandoff', bank.challengeHandoff],
      ['soberFrame', bank.soberFrame],
    ];
    for (const [slot, text] of singles) out.push({ where: `${id}.${slot}`, slot, text });
  };
  for (const [id, bank] of Object.entries(BANK)) grab(id, bank);
  for (const [id, bank] of Object.entries(BANK_WOMEN)) grab(id, bank);
  for (const [name, bank] of [
    ['LECTOR', LECTOR_BANK],
    ['LECTOR_WOMEN', LECTOR_BANK_WOMEN],
  ] as const) {
    out.push({ where: `${name}.frameSolemnity`, slot: 'frameSolemnity', text: bank.frameSolemnity });
    out.push({ where: `${name}.reflectionHandoff`, slot: 'reflectionHandoff', text: bank.reflectionHandoff });
    out.push({ where: `${name}.challengeHandoff`, slot: 'challengeHandoff', text: bank.challengeHandoff });
  }
  out.push({ where: 'COMMEMORATION_FRAME', slot: 'frame', text: COMMEMORATION_FRAME });
  out.push({ where: 'GOSPEL_INTRO', slot: 'ritual', text: GOSPEL_INTRO });
  out.push({ where: 'GOSPEL_CLOSE', slot: 'ritual', text: GOSPEL_CLOSE });
  out.push({ where: 'ACCLAMATION', slot: 'ritual', text: ACCLAMATION });
  return out;
}

const LINES = collectBankLines();

describe('proofread pins — every bank line, both companies', () => {
  it('no doubled words anywhere in the bank', () => {
    const offenders = LINES.filter((l) => /\b([A-Za-z']+)\s+\1\b/i.test(l.text)).map((l) => l.where);
    expect(offenders).toEqual([]);
  });

  it('no stray whitespace: no double spaces, no space before punctuation, trimmed edges', () => {
    const offenders = LINES.filter(
      (l) => / {2,}/.test(l.text) || /\s[,.;:!?]/.test(l.text) || l.text !== l.text.trim(),
    ).map((l) => l.where);
    expect(offenders).toEqual([]);
  });

  it('no raw digits, slashes, or ampersands — spoken numbers come from the helpers', () => {
    const offenders = LINES.filter((l) => /\d/.test(l.text) || /\//.test(l.text) || /&/.test(l.text)).map(
      (l) => l.where,
    );
    expect(offenders).toEqual([]);
  });

  it('double quotes, where a line carries them, are balanced', () => {
    const offenders = LINES.filter((l) => ((l.text.match(/"/g) ?? []).length % 2) === 1).map((l) => l.where);
    expect(offenders).toEqual([]);
  });

  it('sentence slots end with terminal punctuation; lead-ins and hand-offs with a colon or period', () => {
    const offenders: string[] = [];
    for (const l of LINES) {
      if (l.slot === 'frameMemorialAM' || l.slot === 'frameMemorialPM') continue; // join contract, pinned below
      if (l.slot === 'sceneLeadIns') {
        if (!/[:.]$/.test(l.text)) offenders.push(l.where);
      } else if (l.slot === 'reflectionHandoff' || l.slot === 'challengeHandoff') {
        if (!/[.:]$/.test(l.text)) offenders.push(l.where);
      } else if (!/[.!?]$/.test(l.text)) {
        offenders.push(l.where);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the memorial-frame join contract: every memorial frame ends in ".{saintLine}"', () => {
    // The terminal period of a memorial frame lives in the template, before the
    // saintLine slot; the slot itself is either empty or " " + a saint line that
    // ends with its own period. This shape is what guarantees a spoken memorial
    // head never trails off unpunctuated.
    const offenders = LINES.filter(
      (l) =>
        (l.slot === 'frameMemorialAM' || l.slot === 'frameMemorialPM') && !l.text.endsWith('.{saintLine}'),
    ).map((l) => l.where);
    expect(offenders).toEqual([]);
  });
});

// ── Assembled scripts: the joins cannot manufacture an error ─────────────────

const GOSPEL =
  'Jesus said to the crowd, "All things have been handed over to me by my Father. No one knows the Son except the Father, and no one knows the Father except the Son and anyone to whom the Son wishes to reveal him."';
const REFLECT =
  'The passage invites a quiet look at what has been handed to you, and at the weight you keep trying to carry alone. Set one of those weights down in prayer today, and notice what remains steady underneath it. Peace is not the absence of work; it is the presence of trust.';
const CHALLENGE =
  'Before the day ends, thank God out loud for one specific gift you did nothing to earn.';
const SCENE =
  'A hillside above the sea of Galilee, late in the day. The crowd sits in the long grass, tired and hungry, watching Jesus. His disciples stand close, uneasy, counting what little food they have.';

function inputsFor(
  dateISO: string,
  audience: 'men' | 'women',
  overrides: Partial<AssembleInputs> = {},
): AssembleInputs {
  const feast = resolveFeastDay(dateISO);
  const tomorrowFeast = resolveFeastDay(addDaysISO(dateISO, 1));
  return {
    dateISO,
    audience,
    celebration: feast?.name ?? null,
    gospelCitation: 'Matthew 11:25-27',
    gospelText: GOSPEL,
    reflect: REFLECT,
    challenge: CHALLENGE,
    facet: audience === 'women' ? 'As a woman' : 'As a man',
    scene: SCENE,
    tomorrowCelebration: tomorrowFeast?.name ?? null,
    tomorrowGospelCitation: 'Luke 10:21-24',
    ...overrides,
  };
}

const ASSEMBLY_RULES: { name: string; fails: (s: string) => boolean }[] = [
  { name: 'unfilled slot', fails: (s) => /\{\w+\}/.test(s) },
  { name: 'doubled word', fails: (s) => /\b([A-Za-z']+)\s+\1\b/i.test(s) },
  { name: 'space before punctuation', fails: (s) => /\s[,.;:!?]/.test(s) },
  { name: 'doubled period', fails: (s) => /(?<!\.)\.\.(?!\.)/.test(s) },
  { name: 'doubled comma', fails: (s) => /,,/.test(s) },
  { name: '"a" before a vowel', fails: (s) => /\ba\s+[aeiouAEIOU]/.test(s) },
  { name: '"an" before a consonant', fails: (s) => /\ban\s+[^aeiouAEIOU\W\d]/.test(s) },
];

function proofAssembly(dateISO: string, audience: 'men' | 'women', overrides: Partial<AssembleInputs> = {}) {
  const a = assembleScript(inputsFor(dateISO, audience, overrides));
  const parts: [string, string][] = [
    ['headAM', a.headAM],
    ['headPM', a.headPM],
    ['mainA', a.mainA],
    ['mainB', a.mainB],
  ];
  for (const [part, text] of parts) {
    for (const rule of ASSEMBLY_RULES) {
      expect(rule.fails(text), `${dateISO}/${audience} ${part}: ${rule.name} in ${JSON.stringify(text.slice(0, 160))}`).toBe(false);
    }
    if (part.startsWith('head')) {
      expect(/[.!?]$/.test(text.trim()), `${dateISO}/${audience} ${part} ends unpunctuated`).toBe(true);
    }
  }
}

describe('proofread pins — assembled scripts over a wide calendar net', () => {
  it('every day of November and December 2026, both tracks', () => {
    let d = '2026-11-01';
    while (d <= '2026-12-31') {
      proofAssembly(d, 'men');
      proofAssembly(d, 'women');
      d = addDaysISO(d, 1);
    }
  });

  it('sober days: the Triduum with a Passion citation, both tracks', () => {
    for (const date of ['2026-03-29', '2026-04-03', '2026-04-04', '2027-04-16', '2027-04-17']) {
      for (const aud of ['men', 'women'] as const) {
        proofAssembly(date, aud, { gospelCitation: 'John 18:1-19:42' });
      }
    }
  });

  it('every narrator forced across the day shapes his or her bank can meet', () => {
    const weekdayIds: NarratorId[] = [
      'henry', 'coach', 'frank', 'ben', 'martin', 'tom', 'ed',
      'ruth', 'dana', 'grace', 'claire', 'marta', 'june', 'rose',
    ];
    const shapes: [string, Partial<AssembleInputs>][] = [
      ['2026-11-10', {}], // plain feria
      ['2026-11-13', {}], // memorial with a saint line
      ['2026-04-03', { gospelCitation: 'John 18:1-19:42' }], // Good Friday — sober gear
      ['2026-11-02', {}], // All Souls — the commemoration frame
      ['2026-11-10', { scene: null }], // no scene
      ['2026-11-10', { tomorrowCelebration: null }], // no named tomorrow
    ];
    for (const id of weekdayIds) {
      const aud = (['ruth', 'dana', 'grace', 'claire', 'marta', 'june', 'rose'] as string[]).includes(id)
        ? 'women'
        : 'men';
      for (const [date, over] of shapes) {
        proofAssembly(date, aud as 'men' | 'women', { ...over, forcePersona: id });
      }
    }
    // The Lectors, on days that are theirs: solemnities.
    proofAssembly('2026-12-25', 'men', { forcePersona: 'lector' });
    proofAssembly('2026-12-25', 'women', { forcePersona: 'lector' });
    proofAssembly('2026-08-15', 'men', { forcePersona: 'lector' });
    proofAssembly('2026-08-15', 'women', { forcePersona: 'lector' });
  });
});
