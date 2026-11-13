import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ChatFeed } from '../components/ChatFeed';
import { PERSONAS } from '@/personas';
import type { ChatMessage } from '@/types';

const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

/**
 * The wellness tools are gone (Erik's ruling, Nov 12, 2026, superseding Nov 11's
 * move into Real Help): Cold Start, the Breath Pacer, the 5-4-3-2-1 grounding
 * checklist, and the Driveway Reset no longer exist in the app, and Real Help is
 * people only. What must survive the removal is grace for the past: a companion
 * transcript saved yesterday may still hold a [Breathing](tool:breathing) link —
 * it must render, and it must land on Real Help itself.
 */

describe('legacy tool links degrade to Real Help, never to nothing', () => {
  it('a saved reply containing tool:breathing renders its link without error', () => {
    const persona = PERSONAS.find((p) => p.id === 'joseph')!;
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Before anything else, slow down. [Breathing](tool:breathing) — then we talk.',
        timestamp: Date.now(),
      },
    ];
    const html = renderToString(
      createElement(ChatFeed, {
        messages,
        isStreaming: false,
        streamingContent: '',
        persona,
        crisisActive: false,
        onCrisisDismiss: vi.fn(),
        onOpenTool: vi.fn(),
        onReflectGospel: vi.fn(),
      }),
    );
    expect(html).toContain('Breath Pacer');
    expect(html).toContain('slow down');
  });

  it('the app routes all four removed ids to the help tab, opening nothing', () => {
    const app = read('App.tsx');
    for (const id of ['cold-start', 'breathing', 'grounding', 'driveway']) {
      expect(app).toContain(`'${id}': { tab: 'help' }`);
    }
  });
});

describe('no copy still promises the removed tools', () => {
  it('the cap modal sends him to Real Help, not to tools that are gone', () => {
    const app = read('App.tsx');
    expect(app).not.toContain('Open the Tools');
    expect(app).not.toContain('The offline tools');
    expect(app).toContain('Find Real Help');
  });

  it('the chat rate-limit note no longer names an Offline Tool', () => {
    expect(read('components/ChatInput.tsx')).not.toContain('Offline Tool');
  });

  it('the About page no longer lists grounding tools beside real help', () => {
    expect(read('components/AboutSanctumPage.tsx')).not.toContain('grounding tools');
  });

  it('analytics no longer carries the four dead tool ids', () => {
    const analytics = read('lib/analytics.ts');
    for (const id of ["'cold-start'", "'breathing'", "'grounding'", "'driveway'"]) {
      expect(analytics).not.toContain(id);
    }
  });
});
