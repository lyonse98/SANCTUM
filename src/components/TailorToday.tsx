import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Clapperboard,
  Headphones,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import type { Audience, PersonaTheme } from '@/types';
import {
  TAILOR_FOCUSES,
  TAILOR_STATES,
  type TailorFocus,
  type TailorState,
} from '@/data/tailorBank';
import { tailorOffered } from '@/lib/tailorAccess';
import {
  MEDIA_TYPE_LABELS,
  getOrBuildTailored,
  loadTodaysTailored,
  mediaActionLabel,
  tailorAudioUrl,
  tailorCreditLine,
  type TailorIntake,
  type TailoredDevotional,
} from '@/lib/tailor';

interface TailorTodayProps {
  t: PersonaTheme;
  audience: Audience;
  /** The readings bundle's date — the devotional built is for the Gospel on screen. */
  dateKey: string;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Tailor Today — the personalized devotional (Nov 12, 2026). The free Listen
 * above is the Church's morning, the same for everyone; this is YOUR morning:
 * the same readings, entire and verbatim, one passage chosen for your stated
 * need, the reflection and challenge re-aimed at the morning you described,
 * and the day's narrator reading it. There is no companion lens — companions
 * are text-only and live in their chats (Erik, Nov 12, 2026). The build
 * happens on the server in memory and is never stored there — the result
 * lives on this device only (see lib/tailor).
 */
export function TailorToday({ t, audience, dateKey }: TailorTodayProps) {
  const offered = tailorOffered();

  const [view, setView] = useState<'idle' | 'form' | 'building' | 'done' | 'error'>('idle');
  const [devotional, setDevotional] = useState<TailoredDevotional | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<TailorState>('steady');
  const [focus, setFocus] = useState<TailorFocus>('today');
  const [freeText, setFreeText] = useState('');

  // If today's build already exists on this device, the card offers it back —
  // playing it again never touches the server.
  useEffect(() => {
    let active = true;
    void (async () => {
      const existing = await loadTodaysTailored(dateKey, audience);
      if (active && existing) {
        setDevotional(existing);
        setView('done');
      }
    })();
    return () => {
      active = false;
    };
  }, [dateKey, audience]);

  // ── Playback (a plain single stream — the tailored render is one file) ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!devotional) return;
    const url = tailorAudioUrl(devotional);
    urlRef.current = url;
    const el = new Audio(url);
    audioRef.current = el;
    const onTime = () => setElapsed(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : devotional.audioSeconds);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    setElapsed(0);
    setPlaying(false);
    return () => {
      el.pause();
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
      URL.revokeObjectURL(url);
      if (urlRef.current === url) urlRef.current = null;
    };
  }, [devotional]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const build = async () => {
    const intake: TailorIntake = {
      state,
      focus,
      freeText: freeText.trim(),
    };
    setView('building');
    setError(null);
    try {
      const { devotional: built } = await getOrBuildTailored(dateKey, audience, intake);
      setDevotional(built);
      setView('done');
    } catch {
      // A calm line, here only — the free devotional above is never touched.
      setError('The tailored devotional could not be built just now. Everything above still stands.');
      setView('error');
    }
  };

  if (!offered) return null;

