import { useState, useRef, useCallback } from 'react';
import { Send, Loader2, BookOpen, Sparkles } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { streamChat } from '@/lib/llm';

interface CatechismQAProps {
  t: PersonaTheme;
}

interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  'Why do Catholics confess to a priest?',
  'What is the Eucharist?',
  'Why pray to Mary?',
  'What happens after death?',
  'Why baptize babies?',
  'Is the Resurrection historical?',
];

export function CatechismQA({ t }: CatechismQAProps) {
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: QAMessage = { id: Date.now().toString(), role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const apiMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text.trim() },
    ];

    let accumulated = '';
    const assistantId = (Date.now() + 1).toString();

    streamChat(
      apiMessages,
      {
        onToken: (token) => {
          accumulated += token;
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantId);
            if (existing) {
              return prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m);
            }
            return [...prev, { id: assistantId, role: 'assistant', content: accumulated }];
          });
        },
        onDone: () => {
          setIsLoading(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: error }]);
          setIsLoading(false);
          abortRef.current = null;
        },
      },
      abortRef.current?.signal,
      { personaId: 'aquinas' },
    );
  }, [messages, isLoading]);

  const handleSuggested = (q: string) => {
    handleSend(q);
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: t.card, borderColor: `${t.border}66` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: `${t.border}66` }}>
        <BookOpen className="w-4 h-4" style={{ color: t.accent }} />
        <div>
          <h3 className="text-sm font-bold font-display uppercase tracking-wide" style={{ color: t.textBright }}>
            Ask Aquinas
          </h3>
          <p className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
            St. Thomas Aquinas — AI portrayal. Type your question about the faith.
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[50vh] overflow-y-auto chat-scroll px-4 py-3">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border"
              style={{ backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.2) }}
            >
              <Sparkles className="w-6 h-6" style={{ color: t.accent }} />
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: t.textMuted }}>
              Ask anything about the Catholic faith. Great for honest questions, RCIA, or your wife's conversion journey.
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggested(q)}
                  className="w-full text-left px-3 py-2 rounded-lg border transition-all active:scale-[0.98]"
                  style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66` }}
                >
                  <p className="text-xs font-medium" style={{ color: t.text }}>{q}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-lg px-3 py-2.5 border"
                style={
                  msg.role === 'user'
                    ? { backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.2) }
                    : { backgroundColor: `${t.border}40`, borderColor: `${t.border}55` }
                }
              >
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: msg.role === 'user' ? t.accent : t.textDim }}>
                  {msg.role === 'user' ? 'You' : 'St. Thomas'}
                </p>
                <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: msg.role === 'user' ? t.text : t.textMuted }}>
                  {msg.content}
                </p>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: t.accent }} />
                <span className="text-[11px]" style={{ color: t.textDim }}>St. Thomas is considering...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-3 py-3" style={{ borderColor: `${t.border}66` }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask your question..."
            rows={1}
            className="flex-1 text-sm rounded-lg px-3 py-2.5 resize-none border focus:outline-none transition-colors"
            style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}80`, color: t.text }}
            disabled={isLoading}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
            style={{ backgroundColor: t.accent, color: '#ffffff' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] mt-2 text-center" style={{ color: t.textDim }}>
          Answers grounded in the Catechism. Requires connection. Not stored.
        </p>
      </div>
    </div>
  );
}
