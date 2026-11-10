import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { audienceNoun } from './audience';

/**
 * Gender-address contract (Erik, Nov 10, 2026). Everything reachable BEFORE a
 * track is chosen — the welcome gate, the page title/meta, the PWA manifest —
 * is gender-neutral: no Brother, no Sister, no "As a man", no "As a woman"
 * until the user has picked. Once a track IS picked, shared surfaces address
 * the user by that track's word and no other: a woman in Women's Mode never
 * meets a "brother", a "him", or a "wife" the copy assumed for a man. Men's
 * Mode copy is unchanged — these guards pin BOTH sides so a fix for one track
 * can never quietly rewrite the other.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const indexHtml = read('../../index.html');
const manifest = JSON.parse(read('../../public/manifest.json')) as {
  name: string;
  short_name: string;
  description: string;
};
const termsModal = read('../components/TermsModal.tsx');
const chatInput = read('../components/ChatInput.tsx');
const chatFeed = read('../components/ChatFeed.tsx');
const shareInvite = read('../components/ShareInviteModal.tsx');
const catechismQA = read('../components/CatechismQA.tsx');
const pocketCatechism = read('../components/PocketCatechism.tsx');
const pocketChurchPage = read('../components/PocketChurchPage.tsx');
const chatProxy = read('../../supabase/functions/chat-proxy/index.ts');

// The two server constants addressed to women, and everything before them
// (the men's constants) for the byte-preservation checks.
const womenServerCopy = chatProxy.slice(chatProxy.indexOf('SCRIPTURE_GROUNDING_WOMEN'));
const menServerCopy = chatProxy.slice(0, chatProxy.indexOf('SCRIPTURE_GROUNDING_WOMEN'));

describe('pre-selection surfaces are gender-neutral', () => {
  it('the page title names no track', () => {
    expect(indexHtml).not.toContain('Companion for Men');
    expect(indexHtml).toContain('<title>Sanctum — A Private Catholic Spiritual Companion</title>');
  });

  it('the meta description speaks of men and women, or neither', () => {
    expect(indexHtml).not.toContain('companion for men.');
    expect(indexHtml).toContain('companion for men and women.');
  });

  it('the PWA manifest description is neutral the same way', () => {
    expect(manifest.name).toBe('Sanctum');
    expect(manifest.short_name).toBe('Sanctum');
    expect(manifest.description).toContain('for men and women');
    expect(manifest.description).not.toMatch(/for men(?! and women)/);
  });

  it('the welcome gate greets no one as Brother or Sister before a track is chosen', () => {
    // The heading suffix exists only once a choice exists: null choice → plain "Welcome".
    expect(termsModal).toContain("choice === 'men' ? ', Brother' : ''");
    expect(termsModal).not.toContain("choice === 'women' ? 'Sister' : 'Brother'");
    expect(termsModal).not.toContain('As a man');
    expect(termsModal).not.toContain('As a woman');
  });
});

describe('the address word follows the track', () => {
  it('audienceNoun gives each track its own word', () => {
    expect(audienceNoun('men')).toBe('Brother');
    expect(audienceNoun('women')).toBe('Sister');
  });

  it('the chat input takes its brother/sister from the persona’s audience', () => {
    expect(chatInput).toContain('audienceNoun(persona.audience)');
    expect(chatInput).toContain('Take a breath {kin}');
    expect(chatInput).not.toContain('Take a breath brother');
    expect(chatInput).not.toContain('Speak plainly, brother');
  });

  it('the empty-chat greeting does the same', () => {
    expect(chatFeed).toContain('audienceNoun(persona.audience)');
    expect(chatFeed).not.toContain("I'm here, brother");
  });
});

describe('women’s-path copy is written for a woman', () => {
  it('the share sheet’s phone instructions switch him/his to her/her — and men’s stay', () => {
    expect(shareInvite).toContain('Tell her: open the link');
    expect(shareInvite).toContain('lives on her home screen like an app');
    expect(shareInvite).toContain('Tell him: open the link');
    expect(shareInvite).toContain('lives on his home screen like an app');
  });

  it('Ask Aquinas does not presume a wife in Women’s Mode — and still names her in Men’s', () => {
    expect(catechismQA).toContain("audience === 'women'");
    expect(catechismQA).toContain("a loved one's conversion journey.");
    expect(catechismQA).toContain("your wife's conversion journey.");
    // The audience actually reaches the component from the page that holds it.
    expect(pocketCatechism).toContain('audience={audience}');
    expect(pocketChurchPage).toContain('<PocketCatechism t={t} audience={audience} />');
  });

  it('the women’s server grounding speaks of a woman who knows the text', () => {
    expect(womenServerCopy).toContain('The first is a woman who knows the text');
    expect(womenServerCopy).toContain('she knows the teaching, she does not look up the number');
    expect(womenServerCopy).not.toContain('The first is a man who knows the text');
  });

  it('the women’s server copy points her, never him', () => {
    expect(womenServerCopy).toContain('point her somewhere only when it genuinely helps');
    expect(womenServerCopy).toContain('point her to Find Real Help');
    expect(womenServerCopy).toContain('POINTING HER SOMEWHERE');
    expect(womenServerCopy).toContain('no restating her situation back to her');
    expect(womenServerCopy).not.toContain('point him');
    expect(womenServerCopy).not.toContain('POINTING HIM');
    expect(womenServerCopy).not.toContain('restating his situation');
  });

  it('the men’s server copy is untouched by the women’s fixes', () => {
    expect(menServerCopy).toContain('The first is a man who knows the text');
    expect(menServerCopy).toContain('he knows the teaching, he does not look up the number');
    expect(menServerCopy).toContain('POINTING HIM SOMEWHERE');
    expect(menServerCopy).toContain('no restating his situation back to him');
  });
});
