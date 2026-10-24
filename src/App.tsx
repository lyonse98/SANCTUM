import { useState, useRef, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  Church,
  HeartHandshake,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { PresetChips } from '@/components/PresetChips';
import { ChatFeed } from '@/components/ChatFeed';
import { ChatInput } from '@/components/ChatInput';
import { HomeScreen } from '@/components/HomeScreen';

// Code-split the tab subtrees a first visit does not need, so the initial bundle
// carries Today + chat and the rest loads on first navigation to its tab.
const CompanionSelect = lazy(() => import('@/components/CompanionSelect').then((m) => ({ default: m.CompanionSelect })));
const PocketChurchPage = lazy(() => import('@/components/PocketChurchPage').then((m) => ({ default: m.PocketChurchPage })));
const WorkshopPage = lazy(() => import('@/components/WorkshopPage').then((m) => ({ default: m.WorkshopPage })));

function TabFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" />
    </div>
  );
}
import { WelcomeBackPrompt } from '@/components/WelcomeBackPrompt';
import { TermsModal, hasAcceptedTerms } from '@/components/TermsModal';
import { TermsPage } from '@/components/TermsPage';
import { CrisisModal } from '@/components/CrisisCard';
import { FindHelpPage } from '@/components/FindHelpPage';
import { AboutSanctumPage } from '@/components/AboutSanctumPage';
import { PersonaIntro } from '@/components/PersonaIntro';
import type { ChurchTab } from '@/components/PocketChurchPage';
import { TabBar } from '@/components/TabBar';
import { EmailReminderModal } from '@/components/EmailReminderModal';
import { ShareInviteModal } from '@/components/ShareInviteModal';
import { FeedbackProvider, useFeedback } from '@/components/FeedbackProvider';
import { streamChat } from '@/lib/llm';
import { detectCrisisLevel } from '@/lib/crisis';
import { track, trackNow, type EventProperty } from '@/lib/analytics';
import { loadHistory, saveHistory, clearHistory, wipeAllSanctumData } from '@/lib/storage';
import { savePersonaId } from '@/lib/personaStorage';
import { getPersona, PERSONAS } from '@/personas';
import { getRemainingMessages, incrementDailyMessageCount, isAtMessageCap, DAILY_MESSAGE_CAP } from '@/lib/messageCap';
import { getCurrentSeason } from '@/data/liturgicalCalendar';
import { getSeasonTheme, getSeasonAccentColor } from '@/lib/seasonTheme';
import type { ChatMessage, Message, PresetChip, Persona, PersonaId, PersonaTheme, TabId, UtilityActions } from '@/types';

const MAX_HISTORY_TURNS = 8;

/**
 * Maps a tool id from a companion's reply to the area of the app that actually holds it.
 * Everything a companion can name must resolve to a real destination — a dead link at a
 * hard moment is worse than no link at all.
 */
