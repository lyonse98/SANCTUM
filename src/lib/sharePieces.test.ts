import { describe, it, expect } from 'vitest';
import {
  buildSharePieces,
  cardTextPlan,
  pickShareLine,
  splitSentences,
} from './sharePieces';
import type { KeyVerse } from './keyVerse';
import type { Reflection } from './reflection';
import type { TailorShareEntry } from './tailorShare';

const KEY_VERSE: KeyVerse = {
  text: 'Your faith has saved you; go in peace.',
  citation: 'Luke 7:50',
};

const REFLECT_TEXT =
  "In today's Gospel, Jesus heals ten lepers on the road to Jerusalem, and only the Samaritan returns. " +
  'Ten are healed, and nine simply keep walking, as if mercy were weather. ' +
  'Gratitude is not the epilogue to the miracle; it is the miracle, finished. ' +
  'And most days, our prayer asks for more and forgets to go back and say thanks.';

const REFLECTION: Reflection = {
  reflect: REFLECT_TEXT,
  challenge: 'Thank one person today, out loud, by name.',
  facet: 'As a man',
};

const TAILOR_SHARE: TailorShareEntry = {
  passageCitation: 'Psalm 42:2',
  passageExcerpt: 'As the deer longs for streams of water, so my soul longs for you, O God.',
  traditionQuote: { text: 'Late have I loved you, O Beauty ever ancient, ever new.', author: 'St. Augustine' },
};

