import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { ScreenName, HistoryItem, DroppedSession, ToolResult } from './types';
import { HomeScreen } from './components/HomeScreen';
import { UsageScreen } from './components/UsageScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScreenLoader } from './components/LoadingStates/ScreenLoader';
import { Toast, showToast } from './components/Toast';
import { DesktopSidebar } from './components/DesktopSidebar';
import { DesktopTopBar } from './components/DesktopTopBar';
import { DesktopSettingsPanel } from './components/DesktopSettingsPanel';

// Lazy load secondary screens for better initial bundle size
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const SettingsDetailScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsDetailScreen })));
const HistoryScreen = lazy(() => import('./components/HistoryScreen').then(m => ({ default: m.HistoryScreen })));

import { useLiveAPI } from './hooks/useLiveAPI';
import { useI18n } from './i18n';
import { useInstructionPresets } from './store/instructionPresetsStore';
import { useSettingsStore } from './store/settingsStore';
import { readSessionApiKey, writeSessionApiKey } from './utils/apiKeyStorage';
import { resolveLiveCredential } from './utils/liveCredential';

const HISTORY_STORAGE_KEY = 'livego_history';
const DROPPED_SESSION_KEY = 'livego_dropped_session';
const ACTIVE_SESSION_KEY = 'livego_active_session';