const TOOL_ROUTES: Record<string, { tab: TabId; workshopTool?: string; churchTab?: ChurchTab; churchLectio?: boolean }> = {
  'cold-start': { tab: 'workshop', workshopTool: 'cold-start' },
  'breathing': { tab: 'workshop', workshopTool: 'breathing' },
  'grounding': { tab: 'workshop', workshopTool: 'grounding' },
  'driveway': { tab: 'workshop', workshopTool: 'driveway' },
  'examen': { tab: 'workshop', workshopTool: 'examen' },
  'rule': { tab: 'workshop', workshopTool: 'rule' },
  'scripture': { tab: 'church', churchTab: 'prayer' },
  'lectio': { tab: 'church', churchTab: 'prayer', churchLectio: true },
  'rosary': { tab: 'church', churchTab: 'rosary' },
  'confession': { tab: 'church', churchTab: 'confession' },
  'catechism': { tab: 'church', churchTab: 'catechism' },
  'bible-year': { tab: 'today' },
  'help': { tab: 'help' },
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function App() {
  const [theme, setTheme] = useState<PersonaTheme | undefined>(undefined);
  return (
    <FeedbackProvider theme={theme}>
      <AppContent onThemeChange={setTheme} />
    </FeedbackProvider>
  );
}

function AppContent({ onThemeChange }: { onThemeChange: (theme: PersonaTheme | undefined) => void }) {
  const feedback = useFeedback();
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [introActive, setIntroActive] = useState(false);
  const [panicActive, setPanicActive] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(() => hasAcceptedTerms());
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [hardCrisis, setHardCrisis] = useState(false);
  const persona: Persona | null = useMemo(() => (personaId ? getPersona(personaId) : null), [personaId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [incognito, setIncognito] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [shareInviteOpen, setShareInviteOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [remainingMessages, setRemainingMessages] = useState(() => getRemainingMessages());
  const [showCapModal, setShowCapModal] = useState(false);
  const [tab, setTab] = useState<TabId>('today');
  const [haloNonce, setHaloNonce] = useState(0);
  const [churchTab, setChurchTab] = useState<ChurchTab | null>(null);
  const [churchLectio, setChurchLectio] = useState(false);
  const [workshopTool, setWorkshopTool] = useState<string | null>(null);
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(null);
  const [pendingGospelContext, setPendingGospelContext] = useState<string | null>(null);
  const [season] = useState(() => getCurrentSeason());
  const seasonAccent = useMemo(() => getSeasonAccentColor(), []);
  const seasonTheme = useMemo(() => getSeasonTheme(), []);
  // The center tab names the thing worth doing at this hour rather than the generic word "Today".
  const hourOfDay = new Date().getHours();
  const todayLabel = hourOfDay < 12 ? 'Gospel' : hourOfDay < 17 ? 'Prayer' : 'Examen';
  const abortRef = useRef<AbortController | null>(null);

  /** Sends a companion's tool link to the area that actually contains that tool. */
  const openToolLink = useCallback((tool: string) => {
    const route = TOOL_ROUTES[tool];
    if (!route) return;
    if (route.workshopTool) setWorkshopTool(route.workshopTool);
    if (route.churchTab) setChurchTab(route.churchTab);
    setChurchLectio(Boolean(route.churchLectio));
    setTab(route.tab);
    track('tool_open', (route.workshopTool ?? tool) as EventProperty);
  }, []);

  useEffect(() => {
    if (!personaId || incognito) return;
    const stored = loadHistory(personaId);
    setMessages(stored.map((m) => ({ id: genId(), role: m.role, content: m.content, timestamp: Date.now() })));
  }, [personaId, incognito]);

  useEffect(() => {
    // With no companion open the season stands in, so the sheets opened from the permanent row
    // still have a full palette to draw from instead of resolving to nothing.
    const t = persona?.theme ?? seasonTheme;
    const root = document.documentElement;
    root.style.setProperty('--p-bg', t.bg);
    root.style.setProperty('--p-bg-gradient', t.bgGradient);
    root.style.setProperty('--p-card', t.card);
    root.style.setProperty('--p-card-hover', t.cardHover);
    root.style.setProperty('--p-border', t.border);
    root.style.setProperty('--p-border-light', t.borderLight);
    root.style.setProperty('--p-accent', t.accent);
    root.style.setProperty('--p-accent-bright', t.accentBright);
    root.style.setProperty('--p-accent-dark', t.accentDark);
    root.style.setProperty('--p-text', t.text);
    root.style.setProperty('--p-text-bright', t.textBright);
    root.style.setProperty('--p-text-muted', t.textMuted);
    root.style.setProperty('--p-text-dim', t.textDim);
    root.style.setProperty('--p-glow', t.glow);

    if (!persona) return;
    document.body.style.background = t.bgGradient;
    document.body.style.backgroundColor = t.bg;
  }, [persona, seasonTheme]);

  // Keeps the feedback form styled to whichever companion is on screen.
  useEffect(() => {
    onThemeChange(persona?.theme);
  }, [persona, onThemeChange]);

  const persistHistory = useCallback(
    (msgs: ChatMessage[]) => {
      if (!incognito && personaId) {
        const slim: Message[] = msgs.filter((m) => !m.kind).map((m) => ({ role: m.role, content: m.content }));
        saveHistory(personaId, slim);
      }
    },
    [incognito, personaId],
  );

  // One streaming round-trip: appends the assistant's reply to baseMessages and
  // persists. Shared by ordinary sends and gospel reflection so the two can never
  // drift apart in streaming, error, or persistence behavior.
  const streamReply = useCallback(
    (apiMessages: Message[], baseMessages: ChatMessage[], context: { personaId: string; season?: string; distress?: boolean }) => {
      setIsStreaming(true);
      setStreamingContent('');

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = '';

      streamChat(
        apiMessages,
        {
          onToken: (token) => {
            accumulated += token;
            setStreamingContent(accumulated);
          },
          onDone: () => {
            const assistantMsg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              content: accumulated || '(No response received.)',
              timestamp: Date.now(),
            };
            const finalMessages = [...baseMessages, assistantMsg];
            setMessages(finalMessages);
            persistHistory(finalMessages);
            setIsStreaming(false);
            setStreamingContent('');
            abortRef.current = null;
          },
          onError: (error) => {
            const errorMsg: ChatMessage = {
              id: genId(),
              role: 'assistant',
              content: error,
              timestamp: Date.now(),
            };
            const finalMessages = [...baseMessages, errorMsg];
            setMessages(finalMessages);
            persistHistory(finalMessages);
            setIsStreaming(false);
            setStreamingContent('');
            abortRef.current = null;
          },
        },
        controller.signal,
        context,
      );
    },
    [persistHistory],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (isStreaming || !persona) return;

      if (isAtMessageCap()) {
        setShowCapModal(true);
        return;
      }

      const crisisLevel = detectCrisisLevel(text);

      if (crisisLevel === 'hard') {
        const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, timestamp: Date.now() };
        const crisisMsg: ChatMessage = { id: genId(), role: 'assistant', content: '__CRISIS__', timestamp: Date.now() };
        const newMessages = [...messages, userMsg, crisisMsg];
        setMessages(newMessages);
        persistHistory(newMessages);
        setHardCrisis(true);
        return;
      }

      const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, timestamp: Date.now() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);

      const newCount = incrementDailyMessageCount();
      setRemainingMessages(Math.max(0, DAILY_MESSAGE_CAP - newCount));

      const recentMessages = newMessages.filter((m) => !m.kind).slice(-MAX_HISTORY_TURNS);
      const apiMessages: Message[] = recentMessages.map((m) => ({ role: m.role, content: m.content }));

      streamReply(apiMessages, newMessages, {
        personaId: persona.id,
        season: season.name,
        distress: crisisLevel === 'soft',
      });
    },
    [messages, isStreaming, persona, season, streamReply],
  );

  // Reflect on a gospel card. The readings reach the model as context for this one
  // reply — they were never a message the man typed, so nothing renders as one, and
  // reflecting does not consume his daily message allowance.
  const handleGospelReflect = useCallback(
    (cardId: string) => {
      if (isStreaming || !persona) return;
      const card = messages.find((m) => m.id === cardId && m.kind === 'gospel');
      if (!card || card.reflected) return;
      const marked = messages.map((m) => (m.id === cardId ? { ...m, reflected: true } : m));
      setMessages(marked);
      const history: Message[] = marked
        .filter((m) => !m.kind)
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));
      streamReply([...history, { role: 'user', content: card.content }], marked, {
        personaId: persona.id,
        season: season.name,
      });
    },
    [messages, isStreaming, persona, season, streamReply],
  );

  const handleAcceptTerms = useCallback(() => {
    setTermsAccepted(true);
    setShowTerms(false);
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    if (streamingContent) {
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: streamingContent,
        timestamp: Date.now(),
      };
      const finalMessages = [...messages, assistantMsg];
      setMessages(finalMessages);
      persistHistory(finalMessages);
    }
    setIsStreaming(false);
    setStreamingContent('');
    abortRef.current = null;
  }, [streamingContent, messages, persistHistory]);

  const handleClear = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
      setStreamingContent('');
    }
    setMessages([]);
    if (personaId) clearHistory(personaId);
  }, [isStreaming, personaId]);

  const handlePreset = useCallback(
    (chip: PresetChip) => {
      handleSend(chip.prompt);
    },
    [handleSend],
  );

  // The five utilities are handed to each page so they sit at the foot of the screen he is on,
  // rather than in a second bar stacked on top of the tab ribbon.
  const utilities: UtilityActions = useMemo(
    () => ({
      onOpenSettings: () => setSettingsOpen(true),
      onShareInvite: () => setShareInviteOpen(true),
      onOpenFeedback: () => feedback?.openFeedback(tab),
      onOpenAbout: () => setShowAbout(true),
      onOpenReminder: () => setEmailOpen(true),
    }),
    [feedback, tab],
  );

  // Incognito is a separate, memory-only conversation. Turning it on PAUSES the saved
  // thread (untouched on disk); turning it off discards the incognito thread and the
  // history effect restores the saved one. It never deletes saved history.
  const handleToggleIncognito = useCallback(() => {
    setIncognito((prev) => {
      const next = !prev;
      if (next) setMessages([]);
      return next;
    });
  }, []);

  const handleSelectPersona = useCallback((p: Persona, initialMessage?: string) => {
    if (incognito) setMessages([]);
    setPersonaId(p.id);
    savePersonaId(p.id);
    setIntroActive(true);
    track('companion_selected', p.id as EventProperty);
    if (initialMessage) {
      setPendingInitialMessage(initialMessage);
    }
  }, [incognito]);

  const handleSwitchPersona = useCallback(() => {
    setPersonaId(null);
    setMessages([]);
    setTab('companions');
  }, []);

  const handleChangeTab = useCallback((next: TabId) => {
    // Switching areas leaves the conversation, but the transcript is kept on the device.
    if (next !== 'companions' && personaId) {
      setPersonaId(null);
      setMessages([]);
    }
    // Re-fires the halo each time he comes back to Today, and only then.
    if (next === 'today') setHaloNonce((n) => n + 1);
    setTab(next);
    track('tab_view', next);
  }, [personaId]);

  const handlePanic = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    wipeAllSanctumData();
    setRemainingMessages(getRemainingMessages());
    setMessages([]);
    setPersonaId(null);
    setIncognito(false);
    setIsStreaming(false);
    setStreamingContent('');
    setPanicActive(true);
  }, [isStreaming]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#EFEAE2');
  }, []);

  // Fire the first funnel event once, after terms are accepted.
  useEffect(() => {
    if (termsAccepted) trackNow('app_open', 'today');
  }, [termsAccepted]);

  if (!termsAccepted) {
    return <TermsModal onAccept={handleAcceptTerms} />;
  }

  if (hardCrisis && persona) {
    return <CrisisModal theme={persona.theme} onFindHelp={() => { setHardCrisis(false); setTab('help'); }} />;
  }

  if (panicActive) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#EFEAE2' }}>
        <p className="text-sm text-center mb-2" style={{ color: '#635C51' }}>
          All data cleared. You are safe.
        </p>
        <button
          onClick={() => { setPanicActive(false); setTermsAccepted(hasAcceptedTerms()); }}
          className="px-6 py-2.5 rounded-lg text-sm font-medium border transition-all"
          style={{ backgroundColor: '#FBF8F3', borderColor: '#DCD3C5', color: '#3A352E' }}
        >
          Return to Sanctum
        </button>
      </div>
    );
  }

  if (!persona) {
    // The tab area, with the conversation closed. The tab bar is present on every one of
    // these screens, so the whole app is reachable in a single tap from anywhere.
    const areaTheme = seasonTheme;
    let content: JSX.Element;
    if (tab === 'companions') {
      content = (
        <CompanionSelect
          onSelect={(p) => {
            handleSelectPersona(p);
          }}
          onBack={() => setTab('today')}
          utilities={utilities}
          theme={areaTheme}
        />
      );
    } else if (tab === 'church') {
      content = (
        <PocketChurchPage
          onBack={() => setTab('today')}
          initialTab={churchTab}
          onConsumeTab={() => setChurchTab(null)}
          utilities={utilities}
          onReflectWithCompanion={(message) => {
            setPendingGospelContext(message);
            setTab('companions');
          }}
          autoOpenLectio={churchLectio}
          onConsumeLectio={() => setChurchLectio(false)}
          seasonTheme={areaTheme}
        />
      );
    } else if (tab === 'workshop') {
      content = (
        <WorkshopPage
          persona={PERSONAS[0]}
          onBack={() => setTab('today')}
          initialTool={workshopTool}
          onConsumeTool={() => setWorkshopTool(null)}
          utilities={utilities}
          seasonTheme={areaTheme}
        />
      );
    } else if (tab === 'help') {
      content = (
        <FindHelpPage
          t={areaTheme}
          accent={seasonAccent}
          onBack={() => setTab('today')}
          utilities={utilities}
        />
      );
    } else {
      content = (
        <>
          <WelcomeBackPrompt
            onOpenCompanions={() => setTab('companions')}
            onOpenWorkshop={() => setTab('workshop')}
          />
          <HomeScreen
            onReflectWithCompanion={(message) => {
              setPendingGospelContext(message);
              setTab('companions');
            }}
            onOpenExamen={() => { setWorkshopTool('examen'); setTab('workshop'); }}
            utilities={utilities}
          />
        </>
      );
    }

    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: areaTheme.bg }}>
        <div className="relative flex-1 overflow-hidden"><Suspense fallback={<TabFallback />}>{content}</Suspense></div>

        <TabBar
          active={tab}
          onChange={handleChangeTab}
          accent={seasonAccent}
          cardColor={areaTheme.card}
          borderColor={areaTheme.border}
          textDim={areaTheme.textDim}
          todayLabel={todayLabel}
          haloKey={haloNonce}
        />
        {showAbout && (
          <AboutSanctumPage t={areaTheme} accent={seasonAccent} onClose={() => setShowAbout(false)} />
        )}
        {showTerms && (
          <TermsPage t={areaTheme} accent={seasonAccent} onClose={() => setShowTerms(false)} />
        )}

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onOpenTerms={() => { setSettingsOpen(false); setShowTerms(true); }}
        />
        <ShareInviteModal
          open={shareInviteOpen}
          t={areaTheme}
          onClose={() => setShareInviteOpen(false)}
        />
        <EmailReminderModal open={emailOpen} t={areaTheme} onClose={() => setEmailOpen(false)} />
      </div>
    );
  }
  if (introActive && persona) {
    return <PersonaIntro persona={persona} onDone={() => {
      setIntroActive(false);
      if (pendingInitialMessage) {
        const msg = pendingInitialMessage;
        setPendingInitialMessage(null);
        setTimeout(() => handleSend(msg), 100);
      } else if (pendingGospelContext) {
        const context = pendingGospelContext;
        setPendingGospelContext(null);
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: genId(), role: 'user', kind: 'gospel', content: context, timestamp: Date.now() },
          ]);
        }, 50);
      }
    }} />;
  }

  const t = persona.theme;
  const WatermarkIcon = Church;

  return (
    <div
      className="flex flex-col h-dvh max-w-2xl mx-auto relative overflow-hidden"
      style={{ backgroundColor: t.bg, paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
        style={{ opacity: 0.04 }}
      >
        <WatermarkIcon
          className="w-[60vw] h-[60vw] max-w-[420px] max-h-[420px]"
          strokeWidth={0.5}
          style={{ color: seasonAccent }}
        />
      </div>

      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${seasonAccent}30 0%, transparent 70%)` }}
      />
      <Header
        persona={persona}
        onSwitchPersona={handleSwitchPersona}
        onSelectPersona={handleSelectPersona}
        incognito={incognito}
        onToggleIncognito={handleToggleIncognito}
        onClear={handleClear}
        onOpenSettings={() => setSettingsOpen(true)}
        onPanic={handlePanic}
        onGoHome={() => handleChangeTab('today')}
      />

      {incognito && (
        <div
          className="px-4 py-1.5 border-b"
          style={{ backgroundColor: t.accentRgba(0.05), borderColor: t.border }}
        >
          <p className="text-[11px] text-center" style={{ color: t.textDim }}>
            Incognito mode — this conversation is not saved. Your saved conversation is paused, untouched.
          </p>
        </div>
      )}

      <div className="px-4 py-1.5 flex items-center justify-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest"
          style={{
            backgroundColor: `${season.accentColor}15`,
            borderColor: `${season.accentColor}40`,
            color: season.accentColor,
          }}
        >
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: season.accentColor }} />
          {season.name}
        </span>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: t.accentRgba(0.06), borderColor: t.accentRgba(0.2), color: t.textDim }}
        >
          Not Stored · Sent to AI for Reply
        </span>
      </div>

      <PresetChips presets={persona.presets} onSelect={handlePreset} disabled={isStreaming} />

      <ChatFeed messages={messages} isStreaming={isStreaming} streamingContent={streamingContent} persona={persona} crisisActive={false} onOpenTool={openToolLink} onReflectGospel={handleGospelReflect} />

      <ChatInput onSend={handleSend} onStop={handleStop} isStreaming={isStreaming} persona={persona} remainingMessages={remainingMessages} />

      <div
        className="px-4 py-2 border-t text-center"
        style={{ borderColor: `${t.border}4D`, backgroundColor: `${t.bg}80`, paddingBottom: 'calc(env(safe-area-inset-bottom) + 30px)' }}
      >
        <p className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
          Sanctum — a spiritual companion, not a licensed therapist. In crisis? Call or text 988 (US).{' '}
          <button onClick={() => setShowTerms(true)} className="underline decoration-dotted hover:opacity-70 transition-opacity" style={{ color: t.textDim }}>
            Terms &amp; Privacy
          </button>
        </p>
        <button
          onClick={() => handleChangeTab('help')}
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mt-1.5 transition-opacity hover:opacity-70"
          style={{ color: t.accent }}
        >
          <HeartHandshake className="w-3 h-3" />
          Find a priest, director, or therapist
        </button>
        <button
          onClick={() => feedback?.openFeedback('chat')}
          className="text-[10px] underline decoration-dotted hover:opacity-70 transition-opacity mt-1 inline-block"
          style={{ color: t.textDim }}
        >
          Send Feedback
        </button>
        <span className="text-[10px] mx-1.5" style={{ color: t.textDim }}>·</span>
        <button
          onClick={() => setShowAbout(true)}
          className="text-[10px] underline decoration-dotted hover:opacity-70 transition-opacity mt-1 inline-block"
          style={{ color: t.textDim }}
        >
          About Sanctum
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenTerms={() => { setSettingsOpen(false); setShowTerms(true); }}
      />

      {showCapModal && (
        <MessageCapModal
          t={t}
          onClose={() => setShowCapModal(false)}
          onOpenWorkshop={() => { setShowCapModal(false); handleChangeTab('workshop'); }}
        />
      )}

      {showAbout && (
        <AboutSanctumPage t={t} accent={seasonAccent} onClose={() => setShowAbout(false)} />
      )}
      {showTerms && (
        <TermsPage t={t} accent={seasonAccent} onClose={() => setShowTerms(false)} />
      )}

      <EmailReminderModal open={emailOpen} t={t} onClose={() => setEmailOpen(false)} />

      <TabBar
        active="companions"
        onChange={handleChangeTab}
        accent={seasonAccent}
        cardColor={t.card}
        borderColor={t.border}
        textDim={t.textDim}
        todayLabel={todayLabel}
        haloKey={haloNonce}
      />
    </div>
  );
}

export default App;

function MessageCapModal({ t, onClose, onOpenWorkshop }: { t: Persona['theme']; onClose: () => void; onOpenWorkshop: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border p-6 text-center animate-slide-up"
        style={{ backgroundColor: t.bg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border"
          style={{ backgroundColor: t.accentRgba(0.12), borderColor: t.accentRgba(0.4) }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.accent }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <h2 className="text-sm font-bold font-display uppercase tracking-wide mb-2" style={{ color: t.textBright }}>
          Daily Limit Reached
        </h2>
        <p className="text-xs leading-relaxed mb-4" style={{ color: t.textDim }}>
          You've used all {DAILY_MESSAGE_CAP} of your daily conversations with this companion. The limit resets at midnight.
        </p>
        <p className="text-xs leading-relaxed mb-5" style={{ color: t.textMuted }}>
          The offline tools — grounding, examen, prayers, and the catechism — are always available, with no limits.
        </p>
        <button
          onClick={onOpenWorkshop}
          className="w-full py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 mb-2"
          style={{ backgroundColor: t.accentRgba(0.15), borderColor: t.accentRgba(0.4), color: t.accent }}
        >
          Open the Workshop
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg text-xs font-medium transition-all active:scale-95"
          style={{ color: t.textDim }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
