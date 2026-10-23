import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CARD_WIDTH,
  STYLE_LABELS,
  cardFilename,
  downloadDataUrl,
  paintCardBackdrop,
  shareDataUrl,
  wrapText,
  type CardStyle,
} from '@/lib/shareCard';
import type { Persona } from '@/types';

interface ShareCardModalProps {
  open: boolean;
  content: string;
  persona: Persona;
  onClose: () => void;
}

// ─── Quote Extraction ──────────────────────────────────────

interface QuoteCandidate {
  text: string;
  type: 'scripture' | 'quote' | 'counsel';
  ref?: string;
}

function extractCandidates(raw: string): QuoteCandidate[] {
  const clean = raw
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*>\s*/gm, '');

  const candidates: QuoteCandidate[] = [];

  // 1. Extract Scripture references — quoted text followed by a reference like "— John 3:16"
  const scriptureRe = /[""]([^""]{20,400})[""]\s*(?:—|–|-)\s*([A-Z][a-z]+(?:\s+\d+)?:?\s*\d+:\d+(?:[-–]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = scriptureRe.exec(clean)) !== null) {
    candidates.push({ text: m[1].trim(), type: 'scripture', ref: m[2].trim() });
  }

  // 2. Extract any quoted text (saint quotes, etc.)
  const quoteRe = /[""]([^""]{30,500})[""]/g;
  while ((m = quoteRe.exec(clean)) !== null) {
    const text = m[1].trim();
    if (!candidates.some((c) => c.text === text)) {
      candidates.push({ text, type: 'quote' });
    }
  }

  // 3. Extract the Reality Check section as counsel
  const sectionMatch = clean.match(
    /(?:THE\s+REALITY\s+CHECK|REALITY\s+CHECK)[:\s]*\n([\s\S]*?)(?=\n\s*(?:THE\s+5-MINUTE|5-MINUTE\s+ACTION|THE\s+FIELD|FIELD\s+MEDIA|FIELD\s+RESOURCE|\n\s*\d+\.\s*(?:THE\s+5-MINUTE|THE\s+FIELD))|$)/i,
  );
  if (sectionMatch) {
    let counsel = sectionMatch[1].replace(/^\d+\.\s*/, '').trim();
    // Split into sentences and pick the most striking (longest substantive one)
    const sentences = counsel.match(/[^.!?]+[.!?]+/g);
    if (sentences) {
      // Pick the first 2-3 sentences that form a coherent thought, up to 280 chars
      let best = '';
      for (const s of sentences) {
        const candidate = (best + ' ' + s).trim();
        if (candidate.length > 280) break;
        best = candidate;
      }
      if (best) {
        best = best.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        candidates.push({ text: best, type: 'counsel' });
      }
    } else if (counsel.length > 20) {
      counsel = counsel.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (counsel.length > 280) {
        const cut = counsel.slice(0, 280);
        const lastPeriod = cut.lastIndexOf('.');
        counsel = lastPeriod > 180 ? cut.slice(0, lastPeriod + 1) : cut.trimEnd() + '\u2026';
      }
      candidates.push({ text: counsel, type: 'counsel' });
    }
  }

  // 4. If nothing extracted, take the first substantive paragraph
  if (candidates.length === 0) {
    const paragraphs = clean.split(/\n\n+/).filter((p) => p.trim().length > 30);
    if (paragraphs.length > 0) {
      let fallback = paragraphs[0].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      if (fallback.length > 280) {
        const cut = fallback.slice(0, 280);
        const lastPeriod = cut.lastIndexOf('.');
        fallback = lastPeriod > 180 ? cut.slice(0, lastPeriod + 1) : cut.trimEnd() + '\u2026';
      }
      candidates.push({ text: fallback, type: 'counsel' });
    }
  }

  return candidates;
}

// ─── Canvas Drawing ─────────────────────────────────────────

function drawCard(
  canvas: HTMLCanvasElement,
  quote: QuoteCandidate,
  persona: Persona,
  style: CardStyle,
  portraitImg?: HTMLImageElement | null,
): string {
  const W = CARD_WIDTH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const t = persona.theme;
  const isScripture = quote.type === 'scripture';
  const isQuote = quote.type === 'quote';

  // Font size based on text length
  const textLen = quote.text.length;
  const fontSize = textLen > 400 ? 30 : textLen > 200 ? 36 : 42;
  ctx.font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
  const lines = wrapText(ctx, quote.text, W - 200);
  const lineHeight = Math.round(fontSize * 1.4);
  const portraitHeight = style === 'portrait' && portraitImg ? 360 : 0;
  const startY = 260 + portraitHeight;
  const textHeight = lines.length * lineHeight;
  const refHeight = isScripture && quote.ref ? 60 : 0;
  const dynamicH = Math.max(1080, textHeight + startY + refHeight + 220);

  canvas.width = W;
  canvas.height = dynamicH;

  paintCardBackdrop(ctx, W, dynamicH, t, style, { portraitImg, portraitHeight });

  // ── Top section ──
  const topY = 130 + portraitHeight;

  if (style === 'scripture' || style === 'ember') {
    // Accent bar above persona name
    ctx.fillStyle = t.accent;
    ctx.fillRect(W / 2 - 30, topY - 30, 60, 3);
  }

  // Persona name
  ctx.fillStyle = t.accent;
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(persona.name.toUpperCase(), W / 2, topY);

  // Title
  ctx.fillStyle = t.textDim;
  ctx.font = '400 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(persona.title, W / 2, topY + 32);

  // Divider
  ctx.strokeStyle = style === 'scripture' ? `${t.accent}66` : t.borderLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, topY + 60);
  ctx.lineTo(W / 2 + 60, topY + 60);
  ctx.stroke();

  // ── Quote marks for scripture/quote types ──
  let quoteStartY = startY;
  if (isScripture || isQuote) {
    ctx.fillStyle = t.accentRgba(0.15);
    ctx.font = `400 120px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', 70, startY - 10);
    quoteStartY = startY + 10;
  }

  // ── Main text ──
  ctx.fillStyle = t.textBright;
  ctx.font = `400 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, quoteStartY + i * lineHeight);
  });

  // ── Scripture reference ──
  if (isScripture && quote.ref) {
    ctx.fillStyle = t.accent;
    ctx.font = 'italic 600 24px Georgia, serif';
    ctx.fillText(`\u2014 ${quote.ref}`, W / 2, quoteStartY + lines.length * lineHeight + 40);
  }

  // ── Bottom section ──
  const bottomY = dynamicH - 140;

  ctx.strokeStyle = style === 'scripture' ? `${t.accent}44` : t.borderLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, bottomY);
  ctx.lineTo(W / 2 + 60, bottomY);
  ctx.stroke();

  // Tagline
  ctx.fillStyle = t.textMuted;
  ctx.font = 'italic 400 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`"${persona.tagline}"`, W / 2, bottomY + 45);

  // Sanctum watermark
  ctx.fillStyle = t.textDim;
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SANCTUM', W - 70, bottomY + 45);

  // Small cross/dot accent on left
  ctx.textAlign = 'left';
  ctx.fillStyle = t.accent;
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('\u2719', 70, bottomY + 45);

  return canvas.toDataURL('image/png');
}

