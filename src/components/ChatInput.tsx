import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import type { Persona } from '@/types';
import { DAILY_MESSAGE_CAP } from '@/lib/messageCap';

const MAX_CHARS = 800;
const RATE_LIMIT_COUNT = 10;
const RATE_LIMIT_WINDOW_MS = 120_000;

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  persona: Persona;
  remainingMessages: number;
}

export function ChatInput({ onSend, onStop, isStreaming, persona, remainingMessages }: ChatInputProps) {
  const [text, setText] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timestampsRef = useRef<number[]>([]);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = persona.theme;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_CHARS) return;

    const now = Date.now();
    const recent = timestampsRef.current.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_COUNT) {
      setRateLimited(true);
      timestampsRef.current = recent;
      cooldownTimerRef.current = setTimeout(() => {
        setRateLimited(false);
      }, RATE_LIMIT_WINDOW_MS);
      return;
    }

    timestampsRef.current = [...recent, now];
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = text.length;
  const overLimit = charCount > MAX_CHARS;

  return (
    <div
      className="px-4 pt-2.5 pb-3 border-t backdrop-blur-sm"
      style={{ backgroundColor: `${t.bg}F2`, borderColor: `${t.border}66` }}
    >
      {rateLimited && (
        <div
          className="mb-2 rounded-lg px-3 py-2 border text-center animate-fade-in"
          style={{ backgroundColor: 'rgba(153,27,27,0.12)', borderColor: 'rgba(185,28,28,0.35)' }}
        >
          <p className="text-[11px] font-medium leading-relaxed" style={{ color: '#991B1B' }}>
            Take a breath brother. Spend 2 minutes in reflection or use an Offline Tool before sending your next message.
          </p>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <div
          className="flex-1 rounded-xl flex items-end overflow-hidden border transition-colors"
          style={{ backgroundColor: t.card, borderColor: `${t.border}80` }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Speak plainly, brother..."
            rows={1}
            maxLength={MAX_CHARS}
            className="flex-1 bg-transparent text-sm px-4 py-3 resize-none outline-none max-h-[120px] leading-relaxed"
            style={{ color: t.text }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {isStreaming ? (
          <button
            onClick={onStop}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 border"
            style={{
              backgroundColor: 'rgba(153,27,27,0.1)',
              borderColor: 'rgba(185,28,28,0.35)',
              color: '#B91C1C',
            }}
            aria-label="Stop generation"
          >
            <Square className="w-4 h-4" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() || overLimit || rateLimited}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none flex-shrink-0 shadow-md"
            style={{
              backgroundColor: t.accent,
              color: '#ffffff',
              boxShadow: `0 4px 12px ${t.accentRgba(0.2)}`,
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-center max-w-2xl mx-auto mt-1">
        {remainingMessages <= 5 && remainingMessages > 0 && (
          <span className="text-[10px] tabular-nums" style={{ color: remainingMessages <= 2 ? '#f59e0b' : t.textDim }}>
            {remainingMessages} message{remainingMessages === 1 ? '' : 's'} left today
          </span>
        )}
        {remainingMessages === 0 && (
          <span className="text-[10px] tabular-nums" style={{ color: '#B91C1C' }}>
            Daily limit reached — offline tools still available
          </span>
        )}
        <span
          className="text-[10px] tabular-nums ml-auto"
          style={{ color: overLimit ? '#B91C1C' : t.textDim }}
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
