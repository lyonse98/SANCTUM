import { Phone, MessageSquare, Globe, ShieldAlert, X, LifeBuoy, HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import { CRISIS_RESOURCES } from '@/lib/crisis';
import type { PersonaTheme } from '@/types';

interface CrisisCardProps {
  theme: PersonaTheme;
  dismissable?: boolean;
  onDismiss?: () => void;
}

export function CrisisCard({ theme: t, dismissable = false, onDismiss }: CrisisCardProps) {
  return (
    <div
      className="rounded-xl p-4 border-2 animate-fade-in"
      style={{
        backgroundColor: 'rgba(153,27,27,0.06)',
        borderColor: 'rgba(185,28,28,0.45)',
      }}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#B91C1C' }} />
        <div className="flex-1">
          <p className="text-sm font-bold mb-1" style={{ color: '#991B1B' }}>
            You matter. Help is here right now.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>
            What you are carrying is too heavy to hold alone. Reaching out is strength, not weakness.
            These people are ready to help you right now.
          </p>
        </div>
        {dismissable && onDismiss && (
          <button onClick={onDismiss} className="p-1 rounded transition-opacity hover:opacity-70" style={{ color: t.textDim }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {CRISIS_RESOURCES.map((r) => {
          const isText = r.href.startsWith('sms');
          const isWeb = r.href.startsWith('http');
          const Icon = isWeb ? Globe : isText ? MessageSquare : Phone;
          return (
            <a
              key={r.label}
              href={r.href}
              target={isWeb ? '_blank' : undefined}
              rel={isWeb ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
              style={{
                backgroundColor: 'rgba(153,27,27,0.07)',
                borderColor: 'rgba(185,28,28,0.25)',
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#B91C1C' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: '#991B1B' }}>{r.label}</p>
                <p className="text-[11px]" style={{ color: t.textMuted }}>{r.detail}</p>
              </div>
              <span className="text-[11px] font-bold flex-shrink-0" style={{ color: '#B91C1C' }}>
                {r.action}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Uncloseable full-screen modal for hard crisis triggers. */
export function CrisisModal({ onFindHelp }: { theme: PersonaTheme; onFindHelp?: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-5 overflow-y-auto"
      style={{ backgroundColor: 'rgba(10,8,8,0.97)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-md my-8 animate-slide-up">
        <div className="text-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2"
            style={{ backgroundColor: 'rgba(153,27,27,0.15)', borderColor: 'rgba(248,113,113,0.5)' }}
          >
            <LifeBuoy className="w-8 h-8" style={{ color: '#f87171' }} />
          </div>
          <h2 className="text-lg font-bold font-display uppercase tracking-wide mb-2" style={{ color: '#fca5a5' }}>
            You are not alone in this moment
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#d1d5db' }}>
            What you are carrying is too heavy to hold by yourself. Reaching out is strength — not weakness.
            Please talk to someone right now.
          </p>
        </div>

        <div className="space-y-2.5 mb-5">
          {CRISIS_RESOURCES.map((r) => {
            const isText = r.href.startsWith('sms');
            const isWeb = r.href.startsWith('http');
            const Icon = isWeb ? Globe : isText ? MessageSquare : Phone;
            return (
              <a
                key={r.label}
                href={r.href}
                target={isWeb ? '_blank' : undefined}
                rel={isWeb ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'rgba(153,27,27,0.18)',
                  borderColor: 'rgba(248,113,113,0.4)',
                }}
              >
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: '#fca5a5' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: '#fca5a5' }}>{r.label}</p>
                  <p className="text-[11px]" style={{ color: '#d1d5db' }}>{r.detail}</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: '#f87171' }}>
                  {r.action}
                </span>
              </a>
            );
          })}
        </div>

        {!acknowledged ? (
          <button
            onClick={() => setAcknowledged(true)}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] border"
            style={{ backgroundColor: 'rgba(153,27,27,0.2)', borderColor: 'rgba(248,113,113,0.4)', color: '#fca5a5' }}
          >
            I have reached out
          </button>
        ) : (
          <div
            className="w-full rounded-xl p-4 border text-center"
            style={{ backgroundColor: 'rgba(63,91,63,0.15)', borderColor: 'rgba(90,122,90,0.4)' }}
          >
            <p className="text-sm font-medium" style={{ color: '#a3c4a3' }}>
              Good. You did the hard thing. Stay with them. You can return to Sanctum when you're ready.
            </p>
          </div>
        )}

        {onFindHelp && (
          <button
            onClick={onFindHelp}
            className="w-full mt-3 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98] border flex items-center justify-center gap-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)', color: '#d1d5db' }}
          >
            <HeartHandshake className="w-4 h-4" />
            Find a priest or counselor near me
          </button>
        )}

        <p className="text-[11px] text-center mt-4 leading-relaxed" style={{ color: '#9ca3af' }}>
          Sanctum is not a crisis service. These resources are. Please use them.
        </p>
      </div>
    </div>
  );
}
