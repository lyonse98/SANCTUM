import { Church, ShieldCheck, HeartHandshake, Users, BookOpen, Lock, Zap, Download } from 'lucide-react';
import type { Audience, PersonaTheme } from '@/types';
import { MISSION_LINE, MISSION_ATTRIBUTION, MISSION_SENTENCE } from '@/lib/mission';
import { NARRATOR_DISCLOSURE_LINE, NARRATOR_DISCLOSURE_LINE_WOMEN } from '@/lib/privacyCopy';
import { PrintPageHead } from '@/components/PrintPageHead';
import { CrisisLine } from '@/components/CrisisLine';
import { PRINT_SERIF, PRINT_STAMP_CLASS } from '@/lib/print';

interface AboutSanctumPageProps {
  t: PersonaTheme;
  accent?: string;
  audience: Audience;
  onClose: () => void;
}

interface Point {
  icon: typeof Church;
  title: string;
  body: string;
}

/**
 * The page a priest, catechist, or men's group leader reads before deciding whether to pass
 * Sanctum on. Its whole job is to state plainly what the app is and, more importantly, what it
 * is not — the boundaries are the thing a referrer is actually checking for.
 *
 * Stage 2 of the printed-page re-skin (Nov 14, 2026) sets it as the book's
 * colophon: a leaf of the track's paper under the shared chapter head, the
 * Bloy thesis at its head, and every section below ruled off by hairlines.
 * The words are the page's own, unchanged.
 */