// ─── Component ─────────────────────────────────────────────

export function ShareCardModal({ open, content, persona, onClose }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [style, setStyle] = useState<CardStyle>('portrait');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [portraitImg, setPortraitImg] = useState<HTMLImageElement | null>(null);
  const t = persona.theme;

  const candidates = useMemo(() => extractCandidates(content), [content]);

  const currentQuote = useMemo(
    () => candidates[selectedIdx] ?? candidates[0] ?? { text: content.slice(0, 280), type: 'counsel' as const },
    [candidates, selectedIdx, content],
  );

  // Load portrait image when persona changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setPortraitImg(img);
    img.onerror = () => setPortraitImg(null);
    img.src = persona.portrait;
  }, [persona]);

  const drawCardCallback = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = drawCard(canvas, currentQuote, persona, style, portraitImg);
    if (url) setDataUrl(url);
  }, [currentQuote, persona, style, portraitImg]);

  useEffect(() => {
    if (open) drawCardCallback();
  }, [open, drawCardCallback]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Reset selection when content changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [content]);

  if (!open) return null;

  const filename = cardFilename(persona.name);

  const handleDownload = () => downloadDataUrl(dataUrl, filename);

  const handleShare = () =>
    void shareDataUrl(
      dataUrl,
      filename,
      `${persona.name} — Sanctum`,
      currentQuote.type === 'scripture' && currentQuote.ref
        ? `"${currentQuote.text}" — ${currentQuote.ref}`
        : `${persona.name} on Sanctum`,
    );

  const prevQuote = () => setSelectedIdx((i) => (i - 1 + candidates.length) % candidates.length);
  const nextQuote = () => setSelectedIdx((i) => (i + 1) % candidates.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl border max-w-md w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: t.card, borderColor: t.borderLight }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ backgroundColor: t.card, borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4" style={{ color: t.accent }} />
            <h3 className="text-sm font-semibold" style={{ color: t.textBright }}>
              Share this moment
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Card preview */}
          <canvas ref={canvasRef} className="w-full rounded-lg" style={{ display: 'block' }} />

          {/* Quote selector */}
          {candidates.length > 1 && (
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={prevQuote}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textMuted }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    title={c.type}
                    className="rounded-full transition-all"
                    style={{
                      width: i === selectedIdx ? 24 : 8,
                      height: 8,
                      backgroundColor: i === selectedIdx ? t.accent : `${t.borderLight}66`,
                    }}
                  />
                ))}
              </div>
              <button
                onClick={nextQuote}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ backgroundColor: `${t.border}40`, borderColor: `${t.border}66`, color: t.textMuted }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quote type badge */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {currentQuote.type === 'scripture' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}>
                Scripture
              </span>
            )}
            {currentQuote.type === 'quote' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}>
                Quote
              </span>
            )}
            {currentQuote.type === 'counsel' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: t.accentRgba(0.12), color: t.accent }}>
                Counsel
              </span>
            )}
            <span className="text-[10px]" style={{ color: t.textDim }}>
              {selectedIdx + 1} of {candidates.length}
            </span>
          </div>

          {/* Style selector */}
          <div className="flex gap-1.5 mt-3">
            {(Object.keys(STYLE_LABELS) as CardStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border"
                style={
                  style === s
                    ? { backgroundColor: t.accentRgba(0.12), color: t.accent, borderColor: t.accentRgba(0.3) }
                    : { backgroundColor: `${t.border}40`, color: t.textDim, borderColor: `${t.border}66` }
                }
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>

          <p className="text-[11px] mt-3 text-center leading-relaxed" style={{ color: t.textDim }}>
            Only the saint's name and their words are shared. Your conversation stays private.
          </p>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium border transition-colors"
              style={{ backgroundColor: t.cardHover, borderColor: t.borderLight, color: t.text }}
            >
              <Download className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-opacity"
              style={{ backgroundColor: t.accent, color: '#fff' }}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
