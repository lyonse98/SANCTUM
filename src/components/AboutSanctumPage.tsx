import { ArrowLeft, X, Church, ShieldCheck, HeartHandshake, Users, BookOpen } from 'lucide-react';
import type { PersonaTheme } from '@/types';

interface AboutSanctumPageProps {
  t: PersonaTheme;
  accent?: string;
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
 */
export function AboutSanctumPage({ t, accent, onClose }: AboutSanctumPageProps) {
  const a = accent ?? t.accent;

  const points: Point[] = [
    {
      icon: Church,
      title: 'What it is',
      body: 'A private place for a man to pray and to think. It opens on the day\u2019s Gospel and the saint of the day, offers a small workshop of grounding and stillness tools, a pocket church of prayers, the Rosary, Confession preparation, and the Catechism, and eight companions drawn from Scripture and the saints.',
    },
    {
      icon: ShieldCheck,
      title: 'What it is not',
      body: 'It is not a priest and it is not a therapist. Sanctum cannot baptize, absolve, marry, or anoint, and it does not diagnose or treat. It says so on screen, and it is built to hand a man to a real person rather than keep him.',
    },
    {
      icon: HeartHandshake,
      title: 'Where it sends a man',
      body: 'To a priest, a spiritual director, a Catholic therapist, or a men\u2019s group. That screen is deliberately prominent, and a man in crisis is handed to 988 and to emergency help instead of being kept in a conversation.',
    },
    {
      icon: Users,
      title: 'What it keeps',
      body: 'There is no account and no name, and no conversation is ever stored on a server — a message travels to the AI provider for its reply and is then discarded. What a man writes lives only in his own browser. The only things ever held remotely are a scrambled anti-abuse counter, an email address if he asks for the daily reminder, a feedback note if he sends one, and anonymous usage counts if he turns them on.',
    },
    {
      icon: BookOpen,
      title: 'What it costs',
      body: 'Nothing. There is no account, no advertising, and nothing to buy, and nothing about a man is sold.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <div className="min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95"
            style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold font-display uppercase tracking-wide">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{ backgroundColor: `${a}1F`, borderColor: `${a}4D` }}
            >
              <Church className="w-4 h-4" style={{ color: a }} />
            </div>
            <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
              About Sanctum
            </h1>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 border"
            style={{ backgroundColor: t.card, color: t.textMuted, borderColor: `${t.border}99` }}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opening */}
        <div
          className="w-full rounded-xl border p-5 mb-6 animate-fade-in"
          style={{ backgroundColor: `${a}0F`, borderColor: `${a}33` }}
        >
          <p className="text-sm leading-relaxed text-center font-medium" style={{ color: t.text }}>
            A Catholic companion for men. It is built for the man who will not walk into a church yet,
            and for the man who will, but has nowhere to put the weight at two in the morning.
          </p>
        </div>

        {/* The points */}
        <div className="w-full space-y-4">
          {points.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="rounded-2xl border p-4 animate-slide-up"
                style={{
                  backgroundColor: t.card,
                  borderColor: `${t.border}99`,
                  animationDelay: `${index * 60}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
                    style={{ backgroundColor: `${a}1A`, borderColor: `${a}3D` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: a }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="text-sm font-bold font-display uppercase tracking-wide mb-1.5"
                      style={{ color: t.textBright }}
                    >
                      {point.title}
                    </h2>
                    <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
                      {point.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* For leaders */}
        <div
          className="w-full rounded-2xl border p-5 mt-6 animate-fade-in"
          style={{ backgroundColor: `${a}0D`, borderColor: `${a}33` }}
        >
          <h2 className="text-sm font-bold font-display uppercase tracking-wide mb-2" style={{ color: t.textBright }}>
            For priests and group leaders
          </h2>
          <p className="text-xs leading-relaxed mb-3" style={{ color: t.textMuted }}>
            Sanctum is meant to sit alongside your work, not replace it. It will not hear a confession,
            counsel a marriage, or stand in for a pastor. What it can do is stay with a man on the
            ordinary nights in between, and keep pointing him back to you.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
            It costs him nothing, asks for no account, keeps no record of what he writes, and hands him
            to real help when he needs more than a conversation. If you would like to see exactly what a
            companion is and is not allowed to say, the boundaries are the same ones written on this page.
          </p>
        </div>

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-sm" style={{ color: t.textDim }}>
          Sanctum is a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US),
          or findahelpline.com outside the US.
        </p>
      </div>
    </div>
  );
}
