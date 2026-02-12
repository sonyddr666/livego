import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob, resampleAudioBuffer } from '../utils/audio-utils';
import { LiveConfig } from '../types';
import { handleToolCall } from '../utils/dataFunctions';

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
HISTÓRICO DE CONVERSAS:
- Chame get_conversation_history(days=7) no início para entender o contexto
- Use o histórico para uma saudação personalizada se houver conversas anteriores
- Seja natural, não mencione que está "buscando dados"

PADRÕES PARA FUNCTIONS DE HISTÓRICO:
- Histórico genérico → 30 dias
- "Última conversa" → 1 dia
- NÃO pergunte qual período - use os padrões acima` : '';

  return `${baseInstruction}

CAPACIDADES AVANÇADAS:
1. Busca na web em tempo real (Google Search)
2. Acesso a páginas web específicas (fetch_page)${useHistory ? '\n3. Acesso a histórico de conversas (functions)' : ''}

BUSCA NA WEB (Google Search):
- Se o usuário perguntar sobre notícias, eventos atuais, preços, clima, ou qualquer informação que possa mudar com o tempo, USE A BUSCA
- NÃO invente informações - se não tiver certeza, busque
- Quando usar a busca, diga brevemente "deixa eu verificar isso..." ou algo natural
- Cite as fontes quando relevante

