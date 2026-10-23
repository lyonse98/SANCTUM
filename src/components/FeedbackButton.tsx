import { useState } from 'react';
import { MessageSquarePlus, X, Lightbulb, Bug } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { useFeedback } from '@/components/FeedbackProvider';

/**
 * The always-available way to reach feedback. Rendered once, above every screen, so a man who
 * hits a broken thing does not have to hunt for Settings. Collapsed to a single quiet button by
 * default; it expands on tap to name what it is for.
 */
export function FeedbackButton({ theme, page }: { theme: PersonaTheme; page?: string }) {
  const feedback = useFeedback();
  const [expanded, setExpanded] = useState(false);

  if (!feedback) return null;

  const t = theme;

  return (
    <div className="fixed bottom-3 right-3 z-[65] flex flex-col items-end gap-2 print:hidden">
      {expanded && (
        <div
          className="w-56 rounded-xl border shadow-2xl overflow-hidden animate-slide-up"
          style={{ backgroundColor: t.bg, borderColor: t.border }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: `${t.border}66` }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: t.textDim }}>
              Talk to the builder
            </p>
          </div>
          <button
            onClick={() => { setExpanded(false); feedback.openFeedback(page); }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.cardHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Bug className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
            <div>
              <p className="text-[11px] font-bold" style={{ color: t.textBright }}>
                Something is broken
              </p>
              <p className="text-[10px] leading-snug" style={{ color: t.textDim }}>
                Tell us what went wrong
              </p>
            </div>
          </button>
          <button
            onClick={() => { setExpanded(false); feedback.openFeedback(page); }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-t transition-colors"
            style={{ borderColor: `${t.border}66` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.cardHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent }} />
            <div>
              <p className="text-[11px] font-bold" style={{ color: t.textBright }}>
                I have an idea
              </p>
              <p className="text-[10px] leading-snug" style={{ color: t.textDim }}>
                Something that would help
              </p>
            </div>
          </button>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Close feedback menu' : 'Send feedback'}
        aria-expanded={expanded}
        title={expanded ? 'Close' : 'Send feedback or report a bug'}
        className="flex items-center gap-2 h-10 rounded-full border shadow-lg transition-all duration-200 active:scale-95"
        style={{
          paddingLeft: expanded ? 12 : 11,
          paddingRight: expanded ? 14 : 11,
          backgroundColor: expanded ? t.card : t.bg,
          borderColor: expanded ? t.accentRgba(0.4) : `${t.border}99`,
          color: expanded ? t.accent : t.textMuted,
        }}
      >
        {expanded ? <X className="w-4 h-4" /> : <MessageSquarePlus className="w-4 h-4" />}
        {expanded && (
          <span className="text-[10px] font-bold uppercase tracking-wider">Feedback</span>
        )}
      </button>
    </div>
  );
}
