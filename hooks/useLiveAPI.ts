import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Session } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob, resampleAudioBuffer } from '../utils/audio-utils';
import { LiveConfig, ToolCallMessage, FunctionCall, FunctionResponseItem, WebkitWindow, ToolResult } from '../types';
import { handleToolCall } from '../utils/dataFunctions';
import { createEnhancementChain } from '../utils/audioEnhancement';
import { useSettingsStore } from '../store/settingsStore';
import { buildFunctionDeclarations } from '../store/skillsStore';
import { ScreenCapture } from '../utils/screenCapture';
import { showToast } from '../components/Toast';

// Audio constants
const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  OUTPUT_SAMPLE_RATE: 24000,
  BUFFER_SIZE: 2048,
  FFT_SIZE: 256,
  SMOOTHING: 0.5,
  THROTTLE_MS: 50, // Throttle audio sends to prevent overwhelming the API
} as const;

// The AudioWorklet processor code is now loaded statically from public/pcm-processor.js

// Build enhanced system instruction for advanced features
function buildAdvancedSystemInstruction(baseInstruction: string, useHistory: boolean = false): string {
  const historyInstructions = useHistory ? `
HISTORICO DE CONVERSAS:
- Chame get_conversation_history(days=7) no inicio para entender o contexto
- Use o historico para uma saudacao personalizada se houver conversas anteriores
- Seja natural, nao mencione que esta "buscando dados"

PADROES PARA FUNCTIONS DE HISTORICO:
- Historico generico -> 30 dias
- "Ultima conversa" -> 1 dia
- Nao pergunte qual periodo; use os padroes acima` : '';

  return `${baseInstruction}

CAPACIDADES AVANCADAS:
1. Busca na web em tempo real (Google Search)
2. Leitura direta de paginas web por URL (fetch_page)
3. Pesquisa avancada Ghost-Search (ghost_search) - papers, YouTube, Reddit, calculos${useHistory ? '\n4. Acesso a historico de conversas (functions)' : ''}

BUSCA NA WEB (Google Search):
- Use para buscas rapidas e simples: noticias, clima, precos, fatos
- Quando usar a busca, diga brevemente "deixa eu verificar isso..."
- Cite as fontes quando relevante

GHOST-SEARCH (ghost_search):
- Use para pesquisas mais profundas e especializadas
- Use focus="academic" para papers e artigos cientificos
- Use focus="youtube" para buscar tutoriais e videos
- Use focus="reddit" para opinioes e discussoes
- Use focus="wolfram" para calculos matematicos
- Use model="deep_research" para analises completas
- Quando o usuario pedir pesquisa profunda, analise detalhada, ou mencionar "ghost search", use ghost_search
- Resuma a resposta de forma natural, nao leia o texto inteiro

LEITURA DE URL (fetch_page):
- Se o usuario disser "acesse", "abra", "leia este site/link", use fetch_page(url)
- Use fetch_page apenas quando houver URL explicita ou pedido claro para abrir pagina
- Se fetch_page falhar, explique o erro de forma curta e tente Google Search como alternativa${historyInstructions}`;
}

interface UseLiveAPIResult {
  connected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  volume: number;
  transcript: string;
  config: LiveConfig | null;
  audioCtx: AudioContext | null;
  toolResults: ToolResult[];
  isScreenSharing: boolean;
  connect: (config: LiveConfig) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleScreenShare: () => void;
  getAnalysers: () => { input: AnalyserNode | null, output: AnalyserNode | null };
}