ACESSO WEB (fetch_page): Para sites e YouTube. Diga "vou acessar" antes. Para YouTube, ache o vídeo via Google Search, confirme, e passe a URL. Mode: full/links/specific.${historyInstructions}`;
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
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const resolvedSessionRef = useRef<any>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);
  const isAudioSendingRef = useRef(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const disconnect = useCallback(() => {
    console.log('[LiveAPI] disconnect() called');
    isAudioSendingRef.current = false;

    if (audioWorkletNodeRef.current) {
      try { audioWorkletNodeRef.current.disconnect(); } catch (e) { }
      audioWorkletNodeRef.current = null;
    }
    if (inputSourceRef.current) {
      try { inputSourceRef.current.disconnect(); } catch (e) { }
      inputSourceRef.current = null;
    }

    // [Android Fix] Stop media stream tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch (e) { }
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      try { outputAudioContextRef.current.close(); } catch (e) { }
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

    // Close the Gemini session
    if (resolvedSessionRef.current) {
      try { resolvedSessionRef.current.close(); } catch (e) { }
      resolvedSessionRef.current = null;
    }
    sessionPromiseRef.current = null;

    setConnected(false);
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
          24000,
          1
        );

        // Resample to system's native sample rate if different
        if (ctx.sampleRate !== 24000) {
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
      setIsConnecting(true);
      setCurrentConfig(config);
      console.log('[LiveAPI] === CONNECTION START ===');

      // Prioritize user-configured API key over environment variable
      const apiKey = config.apiKey || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please configure your API key in Settings > Account or set VITE_GEMINI_API_KEY environment variable.");
      }

      const ai = new GoogleGenAI({ apiKey });

      // ====== STEP 1: Get microphone FIRST (requires user gesture) ======
      console.log('[LiveAPI] Step 1: Requesting microphone...');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        streamRef.current = stream;
        console.log('[LiveAPI] Step 1: Microphone OK, tracks:', stream.getAudioTracks().length);
      } catch (micError) {
        console.error('[LiveAPI] Microphone access failed:', micError);
        throw new Error(`Microphone access denied: ${(micError as Error).message}`);
      }

      // ====== STEP 2: Create and resume AudioContexts ======
      console.log('[LiveAPI] Step 2: Creating AudioContexts...');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass();
      outputAudioContextRef.current = new AudioContextClass();

      // Always resume - safe to call even if already running
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      console.log('[LiveAPI] Step 2: AudioContext states - input:', inputAudioContextRef.current.state, 'output:', outputAudioContextRef.current.state);

      // [Android Fix] Listen for AudioContext being suspended (e.g. app goes to background)
      inputAudioContextRef.current.onstatechange = () => {
        console.log('[LiveAPI] Input AudioContext state changed to:', inputAudioContextRef.current?.state);
        if (inputAudioContextRef.current?.state === 'suspended') {
          inputAudioContextRef.current.resume().catch(() => { });
        }
      };
      outputAudioContextRef.current.onstatechange = () => {
        console.log('[LiveAPI] Output AudioContext state changed to:', outputAudioContextRef.current?.state);
        if (outputAudioContextRef.current?.state === 'suspended') {
          outputAudioContextRef.current.resume().catch(() => { });
        }
      };

      // ====== STEP 3: Register AudioWorklet with fallback ======
      console.log('[LiveAPI] Step 3: Registering AudioWorklet...');
      let useWorklet = true;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      try {
        await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);
        console.log('[LiveAPI] Step 3: AudioWorklet OK');
      } catch (workletError) {
        console.warn('[LiveAPI] Step 3: AudioWorklet failed, will use ScriptProcessor fallback:', workletError);
        useWorklet = false;
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      // ====== STEP 4: Setup audio pipeline (BEFORE WebSocket) ======
      console.log('[LiveAPI] Step 4: Setting up audio pipeline...');

      // Input Analyser
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;

      // Output Analyser
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;

      const outputNode = outputAudioContextRef.current.createGain();
      outputGainNodeRef.current = outputNode;
      outputNode.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      // Create input source from microphone
      inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
      if (inputAnalyserRef.current) {
        inputSourceRef.current.connect(inputAnalyserRef.current);
      }

      // Setup audio send function (will be activated in onopen)
      const sendAudioData = (inputData: Float32Array) => {
        if (isMutedRef.current || !isAudioSendingRef.current) return;
        const nativeSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
        const pcmBlob = createPcmBlob(inputData, nativeSampleRate);
        const session = resolvedSessionRef.current;
        if (session) {
          try {
            session.sendRealtimeInput({ media: pcmBlob });
          } catch (e) {
            console.error('[LiveAPI] Error sending audio:', e);
          }
        }
      };

      // Connect audio processing node
      if (useWorklet) {
        audioWorkletNodeRef.current = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor');
        audioWorkletNodeRef.current.port.onmessage = (event) => {
          sendAudioData(event.data as Float32Array);
        };
        inputSourceRef.current.connect(audioWorkletNodeRef.current);
        audioWorkletNodeRef.current.connect(inputAudioContextRef.current.destination);
        console.log('[LiveAPI] Step 4: Audio pipeline OK (AudioWorklet)');
      } else {
        const bufferSize = 2048;
        const scriptNode = (inputAudioContextRef.current as any).createScriptProcessor(bufferSize, 1, 1);
        scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
          const inputData = event.inputBuffer.getChannelData(0);
          sendAudioData(new Float32Array(inputData));
        };
        inputSourceRef.current.connect(scriptNode);
        scriptNode.connect(inputAudioContextRef.current.destination);
        audioWorkletNodeRef.current = scriptNode;
        console.log('[LiveAPI] Step 4: Audio pipeline OK (ScriptProcessor fallback)');
      }

      nextStartTimeRef.current = 0;
      setTranscript('');
      currentSpeakerRef.current = null;

      // Build tools array based on config
      const tools: any[] = [];

      if (config.enableAdvancedFeatures) {
        // Google Search - allows Gemini to search the web for current information
        tools.push({ googleSearch: {} });

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
              name: 'fetch_page',
              description: 'Lê páginas web ou transcrições YouTube. Para YouTube, retorna transcrição automaticamente.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'URL da página ou vídeo YouTube'
                  },
                  mode: {
                    type: 'string',
                    description: 'full/links/specific',
                    enum: ['full', 'links', 'specific']
                  },
                  query: {
                    type: 'string',
                    description: 'Busca pontual (só mode specific)'
                  }
                },
                required: ['url', 'mode']
              }
            }
          ]
        });
      }

      // ====== STEP 5: Connect WebSocket session (audio pipeline is already ready!) ======
      console.log('[LiveAPI] Step 5: Connecting WebSocket session...');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('[LiveAPI] ✅ Session OPENED - enabling audio sending');
            // Audio pipeline is already set up, just enable sending
            isAudioSendingRef.current = true;
            setConnected(true);
            setIsConnecting(false);

            // Ensure AudioContexts are still running
            if (inputAudioContextRef.current?.state === 'suspended') {
              inputAudioContextRef.current.resume();
            }
            if (outputAudioContextRef.current?.state === 'suspended') {
              outputAudioContextRef.current.resume();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Debug: Log all incoming messages to see Google Search grounding data
            const msgAny = message as any;
            if (msgAny.groundingMetadata) {
              console.log('🔍 Google Search grounding:', msgAny.groundingMetadata);
            }
            if (msgAny.serverContent?.groundingMetadata) {
              console.log('🔍 Google Search grounding (serverContent):', msgAny.serverContent.groundingMetadata);
            }
            // Uncomment below to see ALL messages:
            // console.log('📨 Live message:', message);

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
            const toolCall = (message as any).toolCall;
            if (toolCall && config.enableAdvancedFeatures) {
              console.log('🔧 Tool call received:', toolCall);
              for (const functionCall of toolCall.functionCalls || []) {
                try {
                  const result = await handleToolCall({
                    name: functionCall.name,
                    args: functionCall.args
                  });

                  // Send tool response back to Gemini
                  sessionPromise.then(session => {
                    const toolResponse = {
                      functionResponses: [{
                        id: functionCall.id,
                        name: functionCall.name,
                        response: result
                      }]
                    };

                    console.log('📤 Sending tool response:', toolResponse);

                    // Try different methods based on SDK version
                    if (typeof (session as any).sendToolResponse === 'function') {
                      (session as any).sendToolResponse(toolResponse);
                    } else if (typeof (session as any).send === 'function') {
                      // Alternative: send as client content
                      (session as any).send({ toolResponse });
                    } else if (typeof (session as any).sendClientContent === 'function') {
                      (session as any).sendClientContent({ toolResponse });
                    } else {
                      console.warn('⚠️ No valid method to send tool response. Available methods:', Object.keys(session));
                    }
                  }).catch(err => {
                    console.error('Error sending tool response:', err);
                  });
                } catch (error) {
                  console.error('Tool call error:', error);
                }
              }
            }
          },
          onclose: (event: any) => {
            const details = event ? `Code: ${event.code}, Reason: ${event.reason || 'none'}` : 'No event details';
            console.warn('[LiveAPI] ❌ Session CLOSED.', details);
            console.warn('[LiveAPI] AudioContext states at close - input:', inputAudioContextRef.current?.state, 'output:', outputAudioContextRef.current?.state);
            console.warn('[LiveAPI] Was audio sending?', isAudioSendingRef.current);
            console.warn('[LiveAPI] Stream tracks active?', streamRef.current?.getAudioTracks().map(t => ({ enabled: t.enabled, readyState: t.readyState })));
            disconnect();
          },
          onerror: (err: any) => {
            console.error('[LiveAPI] ❌ Session ERROR:', err);
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

      // Wait for session to actually resolve and store it
      sessionPromiseRef.current = sessionPromise;
      const resolvedSession = await sessionPromise;
      resolvedSessionRef.current = resolvedSession;
      console.log('[LiveAPI] Step 5: Session promise resolved successfully');

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[LiveAPI] ❌ CONNECTION FAILED:', errMsg);
      console.error('[LiveAPI] Full error:', error);
      console.error('[LiveAPI] Debug info:', {
        inputCtxState: inputAudioContextRef.current?.state,
        outputCtxState: outputAudioContextRef.current?.state,
        streamActive: streamRef.current?.active,
        streamTracks: streamRef.current?.getAudioTracks().map(t => t.readyState),
      });
      disconnect();
    }
  }, [disconnect, processAudioQueue]);

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