const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);

  // Get active instruction from presets store
  const { getActiveInstruction } = useInstructionPresets();
  const { useConversationContext } = useSettingsStore();

  // Settings State
  const [voiceName, setVoiceName] = useState<string>('Zephyr');
  // Keep for backwards compatibility but prefer presets
  const [systemInstruction] = useState<string>(() => t('systemInstruction.default'));

  // API keys are scoped to the current browser tab and never bundled at build time.
  const [apiKey, setApiKey] = useState<string>(readSessionApiKey);
  const [needsPersonalKey, setNeedsPersonalKey] = useState(false);

  // Computed: Check if a user-configured API key is available.
  const canStartCall = !needsPersonalKey || Boolean(apiKey);

  // History State - Load from localStorage on mount
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
      return [];
    }
  });

  const startTimeRef = useRef<number>(0);
  const lastDisconnectRef = useRef<number>(0); // Cooldown: timestamp of last unexpected disconnect

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  }, [history]);

  // Listen for toast action (e.g. "add valid API key") — navigate to Account screen
  useEffect(() => {
    const handler = () => handleNavigate(ScreenName.ACCOUNT);
    window.addEventListener('livego:toast_action', handler);
    return () => window.removeEventListener('livego:toast_action', handler);
  }, []);

  // B3: Check for abandoned active session on mount
  useEffect(() => {
    try {
      const activeSession = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (activeSession && !localStorage.getItem(DROPPED_SESSION_KEY)) {
        const session = JSON.parse(activeSession);
        // If there's an active session snapshot but no dropped session flag,
        // it means the app closed/crashed during a session
        if (session.timestamp && (Date.now() - session.timestamp) < 24 * 60 * 60 * 1000) {
          console.log('[App] Found abandoned active session, creating dropped session entry');
          const droppedSession: DroppedSession = {
            dropped: true,
            timestamp: session.timestamp,
            transcript: '',
            toolResults: session.toolResults || [],
            closeCode: 0,
            closeReason: 'App closed during active session',
            pendingGhostResults: [],
            startTime: session.startTime || session.timestamp,
          };
          localStorage.setItem(DROPPED_SESSION_KEY, JSON.stringify(droppedSession));
        }
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch (e) {
      console.warn('[App] Failed to check active session:', e);
    }
  }, []);

  const { connected, isConnecting, connect, disconnect, isMuted, toggleMute, isSpeakerOn, toggleSpeaker, transcript, toolResults, isScreenSharing, toggleScreenShare, getAnalysers } = useLiveAPI();

  // B1: Handle unexpected disconnection — save everything
  const handleUnexpectedDisconnect = useCallback((data: {
    transcript: string;
    toolResults: ToolResult[];
    closeCode: number;
    closeReason: string;
  }) => {
    console.log('[App] Unexpected disconnect! Saving session...', data.closeCode, data.closeReason);
    
    const endTime = Date.now();
    const durationMs = endTime - startTimeRef.current;
    const durationSec = Math.floor(durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Track disconnect time for cooldown
    lastDisconnectRef.current = Date.now();

    // Use transcript from the callback (now contains real data from transcriptRef)
    const currentTranscript = data.transcript || transcript;

    // Don't save dropped session if session lasted less than 5 seconds
    // (sign of immediate 1008 rejection — saving context from these creates a loop)
    const sessionTooShort = durationMs < 5000;
    if (sessionTooShort) {
      console.log('[App] Session lasted <5s — skipping dropped session save to prevent loop');
      // Clean up any existing dropped session to break the loop
      try {
        localStorage.removeItem(DROPPED_SESSION_KEY);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch { /* Storage cleanup is best-effort. */ }
      setCurrentScreen(ScreenName.HOME);
      return;
    }

    // Save to history with dropped flag
    if (currentTranscript.trim().length > 0 || data.toolResults.length > 0) {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(locale),
        duration: durationStr,
        transcript: currentTranscript,
        toolResults: data.toolResults,
        closeReason: 'error',
        closeCode: data.closeCode,
        wasDropped: true,
      };
      setHistory(prev => [newItem, ...prev]);
    }

    // Save dropped session for context injection on reconnect
    const droppedSession: DroppedSession = {
      dropped: true,
      timestamp: Date.now(),
      transcript: currentTranscript,
      toolResults: data.toolResults.slice(0, 3), // Limit to 3 results
      closeCode: data.closeCode,
      closeReason: data.closeReason,
      pendingGhostResults: [],
      startTime: startTimeRef.current,
    };
    try {
      localStorage.setItem(DROPPED_SESSION_KEY, JSON.stringify(droppedSession));
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) {
      console.error('[App] Failed to save dropped session:', e);
    }

    // Navigate to home
    setCurrentScreen(ScreenName.HOME);
  }, [transcript, locale]);

  // Keep the API key only for the lifetime of the current browser tab.
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    writeSessionApiKey(newApiKey);
    if (newApiKey.trim()) setNeedsPersonalKey(false);
  };

  const handleNavigate = (screen: ScreenName) => {
    setCurrentScreen(screen);
  };

  const handleStartCall = async () => {
    const credentialResolution = await resolveLiveCredential(apiKey);
    if (!credentialResolution.credential) {
      setNeedsPersonalKey(true);
      setCurrentScreen(ScreenName.ACCOUNT);
      showToast(
        locale === 'pt-BR'
          ? 'O acesso compartilhado não está disponível agora. Adicione sua chave Gemini para continuar.'
          : 'Shared access is unavailable right now. Add your Gemini key to continue.',
        credentialResolution.reason === 'rate-limited' ? 'warning' : 'info'
      );
      return;
    }

    // Cooldown: wait 3s after last unexpected disconnect
    const timeSinceLastDisconnect = Date.now() - lastDisconnectRef.current;
    if (lastDisconnectRef.current > 0 && timeSinceLastDisconnect < 3000) {
      const waitTime = 3000 - timeSinceLastDisconnect;
      console.log(`[App] Cooldown: waiting ${waitTime}ms before reconnecting...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    startTimeRef.current = Date.now();

    // Get the active instruction from presets (or use fallback)
    const activeInstruction = getActiveInstruction() || systemInstruction;

    // Build context from history if enabled
    let contextWithHistory = activeInstruction;

    // B4: Check for dropped session — inject its context FIRST (most relevant)
    try {
      const droppedRaw = localStorage.getItem(DROPPED_SESSION_KEY);
      if (droppedRaw) {
        const dropped: DroppedSession = JSON.parse(droppedRaw);
        console.log('[App] Restoring context from dropped session...');
        
        let droppedContext = '\n\n[CONTEXTO DA SESSAO ANTERIOR QUE FOI INTERROMPIDA]:\n';
        
        if (dropped.transcript) {
          droppedContext += `Transcricao da conversa anterior:\n${dropped.transcript.substring(0, 2000)}\n\n`;
        }

        if (dropped.toolResults && dropped.toolResults.length > 0) {
          droppedContext += 'Resultados de pesquisas da sessao anterior:\n';
          for (const tr of dropped.toolResults.slice(0, 3)) {
            droppedContext += `- [${tr.toolName}] "${tr.query}": ${tr.answer?.substring(0, 300) || 'sem resposta'}\n`;
          }
          droppedContext += '\n';
        }

        if (dropped.pendingGhostResults && dropped.pendingGhostResults.length > 0) {
          droppedContext += 'Resultados de Ghost Search que chegaram DEPOIS da queda:\n';
          for (const pr of dropped.pendingGhostResults.slice(0, 2)) {
            droppedContext += `- "${pr.query}": ${pr.answer?.substring(0, 300) || 'sem resposta'}\n`;
          }
          droppedContext += '\n';
        }

        droppedContext += 'Continue a conversa naturalmente de onde parou. Nao mencione detalhes tecnicos da queda, apenas retome o assunto.';
        
        contextWithHistory = activeInstruction + droppedContext;

        // Clean up dropped session after injecting
        localStorage.removeItem(DROPPED_SESSION_KEY);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch (e) {
      console.warn('[App] Failed to restore dropped session context:', e);
    }

    // Also add regular history context if enabled and no dropped session was found
    if (useConversationContext && history.length > 0 && !contextWithHistory.includes('[CONTEXTO DA SESSAO ANTERIOR')) {
      const recentHistory = history.slice(0, 3).map(h => h.transcript).join('\n---\n');
      contextWithHistory = `${contextWithHistory}\n\n[Contexto de conversas anteriores]:\n${recentHistory}`;
    }

    await connect({ voiceName, systemInstruction: contextWithHistory, credential: credentialResolution.credential, enableAdvancedFeatures: true, useConversationContext, onUnexpectedDisconnect: handleUnexpectedDisconnect });
  };

  // Watch for connection state to transition screen
  useEffect(() => {
    if (connected && currentScreen === ScreenName.HOME) {
      setCurrentScreen(ScreenName.USAGE);
    }
  }, [connected, currentScreen]);

  const handleEndCall = () => {
    const endTime = Date.now();
    const durationMs = endTime - startTimeRef.current;
    const durationSec = Math.floor(durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (transcript.trim().length > 0 || toolResults.length > 0) {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(locale),
        duration: durationStr,
        transcript: transcript,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
        closeReason: 'manual',
      };
      setHistory(prev => [newItem, ...prev]);
    }

    // Clean up any active session snapshot
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(DROPPED_SESSION_KEY);
    } catch { /* Storage cleanup is best-effort. */ }

    disconnect();
    setCurrentScreen(ScreenName.HOME);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleSettingsChildBack = () => {
    const desktopWorkspace = window.matchMedia('(min-width: 1024px)').matches;
    handleNavigate(desktopWorkspace ? ScreenName.HOME : ScreenName.SETTINGS);
  };

  return (
    <ErrorBoundary>
      <div className="w-full h-dvh-safe md:flex md:justify-center md:items-center md:min-h-screen md:bg-theme-primary lg:block lg:h-dvh lg:min-h-0 lg:bg-[#090a0f] font-sans">
        {/* 
          Responsive Container:
          - Mobile: Full screen, no padding, no border, no radius
          - Desktop (md+): Fixed width/height, rounded corners, black border (phone frame)
        */}
        <div className="w-full h-full md:max-w-[390px] md:h-[844px] lg:flex lg:flex-col lg:max-w-none lg:h-dvh relative overflow-hidden md:rounded-[40px] md:shadow-[0_30px_60px_-10px_var(--shadow-color)] md:border-[8px] md:border-black md:bg-black lg:rounded-none lg:border-0 lg:bg-[#090a0f] lg:shadow-none">

          <DesktopTopBar />

          <div className="flex min-h-0 flex-1">
            <DesktopSidebar
              currentScreen={currentScreen}
              connected={connected}
              onNavigate={handleNavigate}
            />

            {/* Inner Screen Content */}
            <div className="min-w-0 flex-1 h-full bg-theme-secondary overflow-hidden md:rounded-[32px] lg:rounded-none relative">
            {/* Toast notification — inside the phone frame */}
            <Toast />

            {currentScreen === ScreenName.HOME && (
              <HomeScreen
                onStartCall={handleStartCall}
                onSettings={() => handleNavigate(ScreenName.SETTINGS)}
                hasApiKey={canStartCall}
                onConfigureApiKey={() => handleNavigate(ScreenName.ACCOUNT)}
                isConnecting={isConnecting}
              />
            )}

            {currentScreen === ScreenName.USAGE && (
              <UsageScreen
                onEndCall={handleEndCall}
                isMuted={isMuted}
                toggleMute={toggleMute}
                isSpeakerOn={isSpeakerOn}
                toggleSpeaker={toggleSpeaker}
                caption={transcript}
                getAnalysers={getAnalysers}
                isScreenSharing={isScreenSharing}
                toggleScreenShare={toggleScreenShare}
              />
            )}

            {/* Lazy loaded screens with Suspense */}
            <Suspense fallback={<ScreenLoader />}>
              {currentScreen === ScreenName.SETTINGS && (
                <SettingsScreen
                  onBack={() => handleNavigate(connected ? ScreenName.USAGE : ScreenName.HOME)}
                  onNavigate={handleNavigate}
                  currentVoice={voiceName}
                />
              )}

              {currentScreen === ScreenName.HISTORY && (
                <HistoryScreen
                  history={history}
                  onBack={handleSettingsChildBack}
                  onDelete={deleteHistoryItem}
                />
              )}

              {/* Render Sub-screens */}
              {[
                ScreenName.ACCOUNT,
                ScreenName.NOTIFICATIONS,
                ScreenName.PRIVACY,
                ScreenName.HELP,
                ScreenName.ABOUT,
                ScreenName.VOICE,
                ScreenName.INSTRUCTIONS,
                ScreenName.LANGUAGE,
                ScreenName.SKILLS
              ].includes(currentScreen) && (
                  <SettingsDetailScreen
                    screen={currentScreen}
                    onBack={handleSettingsChildBack}
                    voiceName={voiceName}
                    setVoiceName={setVoiceName}
                    apiKey={apiKey}
                    setApiKey={handleApiKeyChange}
                  />
                )}
            </Suspense>
            </div>

            {currentScreen === ScreenName.HOME && !connected && (
              <DesktopSettingsPanel currentVoice={voiceName} onNavigate={handleNavigate} />
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
