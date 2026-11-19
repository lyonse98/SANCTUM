import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONAS } from '../personas';

/**
 * Persona fidelity (Nov 19, 2026). Erik field-tested Moses and found him
 * "generic Old Testament" — quoting Scripture third-person instead of
 * speaking as himself. The briefs were rich on paper; the failure was drift:
 * grounding and retrieved corpus material pulled the model out of first-person
 * portrayal into Bible-survey narration. These pins hold the three-layer fix:
 *
 *   L1 — a shared fidelity rule rides with the persona on the CHAT path only
 *        (sources inform accuracy, never voice; Scripture enters as
 *        recollection, not citation). Letter mode's composed instruction is
 *        untouched — the letter branch never sees the rule.
 *   L2 — Moses re-anchored to his own scenes and his own words.
 *   L3 — the figures who left no first-person writings (Joseph, Mary,
 *        Magdalene, Monica, and more lightly David and Peter) anchored to
 *        their scenes and to what the Church's tradition says of them —
 *        tradition grounds WHO THEY ARE; they still speak as themselves and
 *        never lecture the reader by quoting the tradition at them.
 *
 * Citation discipline: no added text may carry a Catechism paragraph number
 * (the project's standing hard rule against fabricated CCC numbers).
 */

const ROOT = join(__dirname, '..', '..');
const chatProxy = readFileSync(join(ROOT, 'supabase/functions/chat-proxy/index.ts'), 'utf8');
const serverPersonas = readFileSync(join(ROOT, 'supabase/functions/chat-proxy/personas.ts'), 'utf8');

function grabConst(src: string, name: string): string {
  const m = src.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`const ${name} not found`);
  return m[1];
}

const letterBranch = chatProxy.slice(
  chatProxy.indexOf('// ── Letter mode request ──'),
  chatProxy.indexOf('// ── Corpus retrieval'),
);

const promptOf = (id: string): string => {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`persona ${id} not found`);
  return p.systemPrompt;
};
const anchorOf = (id: string): string => {
  const prompt = promptOf(id);
  const at = prompt.indexOf('YOUR ANCHOR:');
  if (at < 0) throw new Error(`persona ${id} has no anchor block`);
  return prompt.slice(at);
};

describe('L1 — the shared fidelity rule (chat path only)', () => {
  const rule = grabConst(chatProxy, 'COMPANION_FIDELITY_RULE');

  it('speaks in the first person, from inside the life — never third-person self-narration', () => {
    expect(rule).toContain('FIDELITY OF VOICE');
    expect(rule).toContain('You speak in the first person, from inside your own life');
    expect(rule).toContain('never narrate yourself in the third person');
  });

  it('accuracy material informs what is true and never sets the voice', () => {
    expect(rule).toContain('tells you what is true. It never sets your voice');
    expect(rule).toContain('never turns you into a survey of the Bible or of the tradition');
    expect(rule).toContain("Do not quote other figures' speeches");
    expect(rule).toContain('as exhibits');
  });

  it('Scripture enters as recollection, not citation', () => {
    expect(rule).toContain('what God said to you, what you said back to him');
    expect(rule).toContain('Recollection, not citation');
    expect(rule).toContain('Chapter-and-verse references are not your speech');
  });

  it('Aquinas gets the teacher’s lighter form', () => {
    const aquinasRule = grabConst(chatProxy, 'AQUINAS_FIDELITY_RULE');
    expect(aquinasRule).toContain('govern the accuracy of your teaching; they do not supply its voice');
    expect(aquinasRule).toContain('Do not paste retrieved text at the reader');
    expect(aquinasRule).toContain('in your own ordered reasoning');
  });

  it('the rule is appended to the persona instruction on the chat path, before buildBody composes', () => {
    const append = 'personaPrompt += `\\n\\n${isAquinas ? AQUINAS_FIDELITY_RULE : COMPANION_FIDELITY_RULE}`;';
    expect(chatProxy).toContain(append);
    const appendAt = chatProxy.indexOf(append);
    // Chat path only: after the corpus-retrieval section opens, before the body is built.
    expect(appendAt).toBeGreaterThan(chatProxy.indexOf('// ── Corpus retrieval'));
    expect(appendAt).toBeLessThan(chatProxy.indexOf('const body = buildBody(messages, personaPrompt'));
  });

  it('buildBody itself is unchanged — the rule rides in the persona slot, not the shared composer', () => {
    const bodyFn = chatProxy.slice(
      chatProxy.indexOf('function buildBody('),
      chatProxy.indexOf('async function hashClientKey'),
    );
    expect(bodyFn.length).toBeGreaterThan(0);
    expect(bodyFn).not.toContain('FIDELITY');
  });

  it('letter mode never sees the rule — the letter instruction stays as it was', () => {
    expect(letterBranch.length).toBeGreaterThan(0);
    expect(letterBranch).not.toContain('FIDELITY');
    expect(letterBranch).not.toContain('COMPANION_FIDELITY_RULE');
    expect(letterBranch).not.toContain('AQUINAS_FIDELITY_RULE');
  });
});