describe('splitSentences', () => {
  it('keeps punctuation and closing quotes attached to their sentence', () => {
    expect(splitSentences('He said, "Go in peace." Then he left.')).toEqual([
      'He said, "Go in peace."',
      'Then he left.',
    ]);
  });

  it('returns a lone fragment whole', () => {
    expect(splitSentences('Be still')).toEqual(['Be still']);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('pickShareLine', () => {
  it('skips the meta scene-setter and picks the quotable aphorism', () => {
    // Sentence 1 talks ABOUT today's Gospel (meta) and sets the scene;
    // sentence 3 is the balanced, self-contained line.
    expect(pickShareLine(REFLECT_TEXT)).toBe(
      'Gratitude is not the epilogue to the miracle; it is the miracle, finished.',
    );
  });

  it('favours a second-person imperative over narration', () => {
    const text =
      'The scene opens in a vineyard at dawn, with workers already arguing over wages. ' +
      'The landowner pays the last men first, and the grumbling begins at once. ' +
      "Do not measure God's generosity against your brother's portion; it was never a wage, always a gift.";
    expect(pickShareLine(text)).toBe(
      "Do not measure God's generosity against your brother's portion; it was never a wage, always a gift.",
    );
  });

  it('returns a single sentence whole', () => {
    expect(pickShareLine('Be still, and know that I am God.')).toBe('Be still, and know that I am God.');
  });

  it('returns empty for empty text', () => {
    expect(pickShareLine('')).toBe('');
  });

  it('when every sentence is meta, still returns the least-bad one — deterministically', () => {
    const text =
      "Today's Gospel is about gratitude. " +
      "This morning's reading shows a Samaritan. " +
      'In the Gospel we see ten lepers healed and one who returns to give thanks.';
    const line = pickShareLine(text);
    expect(line).toBe('In the Gospel we see ten lepers healed and one who returns to give thanks.');
    expect(pickShareLine(text)).toBe(line);
  });

  it('a short quotable line beats a long rambling opener', () => {
    const rambling =
      'The road from Galilee down through Samaria toward Jerusalem was long and dusty and ' +
      'the villages along the way were small and poor and the people in them had heard of the ' +
      'teacher from Nazareth and wondered whether he would pass near them and what he might ' +
      'say or do if he did and whether the sick would be brought out to him at the gates.';
    const text = `${rambling} You are loved before you are useful.`;
    expect(pickShareLine(text)).toBe('You are loved before you are useful.');
  });
});

describe('buildSharePieces — the shelf', () => {
  it('offers all five pieces, in order, on a tailored day', () => {
    const pieces = buildSharePieces({ keyVerse: KEY_VERSE, reflection: REFLECTION, tailorShare: TAILOR_SHARE });
    expect(pieces.map((p) => p.id)).toEqual(['verse', 'reflection', 'challenge', 'passage', 'tradition']);
  });

  it('the reflection piece carries ONE line, never the whole paragraph', () => {
    const pieces = buildSharePieces({ keyVerse: KEY_VERSE, reflection: REFLECTION, tailorShare: null });
    const piece = pieces.find((p) => p.id === 'reflection');
    expect(piece?.text).toBe(pickShareLine(REFLECT_TEXT));
    expect(piece?.text).not.toBe(REFLECT_TEXT);
    expect(piece?.pickerLabel).toBe('The Reflection');
  });

  it('the challenge stands alone with its own label', () => {
    const pieces = buildSharePieces({ keyVerse: null, reflection: REFLECTION, tailorShare: null });
    const piece = pieces.find((p) => p.id === 'challenge');
    expect(piece?.text).toBe('Thank one person today, out loud, by name.');
    expect(piece?.cardLabel).toBe("TODAY'S CHALLENGE");
  });

  it('without a tailored morning the shelf is the three base pieces', () => {
    const pieces = buildSharePieces({ keyVerse: KEY_VERSE, reflection: REFLECTION, tailorShare: null });
    expect(pieces.map((p) => p.id)).toEqual(['verse', 'reflection', 'challenge']);
  });

  it('missing sources remove their pieces — no verse, no Verse', () => {
    expect(buildSharePieces({ keyVerse: null, reflection: REFLECTION, tailorShare: null }).map((p) => p.id)).toEqual([
      'reflection',
      'challenge',
    ]);
    expect(buildSharePieces({ keyVerse: KEY_VERSE, reflection: null, tailorShare: null }).map((p) => p.id)).toEqual([
      'verse',
    ]);
    expect(
      buildSharePieces({
        keyVerse: null,
        reflection: { reflect: '', challenge: 'Do one kind thing.', facet: 'As a man' },
        tailorShare: null,
      }).map((p) => p.id),
    ).toEqual(['challenge']);
    expect(buildSharePieces({ keyVerse: null, reflection: null, tailorShare: null })).toEqual([]);
  });

  it('a tailored morning without a tradition quote offers the passage only', () => {
    const share: TailorShareEntry = { ...TAILOR_SHARE, traditionQuote: null };
    const pieces = buildSharePieces({ keyVerse: null, reflection: null, tailorShare: share });
    expect(pieces.map((p) => p.id)).toEqual(['passage']);
    expect(pieces[0].attribution).toBe('Psalm 42:2');
  });
});

describe('cardTextPlan — a card carries only its own piece', () => {
  const pieces = buildSharePieces({ keyVerse: KEY_VERSE, reflection: REFLECTION, tailorShare: TAILOR_SHARE });

  it('the challenge plan contains the challenge and nothing else', () => {
    const piece = pieces.find((p) => p.id === 'challenge')!;
    const plan = cardTextPlan(piece, { season: 'Ordinary Time', celebration: 'St. Cabrini', facet: 'As a man' });
    expect(plan.header).toBe('DAILY GOSPEL');
    expect(plan.subtitle).toBe('Ordinary Time · St. Cabrini');
    expect(plan.label).toBe("TODAY'S CHALLENGE");
    expect(plan.text).toBe(REFLECTION.challenge);
    const all = JSON.stringify(plan);
    expect(all).not.toContain(KEY_VERSE.text);
    expect(all).not.toContain('Gratitude is not the epilogue');
    expect(all).not.toContain(TAILOR_SHARE.passageExcerpt);
    expect(all).not.toContain(TAILOR_SHARE.traditionQuote!.text);
  });

  it('the verse plan carries its citation as the attribution', () => {
    const piece = pieces.find((p) => p.id === 'verse')!;
    const plan = cardTextPlan(piece, { season: null, celebration: null, facet: null });
    expect(plan.text).toBe(KEY_VERSE.text);
    expect(plan.attribution).toBe('— Luke 7:50');
    expect(plan.subtitle).toBe('The Word for today');
    expect(plan.footer).toBe('A word for the road');
  });

  it('the reflection plan carries the picked line, not the paragraph', () => {
    const piece = pieces.find((p) => p.id === 'reflection')!;
    const plan = cardTextPlan(piece, { season: 'Ordinary Time', celebration: null, facet: 'As a woman' });
    expect(plan.text).toBe(pickShareLine(REFLECT_TEXT));
    expect(plan.attribution).toBeNull();
    expect(plan.footer).toBe('As a woman');
  });

  it('the tradition plan attributes the author', () => {
    const piece = pieces.find((p) => p.id === 'tradition')!;
    const plan = cardTextPlan(piece, {});
    expect(plan.text).toBe(TAILOR_SHARE.traditionQuote!.text);
    expect(plan.attribution).toBe('— St. Augustine');
  });
});
