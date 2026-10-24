import { useEffect, useRef, useState } from 'react';
import { COMPANION_PORTRAYAL_LINE } from '@/lib/privacyCopy';
import {
  BookOpen,
  Check,
  ExternalLink,
  Share2,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { ChatMessage, Persona } from '@/types';
import { ShareCardModal } from '@/components/ShareCardModal';
import { CrisisCard } from '@/components/CrisisCard';
import { CompanionAvatar } from '@/components/CompanionAvatar';

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const TOOL_RE = /\[([^\]]+)\]\(tool:([a-z-]+)\)/g;

const TOOL_LABELS: Record<string, string> = {
  'cold-start': 'Cold Start',
  'breathing': 'Breath Pacer',
  'grounding': '5-4-3-2-1 Grounding',
  'examen': 'Evening Examen',
  'rule': 'Rule of Life',
  'scripture': 'Prayer Library',
  'lectio': 'Lectio Divina',
  'rosary': 'Rosary',
  'bible-year': 'Bible in a Year',
  'confession': 'Confession Guide',
  'catechism': 'Catechism',
  'driveway': 'Driveway Reset',
};

function renderContent(text: string, linkColor: string, onOpenTool?: (tool: string) => void) {
  const parts: (string | React.ReactNode)[] = [];
  let last = 0;

  TOOL_RE.lastIndex = 0;
  const toolMatches: { index: number; label: string; tool: string; end: number }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = TOOL_RE.exec(text)) !== null) {
    toolMatches.push({ index: tm.index, label: tm[1], tool: tm[2], end: tm.index + tm[0].length });
  }

  LINK_RE.lastIndex = 0;
  const linkMatches: { index: number; label: string; url: string; end: number }[] = [];
  let lm: RegExpExecArray | null;
  while ((lm = LINK_RE.exec(text)) !== null) {
    linkMatches.push({ index: lm.index, label: lm[1], url: lm[2], end: lm.index + lm[0].length });
  }

  const all = [...toolMatches.map((m) => ({ ...m, type: 'tool' as const })), ...linkMatches.map((m) => ({ ...m, type: 'link' as const, url: m.url }))].sort((a, b) => a.index - b.index);

  let i = 0;
  for (const match of all) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match.type === 'tool' && onOpenTool) {
      parts.push(
        <button
          key={`tool-${i++}`}
          onClick={() => onOpenTool(match.tool)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 my-0.5"
          style={{ backgroundColor: `${linkColor}22`, color: linkColor, border: `1px solid ${linkColor}44` }}
        >
          <Wrench className="w-3 h-3 flex-shrink-0" />
          {TOOL_LABELS[match.tool] ?? match.label}
        </button>,
      );
    } else if (match.type === 'tool') {
      parts.push(text.slice(match.index, match.end));
    } else {
      parts.push(
        <a
          key={`link-${i++}`}
          href={match.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity"
          style={{ color: linkColor }}
        >
          {match.label}
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>,
      );
    }
    last = match.end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

interface ChatFeedProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  persona: Persona;
  crisisActive?: boolean;
  onCrisisDismiss?: () => void;
  onOpenTool?: (tool: string) => void;
  onReflectGospel?: (cardId: string) => void;
}

export function ChatFeed({ messages, isStreaming, streamingContent, persona, crisisActive, onCrisisDismiss, onOpenTool, onReflectGospel }: ChatFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const t = persona.theme;
  const [shareContent, setShareContent] = useState<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="relative mb-5">
          <div
            className="rounded-xl shadow-xl border overflow-hidden"
            style={{ backgroundColor: t.card, borderColor: t.borderLight }}
          >
            <CompanionAvatar personaId={persona.id} theme={t} size={72} />
          </div>
          <div
            className="absolute -inset-1 rounded-xl blur-lg -z-10"
            style={{ backgroundColor: t.glow }}
          />
        </div>
        <h2
          className="text-xl font-bold mb-2 font-display uppercase tracking-wide"
          style={{ color: t.textBright }}
        >
          {persona.name}
        </h2>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: t.textMuted }}>
          {persona.description}
        </p>
        <div className="mt-5 flex items-center gap-2 text-[10px] stamped" style={{ color: t.textDim }}>
          <div className="w-8 h-px" style={{ backgroundColor: `${t.borderLight}66` }} />
          <span>{persona.tagline}</span>
          <div className="w-8 h-px" style={{ backgroundColor: `${t.borderLight}66` }} />
        </div>
        <p className="mt-4 text-[11px] leading-relaxed max-w-[260px]" style={{ color: t.textDim }}>
          {COMPANION_PORTRAYAL_LINE}
        </p>
        <p className="mt-6 text-sm italic" style={{ color: t.accent }}>
          "I'm here, brother. Speak when you're ready."
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-3">
      {crisisActive && (
        <CrisisCard theme={persona.theme} dismissable onDismiss={onCrisisDismiss} />
      )}
      {messages.map((msg) => {
        if (msg.role === 'assistant' && msg.content === '__CRISIS__') return null;
        if (msg.kind === 'gospel') {
          return <GospelContextCard key={msg.id} message={msg} persona={persona} onReflect={onReflectGospel} />;
        }
        return <MessageBubble key={msg.id} message={msg} persona={persona} onShare={setShareContent} onOpenTool={onOpenTool} />;
      })}
      {isStreaming && (
        <div className="flex gap-2.5 items-start animate-fade-in">
          <div
            className="flex-shrink-0 mt-0.5 shadow-sm border overflow-hidden rounded-lg"
            style={{ backgroundColor: t.card, borderColor: t.borderLight }}
          >
            <CompanionAvatar personaId={persona.id} theme={t} size={32} />
          </div>
          <div className="max-w-[80%]">
            {streamingContent ? (
              <div
                className="rounded-xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border"
                style={{ backgroundColor: t.card, borderColor: `${t.border}80`, color: t.text }}
              >
                {renderContent(streamingContent, t.accent, onOpenTool)}
                <span
                  className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle"
                  style={{ backgroundColor: t.accent }}
                />
              </div>
            ) : (
              <div
                className="rounded-xl rounded-tl-sm px-4 py-3.5 flex flex-row items-center gap-1.5 border"
                style={{ backgroundColor: t.card, borderColor: `${t.border}80` }}
              >
                <span className="typing-dot w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.accent }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.accent }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.accent }} />
              </div>
            )}
          </div>
        </div>
      )}
      <div ref={endRef} />
      <ShareCardModal
        open={shareContent !== null}
        content={shareContent ?? ''}
        persona={persona}
        onClose={() => setShareContent(null)}
      />
    </div>
  );
}

