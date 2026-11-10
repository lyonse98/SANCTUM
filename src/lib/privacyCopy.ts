/**
 * The ONE canonical privacy statement for Sanctum. Every surface that describes privacy —
 * the welcome gate, About, Settings, the home footer, the share sheet, the Terms & Privacy
 * page — renders from these strings so the wording can never drift apart again.
 *
 * Rules for editing this file: every sentence must be literally true of the code.
 * If a change to the app makes a sentence here false, the sentence and the change ship
 * together or neither ships.
 */

/** One-paragraph version for the welcome gate and Settings. */
export const PRIVACY_PARAGRAPH =
  'We do not store your conversations on a server. To generate a companion\u2019s reply, your message is sent through Sanctum\u2019s relay to our AI provider and then discarded \u2014 it is not kept. Your chat history lives only in this browser, and you can wipe it at any time.';

/** The complete list of what can be held server-side. Used by the Terms & Privacy page. */
export const PRIVACY_SERVER_LIST: string[] = [
  'A scrambled (hashed) network identifier with message counters, kept only to limit abuse. It cannot be turned back into your address.',
  'Anonymous usage events \u2014 which screen, which tool, which companion \u2014 only if you turn analytics on in Settings. They never include message text, an email, or an identity, and analytics is off by default.',
  'A notification subscription, only if you turn on the daily reminder: an anonymous address for this device\u2019s notifications, the part of Sanctum you chose to be reminded about, and a time of day. It carries no name and no identity, and it is used for that reminder and nothing else.',
  'A feedback note, only if you choose to send one, along with the name of the screen you sent it from.',
];

export const PRIVACY_SERVER_INTRO =
  'Four things can be held on a server, and nothing else:';

export const PRIVACY_THIRD_PARTY =
  'The daily readings and Scripture text are fetched from outside Catholic and Bible data services. Those services see the request the way any website visit is seen.';

/** Short line for footers. */
export const PRIVACY_SHORT =
  'We do not store your conversations \u2014 your message is sent to our AI provider for the reply and then discarded.';

/** Share-sheet line. */
export const PRIVACY_SHARE =
  'No account. Conversations are never stored on a server, and chat history lives only on his own device.';

/** Privacy Fact 2 in Women's Mode — same promise, addressed to a sister. */
export const PRIVACY_SHARE_WOMEN =
  'No account. Conversations are never stored on a server, and chat history lives only on her own device.';

export function privacyShare(audience: 'men' | 'women'): string {
  return audience === 'women' ? PRIVACY_SHARE_WOMEN : PRIVACY_SHARE;
}

/** Analytics section copy for Settings. */
export const ANALYTICS_COPY =
  'Off by default. If you turn this on, Sanctum sends anonymous usage events \u2014 which screen, which tool, which companion \u2014 so we can see which parts men actually use. No message text, no email, no identity, ever.';

/** Portrayal framing — shown where a man meets the companions, not buried in Terms. */
export const COMPANION_PORTRAYAL_LINE =
  'AI voices written from their lives and writings \u2014 portrayals to pray with, not the saints themselves.';

/** Short form for the chat header. */
export const COMPANION_PORTRAYAL_SHORT = 'AI portrayal';

/**
 * The narrator disclosure (Narrator Charter §2) — shown on the first-listen card in
 * the Gospel card, in About, and as the credits line in Terms & Privacy. The audio
 * player collects nothing, so every sentence above remains literally true unchanged.
 */
export const NARRATOR_DISCLOSURE_LINE =
  'Sanctum\u2019s narrators are created personas \u2014 AI-voiced characters, written to be the brothers reading next to you. They aren\u2019t real men, and they never pretend to be \u2014 least of all priests.';

/** The analytics disclosure addressed to a woman. */
export const ANALYTICS_COPY_WOMEN =
  'Off by default. If you turn this on, Sanctum sends anonymous usage events — which screen, which tool, which companion — so we can see which parts women actually use. No message text, no email, no identity, ever.';

export function analyticsCopy(audience: 'men' | 'women'): string {
  return audience === 'women' ? ANALYTICS_COPY_WOMEN : ANALYTICS_COPY;
}

/**
 * The one line shown where Men's Mode offers the day's spoken audio. Women's Mode
 * has no narrator voices yet — a deliberate hold rather than a thinner substitute —
 * so the Gospel card says so plainly and keeps everything else.
 */
export const WOMENS_AUDIO_NOTE =
  'Spoken audio is not yet available in Women’s Mode — the Gospel and reflection are here in writing.';
