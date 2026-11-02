import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { PersonaTheme } from '@/types';
import { fetchDailyAudio, headForHour, type DailyAudio } from '@/lib/dailyAudio';
import { BELL_PERSONA_ID, PERSONA_DISPLAY } from '@/lib/narratorCore';
import { NARRATOR_DISCLOSURE_LINE } from '@/lib/privacyCopy';

const DISCLOSED_KEY = 'sanctum_audio_disclosed';

interface ListenBarProps {
  t: PersonaTheme;
  /** The readings bundle's date — the row fetched is for the Gospel on screen. */
  dateKey: string;
  citation: string | null;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Encodes a mono AudioBuffer as a 16-bit PCM WAV — the stitched single stream (§11.3). */
function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const samples = buffer.getChannelData(0);
  const out = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(out);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

/**
 * The Listen bar in the Daily Gospel card (spec §11). Renders only when the day's
 * audio row is ready; a failed row shows one plain unavailable line; no row shows
 * nothing. Fully fail-silent — it can never block or alter the text experience, and
 * it sends nothing anywhere.
 *
 * Playback (§11.3): the day's files are stitched into one WAV stream behind a single
 * <audio> element (bell first on Martin's Thursdays, then the AM or PM head chosen by
 * the device's own hour, then the main). If Web Audio is unavailable, the files play
 * as a plain sequence instead, without the bell.
 */
export function ListenBar({ t, dateKey, citation }: ListenBarProps) {
  const [audio, setAudio] = useState<DailyAudio | null>(null);
  const [gone, setGone] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(0);

  const elRef = useRef<HTMLAudioElement | null>(null);
  const modeRef = useRef<'stitched' | 'sequence'>('stitched');
  const queueRef = useRef<string[]>([]);
  const queueIndexRef = useRef(0);
  const baseOffsetRef = useRef(0);
  const preparedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const row = await fetchDailyAudio(dateKey);
      if (active) setAudio(row);
    })();
    return () => {
      active = false;
    };
  }, [dateKey]);

  // Tear the player down with the card: stop the stream, release the blob, and let
  // go of the lock-screen controls.
  useEffect(() => {
    return () => {
      try {
        elRef.current?.pause();
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('seekbackward', null);
          navigator.mediaSession.setActionHandler('seekforward', null);
          navigator.mediaSession.setActionHandler('seekto', null);
        }
      } catch {
        // Cleanup never throws into the app.
      }
    };
  }, []);

  if (gone || !audio) return null;

  if (audio.status === 'failed') {
    // Erik's no-fallback rule, on screen: one plain line, nothing else.
    return (
      <p className="text-[10px] mb-3" style={{ color: t.textDim }}>
        Audio is unavailable today.
      </p>
    );
  }

  if (audio.status !== 'ready') return null;

  const display = PERSONA_DISPLAY[audio.persona];

  const element = (): HTMLAudioElement => {
    if (!elRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.addEventListener('timeupdate', () => {
        setElapsed(baseOffsetRef.current + el.currentTime);
      });
      el.addEventListener('ended', () => {
        if (modeRef.current === 'sequence' && queueIndexRef.current < queueRef.current.length - 1) {
          baseOffsetRef.current += el.duration || 0;
          queueIndexRef.current += 1;
          el.src = queueRef.current[queueIndexRef.current];
          void el.play().catch(() => setPlaying(false));
          return;
        }
        setPlaying(false);
      });
      el.addEventListener('error', () => {
        setPlaying(false);
        setGone(true);
      });
      elRef.current = el;
    }
    return elRef.current;
  };

  const setMediaSession = () => {
    try {
      if (!('mediaSession' in navigator)) return;
      const el = element();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: citation ? `Today's Gospel — ${citation}` : "Today's Gospel",
        artist: `Sanctum — ${display.displayName}, AI-voiced narrator`,
        album: 'Sanctum — Daily Gospel',
        artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.setActionHandler('play', () => void el.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => el.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        el.currentTime = Math.max(0, el.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        el.currentTime = Math.min(el.duration || el.currentTime + 10, el.currentTime + 10);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') el.currentTime = details.seekTime;
      });
    } catch {
      // Media Session is a garnish; its absence changes nothing.
    }
  };

  const stitch = async (urls: string[]): Promise<{ url: string; duration: number }> => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio unavailable');
    const ctx = new Ctor();
    try {
      const buffers: AudioBuffer[] = [];
      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('segment fetch failed');
        buffers.push(await ctx.decodeAudioData(await res.arrayBuffer()));
      }
      const length = buffers.reduce((n, b) => n + b.length, 0);
      const joined = ctx.createBuffer(1, length, buffers[0].sampleRate);
      const out = joined.getChannelData(0);
      let offset = 0;
      for (const b of buffers) {
        out.set(b.getChannelData(0), offset);
        offset += b.length;
      }
      return {
        url: URL.createObjectURL(new Blob([encodeWav(joined)], { type: 'audio/wav' })),
        duration: joined.duration,
      };
    } finally {
      void ctx.close().catch(() => {});
    }
  };

  const prepareAndPlay = async () => {
    const el = element();
    // The head is chosen once, at the first tap, by the device's own hour (§11.2),
    // and locked for the session.
    const head = headForHour(new Date().getHours());
    const headUrl = head === 'am' ? audio.headAmUrl : audio.headPmUrl;
    const headSeconds = head === 'am' ? audio.headAmSeconds : audio.headPmSeconds;
    if (!headUrl || !audio.mainUrl) {
      setGone(true);
      return;
    }
    try {
      const withBell = audio.persona === BELL_PERSONA_ID;
      const stitched = await stitch([...(withBell ? [audio.bellUrl] : []), headUrl, audio.mainUrl]);
      modeRef.current = 'stitched';
      blobUrlRef.current = stitched.url;
      el.src = stitched.url;
      setTotal(stitched.duration);
    } catch {
      // Fallback: a plain sequence of the files — the bell is dropped rather than
      // risk a broken sequence (§11.3).
      modeRef.current = 'sequence';
      queueRef.current = [headUrl, audio.mainUrl];
      queueIndexRef.current = 0;
      baseOffsetRef.current = 0;
      el.src = headUrl;
      setTotal((headSeconds ?? 0) + (audio.mainSeconds ?? 0));
    }
    preparedRef.current = true;
    setMediaSession();
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const handlePlayTap = () => {
    const el = elRef.current;
    if (preparedRef.current && el) {
      if (el.paused) {
        void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        el.pause();
        setPlaying(false);
      }
      return;
    }
    // The first tap ever shows the disclosure card before anything plays (§11.6).
    let disclosed = false;
    try {
      disclosed = localStorage.getItem(DISCLOSED_KEY) === '1';
    } catch {
      disclosed = true; // If the flag can't be read, don't trap the man behind the card.
    }
    if (!disclosed) {
      setShowDisclosure(true);
      return;
    }
    void prepareAndPlay();
  };

  const handleListenFromCard = () => {
    try {
      localStorage.setItem(DISCLOSED_KEY, '1');
    } catch {
      // ignore — the card simply returns next time
    }
    setShowDisclosure(false);
    void prepareAndPlay();
  };

  const handleRestart = () => {
    const el = element();
    if (modeRef.current === 'sequence') {
      queueIndexRef.current = 0;
      baseOffsetRef.current = 0;
      el.src = queueRef.current[0];
    } else {
      el.currentTime = 0;
    }
    setElapsed(0);
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  if (showDisclosure) {
    return (
      <div
        className="rounded-xl border p-3.5 mb-3 animate-fade-in"
        style={{ backgroundColor: `${t.border}1F`, borderColor: `${t.border}80` }}
      >
        <p className="text-xs font-bold mb-1" style={{ color: t.textBright }}>
          {audio.persona === 'lector'
            ? "Today's reader is the Lector."
            : `Today's reader is ${display.displayName} — ${display.weekdayName}'s narrator.`}
        </p>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.textMuted }}>
          {NARRATOR_DISCLOSURE_LINE}
        </p>
        <button
          onClick={handleListenFromCard}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98]"
          style={{ backgroundColor: t.accentRgba(0.16), borderColor: t.accent, color: t.accent }}
        >
          <Play className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wide">Listen</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5 mb-3"
      style={{ backgroundColor: `${t.border}1F`, borderColor: `${t.border}80` }}
    >
      <button
        onClick={handlePlayTap}
        aria-label={playing ? 'Pause the reading' : 'Listen to today’s Gospel'}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border transition-all active:scale-95"
        style={{ backgroundColor: t.accentRgba(0.16), borderColor: t.accent, color: t.accent }}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.textBright }}>
          Listen to the Gospel
        </p>
        <p className="text-[10px] truncate" style={{ color: t.textDim }}>
          Read by {display.displayName}
          {total > 0 && ` · ${fmt(elapsed)} / ${fmt(total)}`}
        </p>
      </div>
      {preparedRef.current && (
        <button
          onClick={handleRestart}
          aria-label="Restart the reading"
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 hover:opacity-70"
          style={{ color: t.textDim }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