function MessageBubble({
  message,
  persona,
  onShare,
  onOpenTool,
}: {
  message: ChatMessage;
  persona: Persona;
  onShare: (content: string) => void;
  onOpenTool?: (tool: string) => void;
}) {
  const isUser = message.role === 'user';
  const t = persona.theme;

  if (isUser) {
    return (
      <div className="flex gap-2.5 items-start justify-end animate-fade-in">
        <div className="max-w-[80%]">
          <div
            className="rounded-xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border"
            style={{
              backgroundColor: t.accentRgba(0.12),
              borderColor: t.accentRgba(0.25),
              color: t.textBright,
            }}
          >
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start animate-fade-in">
      <div
        className="flex-shrink-0 mt-0.5 shadow-sm border overflow-hidden rounded-lg"
        style={{ backgroundColor: t.card, borderColor: t.borderLight }}
      >
        <CompanionAvatar personaId={persona.id} theme={t} size={32} />
      </div>
      <div className="max-w-[80%]">
        <div
          className="rounded-xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border group"
          style={{ backgroundColor: t.card, borderColor: `${t.border}80`, color: t.text }}
        >
          {renderContent(message.content, t.accent, onOpenTool)}
          <div className="flex justify-end mt-2">
            <button
              onClick={() => onShare(message.content)}
              className="flex items-center gap-1 text-[10px] font-medium transition-opacity hover:opacity-70"
              style={{ color: t.textDim }}
            >
              <Share2 className="w-3 h-3" />
              Share this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The day's readings, shown as what they are: context the app brought to the
 * conversation, not words the man typed. Reflection happens only on his tap,
 * and (unlike an ordinary message) costs none of his daily allowance.
 */
function GospelContextCard({
  message,
  persona,
  onReflect,
}: {
  message: ChatMessage;
  persona: Persona;
  onReflect?: (cardId: string) => void;
}) {
  const t = persona.theme;
  return (
    <div
      className="rounded-xl border-2 px-4 py-3 animate-fade-in"
      style={{ backgroundColor: `${t.accent}0D`, borderColor: t.accentRgba(0.4) }}
    >
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-3.5 h-3.5" style={{ color: t.accent }} />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: t.accent }}>
          Today&rsquo;s Readings &middot; Context
        </span>
      </div>
      <div
        className="text-[11px] leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto chat-scroll pr-1"
        style={{ color: t.textMuted }}
      >
        {message.content}
      </div>
      {message.reflected ? (
        <div className="flex items-center gap-1.5 mt-3" style={{ color: t.textDim }}>
          <Check className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wide">Reflected with {persona.name}</span>
        </div>
      ) : (
        <button
          onClick={() => onReflect?.(message.id)}
          className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2.5 rounded-lg border-2 transition-all active:scale-[0.98]"
          style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">
            Reflect with {persona.name}
          </span>
        </button>
      )}
    </div>
  );
}
