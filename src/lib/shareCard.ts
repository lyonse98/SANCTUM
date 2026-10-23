import type { PersonaTheme } from '@/types';

export type CardStyle = 'parchment' | 'scripture' | 'ember' | 'portrait' | 'minimal';

export const STYLE_LABELS: Record<CardStyle, string> = {
  parchment: 'Parchment',
  scripture: 'Scripture',
  ember: 'Ember',
  portrait: 'Portrait',
  minimal: 'Minimal',
};

export const CARD_WIDTH = 1080;

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

interface BackdropOptions {
  portraitImg?: HTMLImageElement | null;
  portraitHeight?: number;
}

/** Paints the full card backdrop for a style, including an optional portrait banner. */
export function paintCardBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: PersonaTheme,
  style: CardStyle,
  options: BackdropOptions = {},
): void {
  const { portraitImg = null, portraitHeight = 0 } = options;

  if (style === 'parchment') {
    ctx.fillStyle = '#1E1B19';
    ctx.fillRect(0, 0, width, height);
    const grad = ctx.createRadialGradient(width * 0.5, 200, 0, width * 0.5, 200, width * 0.7);
    grad.addColorStop(0, t.accentRgba(0.08));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = `${t.border}15`;
    ctx.lineWidth = 1;
    for (let i = 0; i < height; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }
    return;
  }

  if (style === 'scripture') {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);
    const grad = ctx.createRadialGradient(width * 0.5, 150, 0, width * 0.5, 150, width * 0.6);
    grad.addColorStop(0, t.accentRgba(0.1));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.strokeStyle = `${t.accent}44`;
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 50, width - 100, height - 100);
    return;
  }

  if (style === 'ember') {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, t.accentRgba(0.12));
    grad.addColorStop(0.4, t.accentRgba(0.03));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, 0, width, 6);
    return;
  }

  if (style === 'portrait') {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);
    if (portraitImg && portraitHeight > 0) {
      const imgRatio = portraitImg.width / portraitImg.height;
      const targetRatio = width / portraitHeight;
      let sx = 0;
      let sy = 0;
      let sw = portraitImg.width;
      let sh = portraitImg.height;
      if (imgRatio > targetRatio) {
        sw = portraitImg.height * targetRatio;
        sx = (portraitImg.width - sw) / 2;
      } else {
        sh = portraitImg.width / targetRatio;
        sy = (portraitImg.height - sh) / 2;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, portraitHeight);
      ctx.clip();
      ctx.drawImage(portraitImg, sx, sy, sw, sh, 0, 0, width, portraitHeight);
      ctx.restore();
      const fade = ctx.createLinearGradient(0, portraitHeight - 120, 0, portraitHeight);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, t.bg);
      ctx.fillStyle = fade;
      ctx.fillRect(0, portraitHeight - 120, width, 120);
    }
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, 0, width, 4);
    return;
  }

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);
}

/** Small centred divider rule used between card sections. */
export function drawRule(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2, y);
  ctx.lineTo(centerX + width / 2, y);
  ctx.stroke();
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function shareDataUrl(
  dataUrl: string,
  filename: string,
  title: string,
  text: string,
): Promise<void> {
  if (!dataUrl) return;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return;
    }
    downloadDataUrl(dataUrl, filename);
  } catch {
    downloadDataUrl(dataUrl, filename);
  }
}

export function cardFilename(slug: string): string {
  return `${slug.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}-sanctum.png`;
}
