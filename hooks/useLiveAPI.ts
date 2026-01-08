import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob, resampleAudioBuffer } from '../utils/audio-utils';
import { LiveConfig } from '../types';

interface UseLiveAPIResult {
  connected: boolean;
  isConnecting: boolean; // New state
  isMuted: boolean;
  volume: number;
  transcript: string;
  config: LiveConfig | null;
  audioCtx: AudioContext | null; // Expose AudioContext
  connect: (config: LiveConfig) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  getAnalysers: () => { input: AnalyserNode | null, output: AnalyserNode | null };
}

export const useLiveAPI = (): UseLiveAPIResult => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // Add loading state
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [currentConfig, setCurrentConfig] = useState<LiveConfig | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Analyser for visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Track state for cleanup and logic
  const isMutedRef = useRef(false);
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Use the output context for the visualizer as it's usually the "main" one for playback
  // However, we can expose whichever is active.
  // For the purpose of the UI, we just need to expose the Context so the Visualizer can create its own analyser 
  // or we expose the analysers we created.
  
  const disconnect = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
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

  const connect = useCallback(async (config: LiveConfig) => {
    try {
      setIsConnecting(true); // Start loading
      setCurrentConfig(config);

      // Prioritize user-configured API key over environment variable (defined at build time)
      const apiKey = config.apiKey || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please configure your API key in Settings > Account or set VITE_GEMINI_API_KEY environment variable.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass();
      outputAudioContextRef.current = new AudioContextClass();

      // Setup Input Analyser
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      inputAnalyserRef.current.smoothingTimeConstant = 0.5;

      // Setup Output Analyser
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputAnalyserRef.current.smoothingTimeConstant = 0.5;

      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAnalyserRef.current); // Connect through analyser
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      nextStartTimeRef.current = 0;
      setTranscript('');
      currentSpeakerRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025', // Updated model
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened");
            setConnected(true);
            setIsConnecting(false); // Stop loading

            if (!inputAudioContextRef.current) return;

            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
            // Connect input to analyser for visualization
            if (inputAnalyserRef.current) {
                inputSourceRef.current.connect(inputAnalyserRef.current);
            }
            
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              if (isMutedRef.current) {
                // If muted, we might still want visualizer to show "silence" or handled by Visualizer component
                return;
              }

              // Pass the native sample rate for automatic resampling to 16kHz
              const nativeSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
              const pcmBlob = createPcmBlob(inputData, nativeSampleRate);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            inputSourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
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

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;

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
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(src => src.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Live Session Closed");
            disconnect();
          },
          onerror: (err) => {
            console.error("Live Session Error", err);
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: config.systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } }
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
      disconnect();
    }
  }, [disconnect]);

  // Helper method to access analysers from the component
  // We attach this to the AudioContext object effectively by proxy, or we could return refs
  // To keep the API clean, we will return the active audioContext or a method to get data
  
  // Actually, React components can't easily read Refs from hooks if they change.
  // We will patch the `audioCtx` return to include a `getAnalyser` function.
  const getAnalyser = () => {
      // Return output analyser if Gemini is speaking (or just default to it), 
      // return input analyser if we want to visualize user mic.
      // For a simple "Siri" wave, we often visualize both or mix them. 
      // Since they are separate contexts, we return both or a composite object.
      return {
          input: inputAnalyserRef.current,
          output: outputAnalyserRef.current
      }
  }

  // We add this custom property to the returned object
  return {
    connected,
    isConnecting,
    isMuted,
    volume,
    transcript,
    config: currentConfig,
    audioCtx: outputAudioContextRef.current, // mainly for timing
    getAnalysers: getAnalyser,
    connect,
    disconnect,
    toggleMute
  };
};