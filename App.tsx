import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { ScreenName, HistoryItem, DroppedSession, ToolResult } from './types';
import { HomeScreen } from './components/HomeScreen';
import { UsageScreen } from './components/UsageScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkeletonLoader } from './components/LoadingStates/SkeletonLoader';
import { Toast } from './components/Toast';

// Lazy load secondary screens for better initial bundle size
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const SettingsDetailScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsDetailScreen })));
const HistoryScreen = lazy(() => import('./components/HistoryScreen').then(m => ({ default: m.HistoryScreen })));

// Hooks para arquitetura texto->texto
import { useChatAPI } from './hooks/useChatAPI';
import { useSpeechRecognition, SPEECH_READY_EVENT } from './hooks/useSpeechRecognition';
import { useI18n } from './i18n';
import { useInstructionPresets } from './store/instructionPresetsStore';
import { useSettingsStore } from './store/settingsStore';
import { speakChunked, stopSpeaking, isPlaying, audioManager } from './utils/inworldTTS';
import { useVoiceActivityDetection } from './hooks/useVoiceActivityDetection';

const HISTORY_STORAGE_KEY = 'livego_history';
const API_KEY_STORAGE_KEY = 'gemini_api_key';
const DROPPED_SESSION_KEY = 'livego_dropped_session';
const ACTIVE_SESSION_KEY = 'livego_active_session';

