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
function buildAdvancedSystemInstruction(baseInstruction: string): string {
  return `${baseInstruction}

CAPACIDADES AVANÇADAS (use silenciosamente):
1. Acesso a histórico de conversas (functions)
2. Busca na web em tempo real (Google Search)

INÍCIO DE CONVERSA:
- Chame get_conversation_history(days=7) para entender o contexto
- Use o histórico para uma saudação personalizada se houver conversas anteriores
- Seja natural, não mencione que está "buscando dados" ou "analisando"

BUSCA NA WEB (Google Search):
- Se o usuário perguntar sobre notícias, eventos atuais, preços, clima, ou qualquer informação que possa mudar com o tempo, USE A BUSCA
- NÃO invente informações - se não tiver certeza, busque
- Quando usar a busca, diga brevemente "deixa eu verificar isso..." ou algo natural
- Cite as fontes quando relevante

PADRÕES PARA FUNCTIONS:
- Histórico genérico → 30 dias
- "Última conversa" → 1 dia
- NÃO pergunte qual período - use os padrões acima`;
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
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);

  // Wake Lock for mobile (keeps screen on)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const disconnect = useCallback(() => {
    console.log('📴 Disconnecting session...');

    // Release Wake Lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        console.log('🔓 Wake Lock released');
      }).catch(() => { });
      wakeLockRef.current = null;
    }

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
      setIsConnecting(true); // Start loading
      setCurrentConfig(config);

      // Prioritize user-configured API key over environment variable
      const apiKey = config.apiKey || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please configure your API key in Settings > Account or set VITE_GEMINI_API_KEY environment variable.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass();
      outputAudioContextRef.current = new AudioContextClass();

      // Register AudioWorklet
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);

      // Setup Input Analyser
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;

      // Setup Output Analyser
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;

      const outputNode = outputAudioContextRef.current.createGain();
      outputGainNodeRef.current = outputNode; // Store reference for speaker control
      outputNode.connect(outputAnalyserRef.current); // Connect through analyser
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      nextStartTimeRef.current = 0;
      setTranscript('');
      currentSpeakerRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
            }
          ]
        });
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: async () => {
            console.log("🟢 Live Session Opened");
            setConnected(true);
            setIsConnecting(false); // Stop loading

            // Request Wake Lock to keep screen on (mobile)
            try {
              if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('🔒 Wake Lock acquired - screen will stay on');

                wakeLockRef.current.addEventListener('release', () => {
                  console.log('⚠️ Wake Lock was released by system');
                });
              }
            } catch (err) {
              console.warn('Wake Lock not supported or denied:', err);
            }

            if (!inputAudioContextRef.current) return;

            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
            // Connect input to analyser for visualization
            if (inputAnalyserRef.current) {
              inputSourceRef.current.connect(inputAnalyserRef.current);
            }

            // Replace ScriptProcessor with AudioWorklet
            audioWorkletNodeRef.current = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor');

            audioWorkletNodeRef.current.port.onmessage = (event) => {
              const inputData = event.data as Float32Array;

              if (isMutedRef.current) {
                return;
              }

              // Pass the native sample rate for automatic resampling to 16kHz
              const nativeSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
              const pcmBlob = createPcmBlob(inputData, nativeSampleRate);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            inputSourceRef.current.connect(audioWorkletNodeRef.current);
            audioWorkletNodeRef.current.connect(inputAudioContextRef.current.destination); // Connect to destination to keep graph alive, though we don't output audio
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
          onclose: (event?: any) => {
            console.log("🔴 Live Session Closed", event ? `Code: ${event.code}, Reason: ${event.reason}` : '');
            disconnect();
          },
          onerror: (err) => {
            console.error("🔴 Live Session Error:", err);
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: config.enableAdvancedFeatures
            ? buildAdvancedSystemInstruction(config.systemInstruction)
            : config.systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
          },
          ...(tools.length > 0 && { tools })
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
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