export function AboutSanctumPage({ t, accent, audience, onClose }: AboutSanctumPageProps) {
  const a = accent ?? t.accent;
  const w = audience === 'women';

  const points: Point[] = [
    {
      icon: Church,
      title: 'What it is',
      body: w
        ? 'A private place for a woman to pray and to think. It opens on the day\u2019s Gospel and the saint of the day, offers a pocket church of prayers, the Rosary, Confession preparation, the Catechism, and eight companions drawn from Scripture and the saints.'
        : 'A private place for a man to pray and to think. It opens on the day\u2019s Gospel and the saint of the day, offers a pocket church of prayers, the Rosary, Confession preparation, the Catechism, and eight companions drawn from Scripture and the saints.',
    },
    {
      icon: ShieldCheck,
      title: 'What it is not',
      body: w
        ? 'It is not a priest and it is not a therapist. Sanctum cannot baptize, absolve, marry, or anoint, and it does not diagnose or treat. It says so on screen, and it is built to hand a woman to a real person rather than keep her.'
        : 'It is not a priest and it is not a therapist. Sanctum cannot baptize, absolve, marry, or anoint, and it does not diagnose or treat. It says so on screen, and it is built to hand a man to a real person rather than keep him.',
    },
    {
      icon: HeartHandshake,
      title: w ? 'Where it sends a woman' : 'Where it sends a man',
      body: w
        ? 'To a priest, a spiritual director, a Catholic therapist, or a women\u2019s group. That screen is deliberately prominent, and a woman in crisis is handed to 988 and to emergency help instead of being kept in a conversation.'
        : 'To a priest, a spiritual director, a Catholic therapist, or a men\u2019s group. That screen is deliberately prominent, and a man in crisis is handed to 988 and to emergency help instead of being kept in a conversation.',
    },
    {
      icon: Users,
      title: 'What it keeps',
      body: w
        ? 'There is no account and no name, and no conversation is ever stored on a server — a message travels to the AI provider for its reply and is then discarded. What a woman writes lives only in her own browser, and the days and weeks Sanctum keeps for her live only on her device too — the kept days and weeks, the one sentence she offers Tailor Today, which a companion\u2019s letter may one day draw on, and the North Star she may choose, which guides Tailor, the companions, and a companion\u2019s letter, and the voices she may name, which are used only to choose the day\u2019s media pick, and the name she may give, which a companion is handed only as the name itself \u2014 in a chat, or in a letter \u2014 and nothing more. The only things ever held remotely are a scrambled anti-abuse counter, a push subscription if she asks for the daily reminder (its notification address and encryption keys, her track, and her timezone), a feedback note if she sends one — with an email address only if she adds one — an access request if she sends one — the name and contact she gives, kept only so she can be answered — anonymous usage counts if she turns them on — the screens she uses, and the boxes checked in her Tailor profile, held only as totals counted across all readers and never as words — and, if she asks Tailor Today to write for her, the devotional it writes: the text itself, with none of her answers and nothing that identifies her, deleted within 90 days.'
        : 'There is no account and no name, and no conversation is ever stored on a server — a message travels to the AI provider for its reply and is then discarded. What a man writes lives only in his own browser, and the days and weeks Sanctum keeps for him live only on his device too — the kept days and weeks, the one sentence he offers Tailor Today, which a companion\u2019s letter may one day draw on, and the North Star he may choose, which guides Tailor, the companions, and a companion\u2019s letter, and the voices he may name, which are used only to choose the day\u2019s media pick, and the name he may give, which a companion is handed only as the name itself \u2014 in a chat, or in a letter \u2014 and nothing more. The only things ever held remotely are a scrambled anti-abuse counter, a push subscription if he asks for the daily reminder (its notification address and encryption keys, his track, and his timezone), a feedback note if he sends one — with an email address only if he adds one — an access request if he sends one — the name and contact he gives, kept only so he can be answered — anonymous usage counts if he turns them on — the screens he uses, and the boxes checked in his Tailor profile, held only as totals counted across all readers and never as words — and, if he asks Tailor Today to write for him, the devotional it writes: the text itself, with none of his answers and nothing that identifies him, deleted within 90 days.',
    },
    {
      icon: BookOpen,
      title: 'What it costs',
      body: w
        ? 'Nothing. There is no account, no advertising, and nothing to buy, and nothing about a woman is sold.'
        : 'Nothing. There is no account, no advertising, and nothing to buy, and nothing about a man is sold.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <div
        className="min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto"
        style={{
          backgroundColor: t.card,
          borderLeft: `1px solid ${t.border}`,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <PrintPageHead t={t} title="About Sanctum" onBack={onClose} onClose={onClose} />

        {/* The crisis line at the head of the page (Erik, Nov 18, 2026),
            above the colophon — even the page that explains the app opens
            by handing a person in crisis to real help. */}
        <CrisisLine muted={t.textMuted} bright={t.textBright} className="w-full mb-6" />

        {/* Why Sanctum exists — the thesis at the head of the colophon. */}
        <div className="w-full text-center px-4 mb-6 animate-fade-in">
          <p className={`${PRINT_STAMP_CLASS} mb-2`} style={{ fontFamily: PRINT_SERIF, color: a }}>
            Why Sanctum exists
          </p>
          <p className="italic text-[17px] leading-snug" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            {MISSION_LINE}
          </p>
          <p className={`${PRINT_STAMP_CLASS} mt-1.5`} style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
            {MISSION_ATTRIBUTION}
          </p>
          <p className="text-sm leading-relaxed mt-3" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {MISSION_SENTENCE}
          </p>
          {/* The brand statement's second home (Erik, Nov 14, 2026): the
              tagline and the two stamped chips stand with the thesis here
              and at the welcome gate — nowhere else. */}
          <p className="text-xs leading-relaxed mt-4 max-w-sm mx-auto" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            {w
              ? 'A private sanctuary for women seeking counsel, stillness, and strength'
              : 'A private sanctuary for men seeking counsel, stillness, and strength'}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap mt-3">
            <span className="text-[12px] stamped flex items-center gap-1" style={{ color: t.textDim }}>
              <Lock className="w-3 h-3" /> Nothing You Write Is Stored on a Server
            </span>
            <span className="text-[12px]" style={{ color: t.textDim }}>•</span>
            <span className="text-[12px] stamped flex items-center gap-1" style={{ color: t.textDim }}>
              <Zap className="w-3 h-3" /> No Account Needed
            </span>
          </div>
        </div>

        {/* Opening */}
        <div
          className="w-full border p-5 mb-6 animate-fade-in"
          style={{ backgroundColor: `${a}0F`, borderColor: `${a}33` }}
        >
          <p className="text-sm leading-relaxed text-center font-medium" style={{ fontFamily: PRINT_SERIF, color: t.text }}>
            {w
              ? 'A Catholic companion for women. It is built for the woman who will not walk into a church yet, and for the woman who will, but has nowhere to put the weight at two in the morning.'
              : 'A Catholic companion for men. It is built for the man who will not walk into a church yet, and for the man who will, but has nowhere to put the weight at two in the morning.'}
          </p>
        </div>

        {/* The shape of a day — the Ignatian arc the whole app is built to walk. */}
        <div className="w-full pt-5 mb-6 animate-fade-in" style={{ borderTop: `3px double ${t.border}` }}>
          <h2 className="text-[15px] font-semibold mb-2" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            The shape of a day
          </h2>
          <p className="text-xs leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            A day here has a shape, and it is an old one. Hear the Gospel. Sit with it — reflect,
            and take the day&rsquo;s challenge. Walk a while with a companion who has walked the
            road before. Pray. Be reconciled: the app points to a priest, to Confession, and to
            real help whenever what is needed is a real person. Do the good in front of you. Then,
            at night, review the day in the Examen and rest. Everything in Sanctum points at
            something else in Sanctum, and all of it points out of the app — to Mass, to
            Confession, to prayer, and to the people in front of you.
          </p>
        </div>

        {/* The points — ruled sections of the colophon. */}
        <div className="w-full">
          {points.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="pt-5 pb-5 animate-slide-up"
                style={{
                  borderTop: `1px solid ${t.border}`,
                  animationDelay: `${index * 60}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0 border"
                    style={{ backgroundColor: `${a}1A`, borderColor: `${a}3D` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: a }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="text-[15px] font-semibold mb-1.5"
                      style={{ fontFamily: PRINT_SERIF, color: t.textBright }}
                    >
                      {point.title}
                    </h2>
                    <p className="text-xs leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
                      {point.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* For leaders */}
        <div className="w-full pt-5 mt-1 animate-fade-in" style={{ borderTop: `3px double ${t.border}` }}>
          <h2 className="text-[15px] font-semibold mb-2" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            For priests and group leaders
          </h2>
          <p className="text-xs leading-relaxed mb-3" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            Sanctum is meant to sit alongside your work, not replace it. It will not hear a confession,
            counsel a marriage, or stand in for a pastor. What it can do is stay with {w ? 'a woman' : 'a man'} on the
            ordinary nights in between, and keep pointing {w ? 'her' : 'him'} back to you.
          </p>
          <p className="text-xs leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            It costs {w ? 'her' : 'him'} nothing, asks for no account, keeps no record of what {w ? 'she' : 'he'} writes, and hands {w ? 'her' : 'him'}
            to real help when {w ? 'she' : 'he'} needs more than a conversation. If you would like to see exactly what a
            companion is and is not allowed to say, the boundaries are the same ones written on this page.
          </p>
          {/* The gatekeeper packet (Nov 20, 2026): the same boundaries and the
              shape of a free parish pilot, set as two printed pages a priest
              can be handed. Same text on both tracks — it is addressed to the
              parish, not to the reader's track. */}
          <a
            href="/gatekeeper-packet.pdf"
            download
            className="mt-4 flex items-center gap-2.5 border px-3.5 py-3 transition-opacity hover:opacity-80 active:opacity-60"
            style={{ backgroundColor: `${a}1A`, borderColor: `${a}3D` }}
          >
            <Download className="w-4 h-4 flex-shrink-0" style={{ color: a }} />
            <span className="min-w-0">
              <span className={`${PRINT_STAMP_CLASS} block`} style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
                For parish leaders — the gatekeeper packet
              </span>
              <span className="block text-xs leading-relaxed mt-0.5" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
                Two pages, as a PDF: what Sanctum is, and what a free pilot asks of a parish — nothing.
              </span>
            </span>
          </a>
        </div>

        {/* The voices the listener hears — named as what they are, beside the companion copy. */}
        <div className="w-full pt-5 mt-6 animate-fade-in" style={{ borderTop: `1px solid ${t.border}` }}>
          <h2 className="text-[15px] font-semibold mb-2" style={{ fontFamily: PRINT_SERIF, color: t.textBright }}>
            The Gospel, read aloud
          </h2>
          <p className="text-xs leading-relaxed" style={{ fontFamily: PRINT_SERIF, color: t.textMuted }}>
            {w ? (
              <>
                Every morning the day&rsquo;s Gospel and reflection can be listened to as well as
                read, in a sister&rsquo;s voice that changes with the weekday. {NARRATOR_DISCLOSURE_LINE_WOMEN}
              </>
            ) : (
              <>
                Every morning the day&rsquo;s Gospel and reflection can be listened to as well as
                read, in a brother&rsquo;s voice that changes with the weekday. {NARRATOR_DISCLOSURE_LINE}
              </>
            )}
          </p>
        </div>

        <p className="text-[13px] text-center mt-6 leading-relaxed max-w-sm" style={{ fontFamily: PRINT_SERIF, color: t.textDim }}>
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US),
          or findahelpline.com outside the US.
        </p>
      </div>
    </div>
  );
}