export const useLiveAPI = (): UseLiveAPIResult => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [currentConfig, setCurrentConfig] = useState<LiveConfig | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<Session> | null>(null);
  const sessionRef = useRef<any>(null); // Direct session ref for synchronous access (no .then() race)
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Analyser for visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Gain node for speaker control
  const outputGainNodeRef = useRef<GainNode | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Audio queue for smooth playback (Google recommended architecture)
  const audioQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);
  const isInterruptedRef = useRef(false);
  const audioChunkCountRef = useRef(0); // Debug: count audio chunks sent

  // Track state for cleanup and logic
  const isMutedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const isProcessingToolRef = useRef(false);
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);

  // Tool results and auto-save tracking
  const toolResultsRef = useRef<ToolResult[]>([]);
  const pendingGhostResultsRef = useRef<ToolResult[]>([]);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef<LiveConfig | null>(null);
  const startTimeRef = useRef<number>(0);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  // Session resumption handle — used to reconnect after unexpected drops (3.1 model feature)
  const sessionResumptionHandleRef = useRef<string | null>(null);

  // Screen share state
  const screenCaptureRef = useRef<ScreenCapture | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const disconnect = useCallback(() => {
    // Stop screen capture if active
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);

    // Stop auto-save interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null; // Clean up the port listener to stop spam
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Stop all playing sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    sourcesRef.current.clear();

    // Clear audio queue
    audioQueueRef.current = [];
    isProcessingQueueRef.current = false;

    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        try { session.close(); } catch (e) { }
      });
      sessionPromiseRef.current = null;
    }

    setConnected(false);
    isConnectedRef.current = false;
    setIsConnecting(false);
    setVolume(0);
    setIsMuted(false);
    currentSpeakerRef.current = null;
    // Don't reset transcript here — it's needed for history save
    // transcriptRef.current is reset when starting a new connection
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Screen share: start/stop/toggle
  const startScreenShare = useCallback(async () => {
    if (screenCaptureRef.current?.isActive()) {
      console.log('[ScreenShare] Already active');
      return;
    }

    const fps = useSettingsStore.getState().screenVisionFps;
    const capture = new ScreenCapture();

    capture.onFrame = (base64: string) => {
      const session = sessionRef.current;
      if (!isConnectedRef.current || !session) return;
      try {
        session.sendRealtimeInput({
          media: { data: base64, mimeType: 'image/jpeg' }
        });
      } catch (e) {
        isConnectedRef.current = false;
      }
    };

    capture.onEnded = () => {
      console.log('[ScreenShare] Ended by user/browser');
      screenCaptureRef.current = null;
      setIsScreenSharing(false);
    };

    try {
      await capture.start(fps);
      screenCaptureRef.current = capture;
      setIsScreenSharing(true);
      console.log(`[ScreenShare] Started at ${fps} FPS`);
    } catch (err: any) {
      console.error('[ScreenShare] Failed to start:', err?.name, err?.message);
      // User denied or not supported — don't break anything
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);
    console.log('[ScreenShare] Stopped by user');
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (screenCaptureRef.current?.isActive()) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const newValue = !prev;
      // Control the output gain node to mute/unmute speaker
      if (outputGainNodeRef.current) {
        outputGainNodeRef.current.gain.value = newValue ? 1 : 0;
      }
      return newValue;
    });
  }, []);

  // Async playback loop - processes audio queue without blocking onmessage
  const processAudioQueue = useCallback(async (outputNode: GainNode) => {
    const ctx = outputAudioContextRef.current;
    if (!ctx || !isConnectedRef.current) {
      isProcessingQueueRef.current = false;
      return;
    }

    while (audioQueueRef.current.length > 0) {
      // Fix 1: Check interrupt flag before processing each chunk
      if (isInterruptedRef.current) {
        console.log('[Interrupt] processAudioQueue halted — queue cleared');
        audioQueueRef.current = [];
        break;
      }

      const base64Audio = audioQueueRef.current.shift();
      if (!base64Audio) continue;

      try {
        // Decode audio at 24kHz (Gemini's output rate)
        let audioBuffer = await decodeAudioData(
          base64ToUint8Array(base64Audio),
          ctx,
          AUDIO_CONFIG.OUTPUT_SAMPLE_RATE,
          1
        );

        // Resample to system's native sample rate if different
        if (ctx.sampleRate !== AUDIO_CONFIG.OUTPUT_SAMPLE_RATE) {
          audioBuffer = await resampleAudioBuffer(audioBuffer, ctx.sampleRate);
        }

        // Re-check interrupt after async decode (race condition guard)
        if (isInterruptedRef.current) {
          console.log('[Interrupt] processAudioQueue halted after decode');
          audioQueueRef.current = [];
          break;
        }

        // Schedule playback
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNode);
        source.addEventListener('ended', () => {
          sourcesRef.current.delete(source);
        });

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        sourcesRef.current.add(source);
      } catch (error) {
        console.error('Audio decode error:', error);
      }
    }

    isProcessingQueueRef.current = false;
  }, []);

  const connect = useCallback(async (config: LiveConfig) => {
    try {
      setIsConnecting(true); // Start loading
      setCurrentConfig(config);

      console.log('[DEBUG] Starting connection...');

      // Prioritize user-configured API key over environment variable
      const apiKey = config.apiKey || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please configure your API key in Settings > Account or set VITE_GEMINI_API_KEY environment variable.");
      }

      console.log('[DEBUG] API key found, creating GoogleGenAI instance...');
      const ai = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported in this browser');
      }
      console.log('[DEBUG] AudioContext class available:', !!AudioContextClass);

      inputAudioContextRef.current = new AudioContextClass();
      outputAudioContextRef.current = new AudioContextClass();

      // CRITICAL DEBUG: Check AudioContext state on mobile
      console.log('[DEBUG] Input AudioContext state:', inputAudioContextRef.current.state);
      console.log('[DEBUG] Output AudioContext state:', outputAudioContextRef.current.state);
      console.log('[DEBUG] User Agent:', navigator.userAgent);

      // Resume AudioContext if suspended (common on mobile browsers)
      if (inputAudioContextRef.current.state === 'suspended') {
        console.log('[DEBUG] Input AudioContext is SUSPENDED - attempting resume...');
        await inputAudioContextRef.current.resume();
        console.log('[DEBUG] Input AudioContext after resume:', inputAudioContextRef.current.state);
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        console.log('[DEBUG] Output AudioContext is SUSPENDED - attempting resume...');
        await outputAudioContextRef.current.resume();
        console.log('[DEBUG] Output AudioContext after resume:', outputAudioContextRef.current.state);
      }

      // Check if AudioWorklet is supported (requires HTTPS or localhost)
      let useWorklet = true;
      if (!inputAudioContextRef.current.audioWorklet) {
        console.warn('[DEBUG] AudioWorklet is blocked (likely due to accessing via insecure HTTP IP address). Falling back to ScriptProcessor...');
        useWorklet = false;
      }

      // Register AudioWorklet if available
      if (useWorklet) {
        console.log('[DEBUG] Charging AudioWorklet from static file...');
        const workletUrl = '/pcm-processor.js';

        try {
          await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);
          console.log('[DEBUG] AudioWorklet module added successfully from', workletUrl);
        } catch (workletError) {
          console.warn('[DEBUG] AudioWorklet registration FAILED, falling back to ScriptProcessor:', workletError);
          useWorklet = false;
        }
      }

      // Setup Input Analyser
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = AUDIO_CONFIG.FFT_SIZE;
      inputAnalyserRef.current.smoothingTimeConstant = AUDIO_CONFIG.SMOOTHING;

      // Setup Output Analyser
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = AUDIO_CONFIG.FFT_SIZE;
      outputAnalyserRef.current.smoothingTimeConstant = AUDIO_CONFIG.SMOOTHING;

      const outputNode = outputAudioContextRef.current.createGain();
      outputGainNodeRef.current = outputNode; // Store reference for speaker control
      outputNode.connect(outputAnalyserRef.current); // Connect through analyser
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      nextStartTimeRef.current = 0;
      setTranscript('');
      currentSpeakerRef.current = null;
      toolResultsRef.current = [];
      pendingGhostResultsRef.current = [];
      setToolResults([]);
      startTimeRef.current = Date.now();
      configRef.current = config;

      console.log('[DEBUG] Requesting microphone permission...');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[DEBUG] Microphone access granted');
        console.log('[DEBUG] Audio tracks:', stream.getAudioTracks().length);
        console.log('[DEBUG] Track settings:', stream.getAudioTracks()[0]?.getSettings());
      } catch (micError) {
        console.error('[DEBUG] Microphone access DENIED:', micError);
        throw micError;
      }

      // Build tools array based on config, search mode, and enabled skills
      const searchMode = useSettingsStore.getState().searchMode;
      const tools: any[] = [];

      if (config.enableAdvancedFeatures) {
        if (searchMode === 'google') {
          tools.push({ googleSearch: {} });
        }

        // Add function declarations from enabled skills
        const skillDeclarations = buildFunctionDeclarations();
        if (skillDeclarations.length > 0) {
          tools.push({ functionDeclarations: skillDeclarations });
          console.log('[Skills] Registered', skillDeclarations.length, 'function declarations:', skillDeclarations.map(d => d.name));
        }
      }

      console.log('[DEBUG] Creating WebSocket session...');
      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: () => {
            console.log("[DEBUG] Live Session Opened - WebSocket connected");
            console.log("[DEBUG] AudioContext state at onopen:", inputAudioContextRef.current?.state);
            
            // Reset transcript for new session
            setTranscript('');
            transcriptRef.current = '';

            // Auto-save is now handled via debounce in setTranscript
            // (fires 3s after last transcript change)
            setConnected(true);
            isConnectedRef.current = true;
            setIsConnecting(false); // Stop loading

            // Cache session synchronously for sendAudioChunk/onFrame (avoids .then() race)
            sessionPromiseRef.current?.then((s: any) => { sessionRef.current = s; });

            // (auto-save debounce moved to transcript handler)

            if (!inputAudioContextRef.current) {
              console.error("[DEBUG] ERROR: inputAudioContext is null at onopen!");
              return;
            }

            console.log("[DEBUG] Creating MediaStreamSource...");
            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);

            // Connect input to analyser for visualization (raw input)
            if (inputAnalyserRef.current) {
              inputSourceRef.current.connect(inputAnalyserRef.current);
            }

            // Create Audio Enhancement Chain
            // This cleans up the microphone audio (removes rumbling, compression, noise gate)
            // so Gemini can understand speech much better.

            console.log("[DEBUG] Applying Audio Enhancements (Noise Gate + EQ + Compression)...");
            const enhancedChain = createEnhancementChain(inputAudioContextRef.current);
            inputSourceRef.current.connect(enhancedChain.input);

            // Fallback variable for ScriptProcessor
            let scriptProcessorNode: ScriptProcessorNode | null = null;

            // Send audio continuously
            const sendAudioChunk = (inputData: Float32Array) => {
              const session = sessionRef.current;
              if (!isConnectedRef.current || !session) {
                return;
              }

              // Debug: log mic activity every 100 chunks (~3s) to confirm audio pipeline is alive
              audioChunkCountRef.current++;
              if (audioChunkCountRef.current % 100 === 0) {
                console.log(`[Mic] Chunk #${audioChunkCountRef.current} sent | muted=${isMutedRef.current} | queue=${audioQueueRef.current.length} | sources=${sourcesRef.current.size}`);
              }

              // CRITICAL: We cannot simply `return;` here, because skipping chunks corrupts the
              // PCM timeline and makes the audio sound scrambled to Gemini. 
              // Instead, we zero out the data to send pure digital silence.
              let dataToSend = inputData;

              // Send silence if muted
              // NOTE: Noise gate removed — trust Gemini's server-side VAD for speech detection
              if (isMutedRef.current) {
                dataToSend = new Float32Array(inputData.length); // Pure silence
              }

              // Pass the native sample rate for automatic resampling to 16kHz
              const nativeSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
              const pcmBlob = createPcmBlob(dataToSend, nativeSampleRate);
              try {
                session.sendRealtimeInput({ media: pcmBlob });
              } catch (e) {
                // WebSocket entering CLOSING state — stop sending silently
                isConnectedRef.current = false;
              }
            };

            // Check if we registered AudioWorklet successfully earlier
            const hasWorklet = useWorklet;

            if (hasWorklet) {
              console.log("[DEBUG] Creating AudioWorkletNode 'pcm-processor'...");
              try {
                audioWorkletNodeRef.current = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor');
                console.log("[DEBUG] AudioWorkletNode created successfully");

                audioWorkletNodeRef.current.port.onmessage = (event: MessageEvent) => {
                  const inputData = event.data as Float32Array;
                  sendAudioChunk(inputData);
                };

                // Connect the ENHANCED audio (clean, no static) to the processor that sends data to Gemini
                enhancedChain.output.connect(audioWorkletNodeRef.current);
                audioWorkletNodeRef.current.connect(inputAudioContextRef.current.destination); // Connect to destination to keep graph alive
                console.log("[DEBUG] Audio pipeline connected successfully via AudioWorklet");
              } catch (workletNodeError) {
                console.error("[DEBUG] AudioWorkletNode creation FAILED:", workletNodeError);
                return; // Can't proceed
              }
            } else {
              console.log("[DEBUG] Using ScriptProcessorNode fallback for insecure contexts...");
              // Use ScriptProcessorNode (deprecated but works everywhere for local network/HTTP testing)
              const bufferSize = AUDIO_CONFIG.BUFFER_SIZE || 2048;
              scriptProcessorNode = inputAudioContextRef.current.createScriptProcessor(bufferSize, 1, 1);

              scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
                const inputBuffer = audioProcessingEvent.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);
                // Copy data to avoid mutating the original buffer
                const pcmData = new Float32Array(inputData);
                sendAudioChunk(pcmData);
              };

              // Connect the ENHANCED audio to the ScriptProcessor
              enhancedChain.output.connect(scriptProcessorNode);
              scriptProcessorNode.connect(inputAudioContextRef.current.destination);
              console.log("[DEBUG] Audio pipeline connected successfully via ScriptProcessorNode");
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Debug: Log all incoming messages to see Google Search grounding data
            const msgAny = message as any;
            if (msgAny.groundingMetadata) {
              console.log('[Search] Google grounding:', msgAny.groundingMetadata);
            }
            if (msgAny.serverContent?.groundingMetadata) {
              console.log('[Search] Google grounding (serverContent):', msgAny.serverContent.groundingMetadata);
            }

            // Session Resumption: save the latest handle so we can reconnect after drops
            if (msgAny.sessionResumptionUpdate?.handle) {
              sessionResumptionHandleRef.current = msgAny.sessionResumptionUpdate.handle;
              console.log('[Session] Resumption handle updated');
            }

            // Debug: Log message types to diagnose interrupt issues
            const hasAudio = !!message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            const hasInterrupted = !!message.serverContent?.interrupted;
            const hasInputTranscription = !!message.serverContent?.inputTranscription;
            const hasOutputTranscription = !!message.serverContent?.outputTranscription;
            const hasToolCall = !!(message as any).toolCall;
            if (hasInterrupted || hasInputTranscription || hasToolCall) {
              console.log(`[Live] msg: audio=${hasAudio} interrupted=${hasInterrupted} inputTx=${hasInputTranscription} outputTx=${hasOutputTranscription} toolCall=${hasToolCall}`);
            }

            // Handle Input Transcription (User)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text) {
                const isNewTurn = currentSpeakerRef.current !== 'user';
                currentSpeakerRef.current = 'user';
                setTranscript(prev => {
                  const prefix = isNewTurn ? (prev.length > 0 ? '\n' : '') + 'User: ' : '';
                  const next = prev + prefix + text;
                  transcriptRef.current = next;
                  // Debounce auto-save: save 3s after last transcript change
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = setTimeout(() => {
                    try {
                      localStorage.setItem('livego_active_session', JSON.stringify({
                        transcript: transcriptRef.current,
                        toolResults: toolResultsRef.current,
                        timestamp: Date.now(),
                        startTime: startTimeRef.current,
                      }));
                    } catch (e) { /* ignore */ }
                  }, 3000);
                  return next;
                });
              }
            }

            // Handle Output Transcription (Gemini)
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              if (text) {
                const isNewTurn = currentSpeakerRef.current !== 'gemini';
                currentSpeakerRef.current = 'gemini';
                setTranscript(prev => {
                  const prefix = isNewTurn ? (prev.length > 0 ? '\n' : '') + 'Gemini: ' : '';
                  const next = prev + prefix + text;
                  transcriptRef.current = next;
                  // Debounce auto-save: save 3s after last transcript change
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = setTimeout(() => {
                    try {
                      localStorage.setItem('livego_active_session', JSON.stringify({
                        transcript: transcriptRef.current,
                        toolResults: toolResultsRef.current,
                        timestamp: Date.now(),
                        startTime: startTimeRef.current,
                      }));
                    } catch (e) { /* ignore */ }
                  }, 3000);
                  return next;
                });
              }
            }

            // Handle Audio Output - Add to queue instead of processing directly
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              // New audio chunk = new response, reset interrupt flag
              isInterruptedRef.current = false;

              // Add to queue for async processing
              audioQueueRef.current.push(base64Audio);

              // Process queue if not already processing
              if (!isProcessingQueueRef.current) {
                isProcessingQueueRef.current = true;
                processAudioQueue(outputNode);
              }
            }

            if (message.serverContent?.interrupted) {
              console.log('[Interrupt] ⚡ Server sent interrupted=true — stopping all audio');
              // Set flag FIRST to halt processAudioQueue
              isInterruptedRef.current = true;
              // Clear queue immediately on interruption
              audioQueueRef.current = [];
              isProcessingQueueRef.current = false;
              sourcesRef.current.forEach(src => {
                try { src.stop(); } catch (e) { }
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Tool Calls (Function Calling)
            const toolCallMessage = (message as unknown as { toolCall?: ToolCallMessage }).toolCall;
            if (toolCallMessage && config.enableAdvancedFeatures) {
              // Handle Tool Calls (Google Search, Ghost Search, Functions)
              if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls;
                if (functionCalls && functionCalls.length > 0) {
                  console.log('[Tool] call received:', message.toolCall);

                  (async () => {
                    try {
                      const functionResponses: FunctionResponseItem[] = [];

                      for (const call of functionCalls) {
                        console.log('[Tool] Function called:', call.name, call.args);

                        // A1: GHOST SEARCH — Busca dual (resposta imediata + background)
                        if (call.name === 'ghost_search') {
                          console.log('[Tool] Ghost Search: responding immediately, running in background');

                          // Dispatch event so UI shows BUSCANDO tag
                          window.dispatchEvent(new CustomEvent('livego:search_active', {
                            detail: { query: (call.args as any)?.query || '' }
                          }));
                          
                          // 1. Respond IMMEDIATELY to Gemini (avoids 1011 timeout)
                          const immediateResponse = {
                            ok: true,
                            status: 'searching_in_background',
                            message: 'Busca profunda do Ghost Search iniciada em background. ' +
                              'Enquanto o resultado completo nao chega, use sua busca nativa do Google ' +
                              'para dar uma resposta rapida ao usuario. Quando o Ghost Search terminar, ' +
                              'informe o usuario que tem informacoes mais detalhadas disponiveis. ' +
                              'Pergunte se ele quer ouvir o resultado completo.',
                            query: (call.args as any)?.query || '',
                          };
                          
                          functionResponses.push({
                            id: call.id || '',
                            name: call.name || '',
                            response: immediateResponse
                          });

                          // 2. Start ghost_search in background (NO await)
                          const ghostCallArgs = call.args as any;
                          handleToolCall(call as FunctionCall).then((ghostResult) => {
                            console.log('[Tool] Ghost Search background result arrived:', ghostResult?.ok);

                            // Dispatch event so UI hides BUSCANDO tag
                            window.dispatchEvent(new CustomEvent('livego:search_done', {
                              detail: { query: ghostCallArgs?.query || '', ok: ghostResult?.ok || false }
                            }));
                            
                            // B2: Save tool result
                            const toolResult: ToolResult = {
                              toolName: 'ghost_search',
                              query: ghostCallArgs?.query || '',
                              timestamp: Date.now(),
                              answer: ghostResult?.answer?.substring(0, 2000) || '',
                              citations: ghostResult?.citations || [],
                              ok: ghostResult?.ok || false,
                            };
                            toolResultsRef.current.push(toolResult);
                            setToolResults([...toolResultsRef.current]);

                            if (isConnectedRef.current && sessionRef.current) {
                              // Session still alive — save as pending for the next interaction
                              pendingGhostResultsRef.current.push(toolResult);
                              console.log('[Tool] Ghost result saved as pending. Count:', pendingGhostResultsRef.current.length);
                            } else {
                              // Session dropped — save to localStorage for next reconnection
                              console.log('[Tool] Session closed. Saving ghost result to dropped session.');
                              try {
                                const existing = localStorage.getItem('livego_dropped_session');
                                if (existing) {
                                  const session = JSON.parse(existing);
                                  session.pendingGhostResults = session.pendingGhostResults || [];
                                  session.pendingGhostResults.push(toolResult);
                                  localStorage.setItem('livego_dropped_session', JSON.stringify(session));
                                }
                              } catch (e) {
                                console.warn('[Tool] Failed to save ghost result to dropped session:', e);
                              }
                            }
                          }).catch((err) => {
                            console.error('[Tool] Ghost Search background error:', err);
                            // Clear BUSCANDO tag on error too
                            window.dispatchEvent(new CustomEvent('livego:search_done', {
                              detail: { query: ghostCallArgs?.query || '', ok: false, error: true }
                            }));
                          });

                          continue; // Skip normal await flow for ghost_search
                        }

                        // All other tools: normal synchronous flow
                        const result = await handleToolCall(call as FunctionCall);
                        
                        // B2: Save tool result to history
                        if (call.name === 'fetch_page' || call.name === 'show_image') {
                          const toolResult: ToolResult = {
                            toolName: call.name || '',
                            query: (call.args as any)?.url || (call.args as any)?.query || '',
                            timestamp: Date.now(),
                            answer: result?.contentPreview?.substring(0, 500) || result?.message || '',
                            ok: result?.ok || false,
                          };
                          toolResultsRef.current.push(toolResult);
                          setToolResults([...toolResultsRef.current]);
                        }

                        functionResponses.push({
                          id: call.id || '',
                          name: call.name || '',
                          response: result
                        });
                      }

                      if (functionResponses.length > 0 && isConnectedRef.current && sessionRef.current) {
                        console.log('[Tool] sending response:', functionResponses[0]);
                        sessionRef.current.sendToolResponse({
                          functionResponses: functionResponses
                        });
                      }
                    } catch (error) {
                      console.error('[Tool] execution error:', error);
                    }
                  })();
                }
              }
            }
          },
          onclose: (event: any) => {
            console.log("[DEBUG] Live Session Closed");
            console.log("[DEBUG] Close code:", event?.code);
            console.log("[DEBUG] Close reason:", event?.reason);
            console.log("[DEBUG] Was clean:", event?.wasClean);
            console.log("[DEBUG] Close event:", event);
            console.log("[DEBUG] AudioContext state at close:", inputAudioContextRef.current?.state);

            // A2: IMMEDIATELY stop audio pipeline to prevent WebSocket spam
            isConnectedRef.current = false;
            sessionRef.current = null; // Kill synchronous session ref — stops all sends instantly
            if (audioWorkletNodeRef.current) {
              audioWorkletNodeRef.current.port.onmessage = null;
            }
            // Clear audio queue immediately to prevent stale playback
            audioQueueRef.current = [];
            isProcessingQueueRef.current = false;

            // Common codes: 1000=normal, 1008=session not found/key issue, 1011=server error/quota
            if (event?.code === 1011) {
              console.error("[DEBUG] Server error — instability on gemini-3.1-flash-live-preview; session resumption will restore context");
              showToast('Conexão caiu. Tentando reconectar com o contexto salvo...', 'warning');
            } else if (event?.code === 1008) {
              console.error("[DEBUG] Session error 1008:", event?.reason);
              const reason = (event?.reason || '').toLowerCase();
              if (reason.includes('leaked') || reason.includes('invalid') || reason.includes('unauthorized')) {
                // Invalid key — clear resumption handle since it won't help
                sessionResumptionHandleRef.current = null;
                showToast('Sua API Key não funciona!\n' + (event?.reason || 'Key inválida ou bloqueada.'), 'error', 10, '👉 Toque aqui para adicionar uma Key válida');
              } else {
                showToast('Sessão expirada ou inválida.\nTente reconectar.', 'warning');
              }
            } else if (event?.code === 1000) {
              // Clean close — discard resumption handle so next call starts fresh
              sessionResumptionHandleRef.current = null;
            }

            // B1: If connection dropped unexpectedly (not normal close), save everything
            if (event?.code !== 1000 && configRef.current?.onUnexpectedDisconnect) {
              console.log('[DEBUG] Unexpected disconnect detected. Saving session data...');
              configRef.current.onUnexpectedDisconnect({
                transcript: transcriptRef.current,
                toolResults: [...toolResultsRef.current],
                closeCode: event?.code || 0,
                closeReason: event?.reason || 'Unknown',
              });
            }

            disconnect();
          },
          onerror: (err: any) => {
            console.error("[DEBUG] Live Session Error:", err);
            console.error("[DEBUG] Error type:", typeof err);
            console.error("[DEBUG] Error details:", JSON.stringify(err, null, 2));
            disconnect();
          }
        },
        config: {
          systemInstruction: config.enableAdvancedFeatures
            ? buildAdvancedSystemInstruction(config.systemInstruction, config.useConversationContext)
            : config.systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // NOTE: realtimeInputConfig with VAD sensitivity is NOT supported here to keep
          // interrupt behavior consistent — Gemini 3.1 Flash Live handles VAD server-side.
          ...(tools.length > 0 && { tools }),
          // Enable Session Resumption: server sends handles we can use to reconnect
          // after unexpected drops without losing conversation context.
          sessionResumption: sessionResumptionHandleRef.current
            ? { handle: sessionResumptionHandleRef.current }
            : {}
        }
      });

      console.log("[DEBUG] Session promise created, waiting for connection...");
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("[DEBUG] Connection failed with error:", error);
      console.error("[DEBUG] Error stack:", error instanceof Error ? error.stack : 'No stack');
      disconnect();
    }
  }, [disconnect]);

  const getAnalyser = () => {
    return {
      input: inputAnalyserRef.current,
      output: outputAnalyserRef.current
    }
  }

  return {
    connected,
    isConnecting,
    isMuted,
    isSpeakerOn,
    volume,
    transcript,
    config: currentConfig,
    audioCtx: outputAudioContextRef.current,
    toolResults,
    isScreenSharing,
    getAnalysers: getAnalyser,
    connect,
    disconnect,
    toggleMute,
    toggleSpeaker,
    toggleScreenShare
  };
};
