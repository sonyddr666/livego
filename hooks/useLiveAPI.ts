import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Session } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob, resampleAudioBuffer } from '../utils/audio-utils';
import { LiveConfig, ToolCallMessage, FunctionCall, FunctionResponseItem, WebkitWindow } from '../types';
import { handleToolCall } from '../utils/dataFunctions';
import { calculateRMSVolume, createEnhancementChain } from '../utils/audioEnhancement';
import { useSettingsStore } from '../store/settingsStore';

// Audio constants
const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  OUTPUT_SAMPLE_RATE: 24000,
  BUFFER_SIZE: 2048,
  FFT_SIZE: 256,
  SMOOTHING: 0.5,
  THROTTLE_MS: 50, // Throttle audio sends to prevent overwhelming the API
} as const;

// AudioWorklet processor code as a string to avoid external file loading issues
const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 2048; // Reduced from 4096 for lower latency
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    
    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer.push(channelData[i]);
    }

    if (this.buffer.length >= this.bufferSize) {
      const chunk = new Float32Array(this.buffer);
      this.port.postMessage(chunk);
      this.buffer = [];
    }

    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

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
  connect: (config: LiveConfig) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  getAnalysers: () => { input: AnalyserNode | null, output: AnalyserNode | null };
}

export const useLiveAPI = (): UseLiveAPIResult => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [currentConfig, setCurrentConfig] = useState<LiveConfig | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<Session> | null>(null);
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

  // Track state for cleanup and logic
  const isMutedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const isProcessingToolRef = useRef(false);
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const disconnect = useCallback(() => {
    if (audioWorkletNodeRef.current) {
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
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

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
    if (!ctx) {
      isProcessingQueueRef.current = false;
      return;
    }

    while (audioQueueRef.current.length > 0) {
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
        console.log('[DEBUG] Creating AudioWorklet blob...');
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        console.log('[DEBUG] AudioWorklet blob URL created:', workletUrl.substring(0, 50) + '...');

        try {
          await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);
          console.log('[DEBUG] AudioWorklet module added successfully');
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

      // Build tools array based on config and search mode
      const searchMode = useSettingsStore.getState().searchMode;
      const tools: any[] = [];

      if (config.enableAdvancedFeatures) {
        // Search tool: Google Search or Ghost-Search based on user preference
        if (searchMode === 'google') {
          tools.push({ googleSearch: {} });
        }

        // Function Calling - allows Gemini to access user data
        tools.push({
          functionDeclarations: [
            {
              name: 'get_conversation_history',
              description: 'Busca histórico de conversas do usuário por período. Retorna estatísticas e lista de conversas.',
              parameters: {
                type: 'object',
                properties: {
                  days: {
                    type: 'number',
                    description: 'Número de dias retroativos (ex: 7 para última semana, 30 para último mês)'
                  }
                },
                required: ['days']
              }
            },
            {
              name: 'fetch_page',
              description: 'Acessa uma URL e retorna texto resumido da pagina. Use quando o usuario pedir para abrir ou ler um site/link especifico.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'URL da pagina a ser lida (http ou https).'
                  },
                  maxChars: {
                    type: 'number',
                    description: 'Limite maximo de caracteres no retorno (500 a 30000).'
                  }
                },
                required: ['url']
              }
            },
            // TEMPORARILY DISABLED - save_emotional_note
            // {
            //   name: 'save_emotional_note',
            //   description: 'Salva uma observação sobre o estado emocional atual do usuário para análise futura.',
            //   parameters: {
            //     type: 'object',
            //     properties: {
            //       emotion: {
            //         type: 'string',
            //         description: 'Emoção detectada na voz ou mencionada pelo usuário',
            //         enum: ['happy', 'sad', 'anxious', 'angry', 'calm', 'neutral']
            //       },
            //       intensity: {
            //         type: 'number',
            //         description: 'Intensidade de 1 (leve) a 10 (extremo)'
            //       },
            //       trigger: {
            //         type: 'string',
            //         description: 'O que causou essa emoção, se mencionado pelo usuário'
            //       },
            //       note: {
            //         type: 'string',
            //         description: 'Observações adicionais sobre o contexto emocional'
            //       }
            //     },
            //     required: ['emotion', 'intensity']
            //   }
            // },
            {
              name: 'get_time_patterns',
              description: 'Analisa em quais horários ou dias da semana o usuário conversa mais e com quais emoções.',
              parameters: {
                type: 'object',
                properties: {
                  analysisType: {
                    type: 'string',
                    description: 'Tipo de análise temporal',
                    enum: ['hourly', 'daily']
                  }
                },
                required: ['analysisType']
              }
            },
            {
              name: 'search_conversation_topic',
              description: 'Busca conversas anteriores sobre um tema específico mencionado pelo usuário.',
              parameters: {
                type: 'object',
                properties: {
                  topic: {
                    type: 'string',
                    description: 'Tema a buscar (ex: trabalho, família, ansiedade, sono)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Máximo de resultados a retornar'
                  }
                },
                required: ['topic']
              }
            },
            {
              name: 'get_emotion_statistics',
              description: 'Retorna estatísticas agregadas sobre emoções registradas do usuário.',
              parameters: {
                type: 'object',
                properties: {
                  period: {
                    type: 'string',
                    description: 'Período de análise',
                    enum: ['today', 'week', 'month', 'all']
                  }
                },
                required: ['period']
              }
            },
            {
              name: 'ghost_search',
              description: 'Web search via Ghost-Search. IMPORTANT: Always translate the query to English for best results. Always include focus parameter.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query — MUST be in English for best results'
                  },
                  focus: {
                    type: 'string',
                    description: 'Search type. Use "web" by default.',
                    enum: ['web', 'academic', 'youtube', 'reddit', 'wolfram']
                  },
                  model: {
                    type: 'string',
                    description: 'AI model for search',
                    enum: ['best', 'sonar', 'deep_research', 'gpt_5_2', 'claude_4_5_sonnet', 'gemini_3_flash']
                  },
                  time_range: {
                    type: 'string',
                    description: 'Time filter for results',
                    enum: ['all', 'day', 'week', 'month', 'year']
                  }
                },
                required: ['query', 'focus']
              }
            }
          ]
        });
      }

      console.log('[DEBUG] Creating WebSocket session...');
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("[DEBUG] Live Session Opened - WebSocket connected");
            console.log("[DEBUG] AudioContext state at onopen:", inputAudioContextRef.current?.state);
            setConnected(true);
            isConnectedRef.current = true;
            setIsConnecting(false); // Stop loading

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

            // Send audio continuously, but drop pure silence/noise to prevent API overwhelm
            const sendAudioChunk = (inputData: Float32Array) => {
              if (!isConnectedRef.current) {
                return;
              }

              // CRITICAL: We cannot simply `return;` here, because skipping chunks corrupts the
              // PCM timeline and makes the audio sound scrambled to Gemini. 
              // Instead, we zero out the data to send pure digital silence.
              let dataToSend = inputData;
              const rms = calculateRMSVolume(inputData);

              // Send silence if muted, processing a tool, or background noise is low
              if (isMutedRef.current || isProcessingToolRef.current || rms < 0.008) {
                dataToSend = new Float32Array(inputData.length); // Pure silence
              }

              // Pass the native sample rate for automatic resampling to 16kHz
              const nativeSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
              const pcmBlob = createPcmBlob(dataToSend, nativeSampleRate);
              sessionPromise.then((session: any) => {
                if (isConnectedRef.current) {
                  session.sendRealtimeInput({ media: pcmBlob });
                }
              });
            };

            // Check if we registered AudioWorklet successfully earlier
            const hasWorklet = !!inputAudioContextRef.current.audioWorklet;

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
            // Uncomment below to see ALL messages:
            // console.log('[Live] message:', message);

            // Handle Input Transcription (User)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text) {
                const isNewTurn = currentSpeakerRef.current !== 'user';
                currentSpeakerRef.current = 'user';
                setTranscript(prev => {
                  const prefix = isNewTurn ? (prev.length > 0 ? '\n' : '') + 'User: ' : '';
                  return prev + prefix + text;
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
                  return prev + prefix + text;
                });
              }
            }

            // Handle Audio Output - Add to queue instead of processing directly
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              // Add to queue for async processing
              audioQueueRef.current.push(base64Audio);

              // Process queue if not already processing
              if (!isProcessingQueueRef.current) {
                isProcessingQueueRef.current = true;
                processAudioQueue(outputNode);
              }
            }

            if (message.serverContent?.interrupted) {
              // Clear queue immediately on interruption
              audioQueueRef.current = [];
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

                  // Mute microphone so the user doesn't interrupt the API while it's processing
                  isProcessingToolRef.current = true;

                  (async () => {
                    try {
                      const functionResponses: FunctionResponseItem[] = [];

                      for (const call of functionCalls) {
                        console.log('[Tool] Function called:', call.name, call.args);

                        // Implement audible TTS feedback when a search starts
                        if (call.name === 'ghost_search' || call.name === 'googleSearch') {
                          try {
                            const utterance = new SpeechSynthesisUtterance("Um momento, pesquisando...");
                            utterance.lang = "pt-BR";
                            utterance.rate = 1.3;
                            window.speechSynthesis.speak(utterance);
                          } catch (e) {
                            console.warn("[DEBUG] Could not play TTS feedback", e);
                          }
                        }

                        // Handle the actual function execution
                        const result = await handleToolCall(call as FunctionCall);
                        functionResponses.push({
                          id: call.id || '',
                          name: call.name || '',
                          response: result
                        });
                      }

                      if (isConnectedRef.current && sessionPromiseRef.current) {
                        console.log('[Tool] sending response:', functionResponses[0]);
                        const session = await sessionPromiseRef.current;
                        session.sendToolResponse({
                          functionResponses: functionResponses
                        });
                      }
                    } catch (error) {
                      console.error('[Tool] execution error:', error);
                    } finally {
                      isProcessingToolRef.current = false; // Restore microphone
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
            // Common codes: 1000=normal, 1008=policy violation (bad key), 1011=server error/quota
            if (event?.code === 1011) {
              console.error("[DEBUG] Server error — check API quota, model access, or setup message format");
            } else if (event?.code === 1008) {
              console.error("[DEBUG] Policy violation — likely invalid or unauthorized API key");
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
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: config.enableAdvancedFeatures
            ? buildAdvancedSystemInstruction(config.systemInstruction, config.useConversationContext)
            : config.systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
          },
          ...(tools.length > 0 && { tools })
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
    getAnalysers: getAnalyser,
    connect,
    disconnect,
    toggleMute,
    toggleSpeaker
  };
};