describe('L2 — Moses re-anchored', () => {
  const anchor = anchorOf('moses');

  it('speaks from his scenes as the one who lived them', () => {
    expect(anchor).toContain('the bush, and the long argument you made there');
    expect(anchor).toContain('standing between God and the people');
    expect(anchor).toContain('the rock at Meribah');
    expect(anchor).toContain('Nebo, where you saw the land');
  });

  it('his Scripture is his memory — his own words, carried, not exhibited', () => {
    expect(anchor).toContain('Your Scripture is your memory');
    expect(anchor).toContain("blotted out of God's book");
    expect(anchor).toContain('These are not exhibits to hold up');
  });

  it('tradition’s witness grounds his humility and his intercessor’s heart', () => {
    expect(anchor).toContain('the letter to the Hebrews remembers');
    expect(anchor).toContain('the meekest man on the face of the earth');
    expect(anchor).toContain('a figure of the Mediator who was to come');
  });

  it('the survey mode is banned outright, and HOW YOU TALK carries it too', () => {
    expect(anchor).toContain('Never tour the Old Testament for him');
    expect(anchor).toContain('never narrate Exodus at him in the third person');
    expect(promptOf('moses')).toContain("Other men's words, however holy, are not your speech");
  });
});

describe('L3 — the exposed figures, scene + tradition anchored', () => {
  it('Joseph: the silence IS the portrayal — few, short words, never filled with narration', () => {
    const anchor = anchorOf('joseph');
    expect(anchor).toContain('few words, short sentences, plainly said');
    expect(anchor).toContain('Scripture does not record one word you spoke');
    expect(anchor).toContain('Never fill the quiet with narration');
    expect(anchor).toContain('rising in the night to take the child and his mother into Egypt');
    expect(anchor).toContain('the long hidden years of the bench and the shavings at Nazareth');
  });

  it('Joseph: tradition is his biography — Patris Corde, Redemptoris Custos, patron of the Church', () => {
    const anchor = anchorOf('joseph');
    expect(anchor).toContain('guardian of the Redeemer');
    expect(anchor).toContain('Pope Francis, in Patris Corde');
    expect(anchor).toContain('a beloved father, tender and obedient, creatively courageous');
    expect(anchor).toContain('patron of the universal Church');
    expect(anchor).toContain('You do not quote any of this at the man across from you');
  });

  it('Mary: her scenes, and the tradition that names them — Lumen Gentium, the new Eve', () => {
    const anchor = anchorOf('mary');
    expect(anchor).toContain('the angel standing in your house at Nazareth');
    expect(anchor).toContain('standing at the cross, not looking away');
    expect(anchor).toContain('the upper room, praying with the apostles');
    expect(anchor).toContain('in Lumen Gentium, calls you Mother of God and the type of the Church');
    expect(anchor).toContain('St. Irenaeus taught that your obedience loosed the knot');
    expect(anchor).toContain('The Magnificat is your own song');
    expect(anchor).toContain('You do not lecture her with any of this');
  });

  it('Magdalene: the garden and the sending, Apostle to the Apostles', () => {
    const anchor = anchorOf('magdalene');
    expect(anchor).toContain('coming to the tomb while it was still dark');
    expect(anchor).toContain('"Rabbouni"');
    expect(anchor).toContain('from Hippolytus onward she has called you Apostle to the Apostles');
    expect(anchor).toContain('raised your memorial to a Feast');
  });

  it('Monica: her son’s testimony is her source, and she speaks it as her own life', () => {
    const anchor = anchorOf('monica');
    expect(anchor).toContain('wrote you into his Confessions');
    expect(anchor).toContain('the dream of the wooden rule');
    expect(anchor).toContain('the son of those tears would not perish');
    expect(anchor).toContain('the window at Ostia');
    expect(anchor).toContain('intercession measured in decades is not intercession wasted');
  });

  it('David: the psalms are his prayers, not his exhibits', () => {
    const anchor = anchorOf('david');
    expect(anchor).toContain('Your psalms are your prayers, not your exhibits');
    expect(anchor).toContain('Pray them with the man');
    expect(anchor).toContain('Never hold them up at him as quotations');
    expect(anchor).toContain('the chamber over the gate');
  });

  it('Peter: the two charcoal fires, recollection not quotation', () => {
    const anchor = anchorOf('peter');
    expect(anchor).toContain('"depart from me, for I am a sinful man"');
    expect(anchor).toContain('Caesarea Philippi');
    expect(anchor).toContain('the other charcoal fire');
    expect(anchor).toContain('recollection, not quotation');
  });

  it('only the seven re-anchored briefs carry an anchor block — the writers are untouched', () => {
    const anchored = ['joseph', 'david', 'peter', 'moses', 'mary', 'magdalene', 'monica'];
    for (const p of PERSONAS) {
      if (anchored.includes(p.id)) {
        expect(p.systemPrompt, p.id).toContain('YOUR ANCHOR:');
      } else {
        expect(p.systemPrompt, p.id).not.toContain('YOUR ANCHOR:');
      }
    }
  });

  it('the generated server copy carries the anchors (sync:prompts was run)', () => {
    expect(serverPersonas.split('YOUR ANCHOR:').length - 1).toBe(7);
    expect(serverPersonas).toContain('the rock at Meribah');
    expect(serverPersonas).toContain('Patris Corde');
  });
});

describe('citation discipline — no fabricated Catechism numbers in any added text', () => {
  it('no anchor block carries a CCC paragraph number or a numbered paragraph reference', () => {
    for (const id of ['joseph', 'david', 'peter', 'moses', 'mary', 'magdalene', 'monica']) {
      const anchor = anchorOf(id);
      expect(anchor, id).not.toMatch(/CCC\s*\d/);
      expect(anchor, id).not.toMatch(/paragraph\s+\d/i);
    }
  });

  it('neither fidelity rule carries one either', () => {
    expect(grabConst(chatProxy, 'COMPANION_FIDELITY_RULE')).not.toMatch(/CCC\s*\d/);
    expect(grabConst(chatProxy, 'AQUINAS_FIDELITY_RULE')).not.toMatch(/CCC\s*\d/);
  });
});
