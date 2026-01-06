import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, decodeAudioData, createPcmBlob } from '../utils/audio-utils';
import { LiveConfig } from '../types';

interface UseLiveAPIResult {
  connected: boolean;
  isMuted: boolean;
  volume: number;
  transcript: string;
  connect: (config: LiveConfig) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

export const useLiveAPI = (): UseLiveAPIResult => {
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Track state for cleanup and logic
  const isMutedRef = useRef(false);
  const currentSpeakerRef = useRef<'user' | 'gemini' | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Volume calculation helper
  const updateVolume = useCallback((data: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    const vol = Math.min(rms * 5, 1);
    setVolume(prev => prev * 0.8 + vol * 0.2);
  }, []);

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
    setVolume(0);
    setIsMuted(false);
    // Do not clear transcript here, we might want to save it
    currentSpeakerRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const connect = useCallback(async (config: LiveConfig) => {
    try {
      // Prioritize user-configured API key over environment variable
      const apiKey = config.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please configure your API key in Settings > Account or set VITE_GEMINI_API_KEY environment variable.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      nextStartTimeRef.current = 0;
      setTranscript('');
      currentSpeakerRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened");
            setConnected(true);

            if (!inputAudioContextRef.current) return;

            inputSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              if (isMutedRef.current) {
                setVolume(0);
                return;
              }

              updateVolume(inputData);

              const pcmBlob = createPcmBlob(inputData);
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
                // Determine if we need to switch speaker labels
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
              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(base64Audio),
                ctx,
                24000,
                1
              );

              const channelData = audioBuffer.getChannelData(0);
              updateVolume(channelData.slice(0, 1000));

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
              // Note: We do NOT clear transcript on interrupt to keep history
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
          inputAudioTranscription: {}, // Request user transcription
          outputAudioTranscription: {}, // Request model transcription
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
  }, [disconnect, updateVolume]);

  return {
    connected,
    isMuted,
    volume,
    transcript,
    connect,
    disconnect,
    toggleMute
  };
};