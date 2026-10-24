import { ArrowLeft, X, Scroll, Heart, ShieldCheck, Database } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import {
  PRIVACY_PARAGRAPH,
  PRIVACY_SERVER_INTRO,
  PRIVACY_SERVER_LIST,
  PRIVACY_THIRD_PARTY,
} from '@/lib/privacyCopy';

interface TermsPageProps {
  t: PersonaTheme;
  accent?: string;
  onClose: () => void;
}

/**
 * The real Terms & Privacy page. Until this existed, every "Terms & Privacy" link
 * re-opened the first-run welcome gate — a man looking for the privacy policy mid-use
 * found a disclaimer and a button, not the policy. This page renders the canonical
 * privacy text (src/lib/privacyCopy.ts) in full, plus the scope disclaimers.
 */
export function TermsPage({ t, accent, onClose }: TermsPageProps) {
  const a = accent ?? t.accent;

  const sections: { icon: typeof Scroll; title: string; body: React.ReactNode }[] = [
    {
      icon: Scroll,
      title: 'What Sanctum is',
      body: (
        <p>
          Sanctum is an automated AI spiritual companion and habit tool, designed for
          educational, reflective, and devotional purposes only. It is NOT a licensed mental
          health service, a medical device, a crisis intervention platform, or an official
          Catholic sacrament such as Sacramental Confession. The companions are AI voices
          shaped on the lives of the saints; they are not the saints, and their words are not
          spiritual direction.
        </p>
      ),
    },
    {
      icon: Heart,
      title: 'If you are in crisis',
      body: (
        <p>
          If you are in crisis or considering self-harm, this app is not a substitute for
          professional help. Call or text <strong>988</strong> (US), text HOME to{' '}
          <strong>741741</strong>, or visit findahelpline.com for international support. In
          immediate danger, call 911.
        </p>
      ),
    },
    {
      icon: ShieldCheck,
      title: 'Your privacy',
      body: (
        <>
          <p className="mb-2">{PRIVACY_PARAGRAPH}</p>
          <p>{PRIVACY_THIRD_PARTY}</p>
        </>
      ),
    },
    {
      icon: Database,
      title: 'What can be held on a server',
      body: (
        <>
          <p className="mb-2">{PRIVACY_SERVER_INTRO}</p>
          <ul className="list-disc pl-4 space-y-1.5">
            {PRIVACY_SERVER_LIST.map((item) => (
              <li key={item.slice(0, 24)}>{item}</li>
            ))}
          </ul>
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto chat-scroll" style={{ backgroundColor: t.bg }}>
      <div className="min-h-full flex flex-col items-center px-5 py-6 max-w-2xl mx-auto">
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95"
            style={{ backgroundColor: t.card, borderColor: `${t.border}99`, color: t.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-bold font-display uppercase tracking-wide">Back</span>
          </button>
          <h1 className="text-lg font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
            Terms &amp; Privacy
          </h1>
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

        <div className="w-full space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="rounded-2xl border p-4"
                style={{ backgroundColor: t.card, borderColor: `${t.border}99` }}
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
                      {section.title}
                    </h2>
                    <div className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
                      {section.body}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-center mt-6 leading-relaxed max-w-sm" style={{ color: t.textDim }}>
          Using Sanctum means accepting these terms. The panic button in any conversation wipes
          everything Sanctum holds on this device.
        </p>
      </div>
    </div>
  );
}