const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);

  // Get active instruction from presets store
  const { getActiveInstruction } = useInstructionPresets();
  const { useConversationContext, ttsSecretKey, ttsVoiceId, ttsModel } = useSettingsStore();

  // Settings State
  const [voiceName, setVoiceName] = useState<string>('Zephyr');
  // Keep for backwards compatibility but prefer presets
  const [systemInstruction, setSystemInstruction] = useState<string>(() => t('systemInstruction.default'));

  // API Key State - Load from localStorage on mount
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    } catch (error) {
      console.error('Failed to load API key from localStorage:', error);
      return '';
    }
  });

  // Computed: Check if API key is available (user-configured or environment)
  const hasApiKey = Boolean(apiKey || process.env.API_KEY);

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
  const lastDisconnectRef = useRef<number>(0);

  // Estado de call ativa
  const [isInCall, setIsInCall] = useState(false);
  // isProcessing é usado para UI feedback durante processamento de mensagem
  const [, setIsProcessing] = useState(false);

  // B4: Dropped session state (used for context injection on reconnect)
  const [/* sessionDropped */, setSessionDropped] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DROPPED_SESSION_KEY);
    } catch { return false; }
  });

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
          setSessionDropped(true);
        }
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch (e) {
      console.warn('[App] Failed to check active session:', e);
    }
  }, []);

  // ================== HOOKS DE COMUNICAÇÃO ==================
  // Hook de Chat (Gemini texto — sem TTS)
  const { connected, isProcessing: chatProcessing, transcript, toolResults, sendMessage, disconnect: disconnectChat, connect: connectChat } = useChatAPI();
  
  // Hook de STT (Web Speech API — com pause/resume)
  const { isListening, startListening, stopListening, pauseListening, resumeListening, resetTranscript } = useSpeechRecognition();
  
  // Refs para controle do fluxo STT → LLM → TTS
  const isProcessingRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const isMutedRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lastBotResponseRef = useRef(''); // Para filtrar eco do STT

  // Speaker state
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // VAD adaptativo para interrupt automático por voz durante TTS
  // Callback direto — sem React state, sem useEffect, sem stale closure
  // minSpeechDuration: 100ms — sensível o suficiente para gaps entre chunks
  const handleVADInterrupt = useCallback(() => {
    if (!isPlaying()) return;
    if (isMutedRef.current) return;

    console.log('[App] VAD interrupt! Voz detectada durante TTS — parando TTS');
    stopSpeaking();
    isProcessingRef.current = false;
    setIsProcessing(false);
    resetTranscript();
    // STT já está ativo (não pausamos mais), só resetar transcript
  }, [resetTranscript]);

  const { startVAD, stopVAD } = useVoiceActivityDetection({
    thresholdMultiplier: 3.0,
    minSpeechDurationMs: 100,  // 100ms — sensível para gaps entre chunks
    warmupMs: 3000,
    onVoiceDetected: handleVADInterrupt,
    onVoiceStart: () => {
      // Ducking suave: reduz volume do TTS quando usuário começa a falar
      if (isPlaying()) {
        audioManager.duckVolume(0.35, 0.3); // 35% volume em 300ms — transição natural
      }
    },
    onVoiceEnd: () => {
      // Restore suave: volta volume do TTS quando usuário para de falar
      audioManager.restoreVolume(0.5); // 100% em 500ms
    },
  });

  // Sync speaker ref
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);

  // Ouvir eventos de fala pronta do STT e enviar para o Gemini
  // NOVA ABORDAGEM: STT SEMPRE ATIVO (confiando no AEC para filtrar eco do TTS)
  // Se TTS está tocando e STT detecta fala → é interrupt (para TTS e processa)
  // Se TTS não está tocando → fluxo normal
  useEffect(() => {
    const handleSpeechReady = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const speechText = detail?.transcript;
      
      // Guards básicos
      if (!speechText || !connected || isMutedRef.current) return;
      
      // Se TTS está tocando → verificar se é eco do TTS ou fala real do usuário
      if (isPlaying()) {
        const lastResponse = lastBotResponseRef.current.toLowerCase();
        const speechLower = speechText.toLowerCase();
        
        if (lastResponse) {
          // Filtro de eco agressivo: palavras com >2 chars, split por espaço e pontuação
          const speechWords: string[] = speechLower.split(/[\s,.!?;:]+/).filter((w: string) => w.length > 2);
          const botWords = new Set<string>(lastResponse.split(/[\s,.!?;:]+/).filter((w: string) => w.length > 2));
          const matchCount = speechWords.filter((w: string) => botWords.has(w)).length;
          const similarity = speechWords.length > 0 ? matchCount / speechWords.length : 0;
          
          console.log(`[App] STT durante TTS — similaridade: ${(similarity * 100).toFixed(0)}% (${matchCount}/${speechWords.length} palavras)`);
          
          if (similarity > 0.25) {
            console.log('[App] STT ignorado — eco do TTS');
            return; // Descarta — é eco do TTS
          }
        }
        
        console.log('[App] STT interrupt durante TTS:', speechText);
        stopSpeaking();
        isProcessingRef.current = false;
        // Continuar para processar a fala como nova mensagem
      }
      
      // Se já está processando outra mensagem, ignorar
      if (isProcessingRef.current) return;
      
      console.log('[App] Fala reconhecida:', speechText);
      isProcessingRef.current = true;
      setIsProcessing(true);

      // NÃO pausar STT — ele continua ativo para detectar interrupt
      // O AEC filtra o eco do TTS

      try {
        // Enviar para o Gemini
        const response = await sendMessage(speechText);
        lastBotResponseRef.current = response; // Salvar para filtro de eco
        console.log('[App] Resposta do Gemini:', response.substring(0, 100) + '...');

        // Reproduzir resposta com TTS chunked (se speaker ON e tem config)
        // STT continua ativo — AEC filtra eco, VAD detecta interrupt
        if (response && ttsSecretKey && isSpeakerOnRef.current) {
          try {
            await speakChunked(
              response,
              ttsSecretKey,
              ttsVoiceId,
              ttsModel as any,
              {
                onChunkStart: (i, total) => {
                  console.log(`[App] TTS chunk ${i + 1}/${total}`);
                },
                onQueueComplete: () => {
                  console.log('[App] TTS completo');
                  audioManager.resetDuckState();
                  audioManager.restoreVolume(0.5);
                  isProcessingRef.current = false;
                  setIsProcessing(false);
                },
                onCancelled: () => {
                  console.log('[App] TTS cancelado (interrupt)');
                  audioManager.resetDuckState();
                  audioManager.restoreVolume(0.3);
                  isProcessingRef.current = false;
                  setIsProcessing(false);
                },
              }
            );
          } catch (ttsError) {
            console.warn('[App] TTS erro:', ttsError);
          }
        }
      } catch (error) {
        console.error('[App] Erro ao processar mensagem:', error);
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    };

    window.addEventListener(SPEECH_READY_EVENT, handleSpeechReady);
    return () => window.removeEventListener(SPEECH_READY_EVENT, handleSpeechReady);
  }, [connected, sendMessage, ttsSecretKey, ttsVoiceId, ttsModel]);

  // ================== FIM HOOKS DE COMUNICAÇÃO ==================

  // Mute state — independente do isListening (que pode estar pausado durante TTS)
  const [isMuted, setIsMuted] = useState(false);
  
  // Controlar mute — interrupt TTS + parar/iniciar STT
  const toggleMute = useCallback(() => {
    if (!isMuted) {
      // MUTAR: parar TTS + parar STT
      setIsMuted(true);
      isMutedRef.current = true;
      stopSpeaking(); // Parar TTS imediatamente (interrupt!)
      stopListening();
      resetTranscript();
      console.log('[App] Muted — TTS interrompido, STT parado');
    } else {
      // DESMUTAR: resetar e iniciar STT
      setIsMuted(false);
      isMutedRef.current = false;
      resetTranscript();
      startListening();
      console.log('[App] Unmuted — STT iniciado');
    }
  }, [isMuted, startListening, stopListening, resetTranscript]);
  
  // Speaker toggle — conectado ao TTS
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const newValue = !prev;
      if (!newValue) {
        // Desligando speaker: parar TTS se estiver falando
        stopSpeaking();
        // Retomar STT se estava pausado esperando TTS
        if (!isMutedRef.current && isProcessingRef.current) {
          resumeListening();
        }
        console.log('[App] Speaker OFF — TTS parado');
      } else {
        console.log('[App] Speaker ON');
      }
      return newValue;
    });
  }, [resumeListening]);

  // Screen sharing - desabilitado na nova arquitetura
  const isScreenSharing = false;
  const toggleScreenShare = useCallback(() => {
    console.log('[App] Screen sharing não suportado na arquitetura texto');
  }, []);

  // getAnalysers - retornar null (não temos mais visualização de áudio)
  const getAnalysers = () => ({ input: null, output: null });

  // B1: Handle unexpected disconnection — save everything
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const sessionTooShort = durationMs < 5000;
    if (sessionTooShort) {
      console.log('[App] Session lasted <5s — skipping dropped session save to prevent loop');
      try {
        localStorage.removeItem(DROPPED_SESSION_KEY);
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      } catch (e) { /* ignore */ }
      setSessionDropped(false);
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
      toolResults: data.toolResults.slice(0, 3),
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
    setSessionDropped(true);

    // Navigate to home
    setCurrentScreen(ScreenName.HOME);
  }, [transcript, locale]);

  // Save API key to localStorage whenever it changes
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    try {
      if (newApiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEY, newApiKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save API key to localStorage:', error);
    }
  };

  const handleNavigate = (screen: ScreenName) => {
    setCurrentScreen(screen);
  };

  const handleStartCall = async () => {
    // If no API key is configured, redirect to Account settings
    if (!hasApiKey) {
      setCurrentScreen(ScreenName.ACCOUNT);
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
        setSessionDropped(false);
      }
    } catch (e) {
      console.warn('[App] Failed to restore dropped session context:', e);
    }

    // Also add regular history context if enabled and no dropped session was found
    if (useConversationContext && history.length > 0 && !contextWithHistory.includes('[CONTEXTO DA SESSAO ANTERIOR')) {
      const recentHistory = history.slice(0, 3).map(h => h.transcript).join('\n---\n');
      contextWithHistory = `${contextWithHistory}\n\n[Contexto de conversas anteriores]:\n${recentHistory}`;
    }

    // Conectar ao Gemini (apenas texto, sem TTS)
    try {
      await connectChat({
        voiceName,
        systemInstruction: contextWithHistory,
        apiKey,
        enableAdvancedFeatures: true,
        useConversationContext,
      });
    } catch (e) {
      console.error('[App] Erro ao conectar chat:', e);
    }

    // Reset mute state
    setIsMuted(false);
    isMutedRef.current = false;
    
    setIsInCall(true);
    startListening(); // Iniciar STT
    
    // Iniciar VAD com AEC (echo cancellation) para interrupt automático por voz
    // AEC filtra o áudio do TTS que vaza pelo speaker antes de chegar ao VAD
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      micStreamRef.current = stream;
      
      // Verificar se AEC foi realmente aplicado
      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings();
      console.log(`[App] Mic AEC: ${settings?.echoCancellation}, NS: ${settings?.noiseSuppression}, AGC: ${settings?.autoGainControl}`);
      
      startVAD(stream);
      console.log('[App] VAD adaptativo iniciado (calibrando noise floor por 2s...)');
    } catch (e) {
      console.warn('[App] Não foi possível iniciar VAD:', e);
    }
    
    setCurrentScreen(ScreenName.USAGE);
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
    } catch (e) { /* ignore */ }
    setSessionDropped(false);

    // PARAR TUDO: TTS + STT + VAD + Chat
    stopSpeaking();      // Parar áudio TTS imediatamente
    stopListening();     // Parar STT (abort + destroy)
    stopVAD();           // Parar VAD
    disconnectChat();    // Desconectar chat
    resetTranscript();   // Limpar transcript do STT
    
    // Liberar mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    
    isProcessingRef.current = false;
    isMutedRef.current = false;
    setIsMuted(false);
    setIsInCall(false);
    setIsProcessing(false);
    setCurrentScreen(ScreenName.HOME);
    
    console.log('[App] Call encerrada — tudo parado');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <ErrorBoundary>
      <div className="w-full h-dvh-safe md:flex md:justify-center md:items-center md:min-h-screen md:bg-theme-primary font-sans">
        {/* 
          Responsive Container:
          - Mobile: Full screen, no padding, no border, no radius
          - Desktop (md+): Fixed width/height, rounded corners, black border (phone frame)
        */}
        <div className="w-full h-full md:max-w-[390px] md:h-[844px] relative overflow-hidden md:rounded-[40px] md:shadow-[0_30px_60px_-10px_var(--shadow-color)] md:border-[8px] md:border-black md:bg-black">

          {/* Inner Screen Content */}
          <div className="w-full h-full bg-theme-secondary overflow-hidden md:rounded-[32px] relative">
            {/* Toast notification — inside the phone frame */}
            <Toast />

            {currentScreen === ScreenName.HOME && (
              <HomeScreen
                onStartCall={handleStartCall}
                onSettings={() => handleNavigate(ScreenName.SETTINGS)}
                hasApiKey={hasApiKey}
                onConfigureApiKey={() => handleNavigate(ScreenName.ACCOUNT)}
                isConnecting={isInCall && chatProcessing}
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
            <Suspense fallback={<SkeletonLoader />}>
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
                  onBack={() => handleNavigate(ScreenName.SETTINGS)}
                  onDelete={deleteHistoryItem}
                  onImport={(items) => {
                    // Merge imported items, avoiding duplicates
                    const existingIds = new Set(history.map(h => h.id));
                    const newItems = items.filter(item => !existingIds.has(item.id));
                    if (newItems.length > 0) {
                      setHistory(prev => [...newItems, ...prev]);
                    }
                  }}
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
                    onBack={() => handleNavigate(ScreenName.SETTINGS)}
                    voiceName={voiceName}
                    setVoiceName={setVoiceName}
                    systemInstruction={systemInstruction}
                    setSystemInstruction={setSystemInstruction}
                    apiKey={apiKey}
                    setApiKey={handleApiKeyChange}
                  />
                )}
            </Suspense>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