  const selectStyle: React.CSSProperties = {
    backgroundColor: `${t.border}33`,
    borderColor: `${t.border}99`,
    color: t.text,
  };

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: `${t.border}66` }}>
      {view === 'idle' && (
        <button
          onClick={() => setView('form')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
          style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99`, color: t.textMuted }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Tailor today</span>
        </button>
      )}

      {(view === 'form' || view === 'error') && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: t.textDim }}>
              Tailor today
            </p>
            <button
              onClick={() => setView(devotional ? 'done' : 'idle')}
              aria-label="Close"
              className="transition-opacity hover:opacity-70"
              style={{ color: t.textDim }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
            Say how this morning is, and today&rsquo;s devotional is re-aimed at it — the same
            readings, a passage for your need, and the day&rsquo;s narrator reading it for you.
            What you write is never stored; the devotional lives on this device only.
          </p>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              How are you coming in?
            </span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value as TailorState)}
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            >
              {TAILOR_STATES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              What&rsquo;s today about?
            </span>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as TailorFocus)}
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            >
              {TAILOR_FOCUSES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>

          <label className="block mb-2.5">
            <span className="block text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
              In your own words <span className="normal-case tracking-normal font-medium">(optional)</span>
            </span>
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, 200))}
              placeholder="Big review at 2. Feeling behind."
              className="w-full text-xs rounded-lg px-3 py-2.5 border focus:outline-none"
              style={selectStyle}
            />
          </label>

          {view === 'error' && error && (
            <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>{error}</p>
          )}

          <button
            onClick={build}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98]"
            style={{ backgroundColor: t.accentRgba(0.14), borderColor: t.accent, color: t.accent }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wide">Build my devotional</span>
          </button>
        </div>
      )}

      {view === 'building' && (
        <div className="flex items-center justify-center gap-2 py-4" style={{ color: t.textDim }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[11px]">Composing your morning — the readings, a passage for your need, and the narrator&rsquo;s voice…</span>
        </div>
      )}

      {view === 'done' && devotional && (
        <div className="animate-fade-in">
          <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: t.textDim }}>
            Your tailored devotional
          </p>
          <p className="text-[11px] font-medium mb-3" style={{ color: t.accent }}>
            {tailorCreditLine(devotional)}
          </p>

          {/* The play bar — distinct from the free Listen above it. */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-3"
            style={{ backgroundColor: t.accentRgba(0.08), borderColor: t.accentRgba(0.3) }}
          >
            <button
              onClick={togglePlay}
              aria-label={playing ? 'Pause your tailored devotional' : 'Play your tailored devotional'}
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              style={{ backgroundColor: t.accent, color: '#ffffff' }}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${t.border}80` }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: t.accent,
                    width: duration > 0 ? `${Math.min(100, (elapsed / duration) * 100)}%` : '0%',
                  }}
                />
              </div>
              <p className="text-[10px] mt-1" style={{ color: t.textDim }}>
                {fmt(elapsed)} / {fmt(duration || devotional.audioSeconds)}
              </p>
            </div>
            <button
              onClick={restart}
              aria-label="Restart"
              className="transition-opacity hover:opacity-70 flex-shrink-0"
              style={{ color: t.textDim }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  A word for today · {devotional.passage.citation}
                </p>
                <p className="text-xs leading-relaxed italic" style={{ color: t.textMuted }}>
                  {devotional.passage.text}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  Reflect · tailored for you
                </p>
                <p className="text-xs leading-relaxed" style={{ color: t.textMuted }}>{devotional.reflect}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Target className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.accent, opacity: 0.7 }} />
              <div>
                <p className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: t.textDim }}>
                  Challenge · tailored for you
                </p>
                <p className="text-xs leading-relaxed" style={{ color: t.text }}>{devotional.challenge}</p>
              </div>
            </div>
          </div>

          <a
            href={devotional.media.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98] mb-2"
            style={{ backgroundColor: `${t.border}33`, borderColor: `${t.border}99` }}
          >
            {devotional.media.type === 'film' ? (
              <Clapperboard className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.type === 'podcast' ? (
              <Headphones className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : devotional.media.type === 'talk' ? (
              <Mic className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            ) : (
              <Music className="w-4 h-4 flex-shrink-0" style={{ color: t.accent }} />
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-medium truncate" style={{ color: t.text }}>
                {devotional.media.title}
              </span>
              <span className="block text-[10px]" style={{ color: t.textDim }}>
                {MEDIA_TYPE_LABELS[devotional.media.type]} · {devotional.media.creator} · {mediaActionLabel(devotional.media)}
              </span>
            </span>
          </a>

          <button
            onClick={() => setView('form')}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: t.textDim }}
          >
            <RefreshCw className="w-3 h-3" />
            Rebuild for a different morning
          </button>
        </div>
      )}
    </div>
  );
}
