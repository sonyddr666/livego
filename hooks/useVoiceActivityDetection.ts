import { useState, useRef, useCallback, useEffect } from 'react';

interface VADOptions {
    threshold?: number;
    debounceMs?: number;
    minSpeechDurationMs?: number;
}

interface VADResult {
    isSpeaking: boolean;
    volume: number;
    startVAD: (stream: MediaStream) => void;
    stopVAD: () => void;
    isActive: boolean;
}

const DEFAULT_THRESHOLD = 0.02;
const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_MIN_SPEECH_MS = 100;

export function useVoiceActivityDetection(options: VADOptions = {}): VADResult {
    const {
        threshold = DEFAULT_THRESHOLD,
        debounceMs = DEFAULT_DEBOUNCE_MS,
        minSpeechDurationMs = DEFAULT_MIN_SPEECH_MS,
    } = options;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);
    const [isActive, setIsActive] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const speechStartRef = useRef<number | null>(null);
    const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current?.state !== 'closed') {
            audioContextRef.current?.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setIsActive(false);
        setIsSpeaking(false);
        setVolume(0);
    }, []);

    const startVAD = useCallback((stream: MediaStream) => {
        cleanup();

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;
        setIsActive(true);

        const dataArray = new Float32Array(analyser.frequencyBinCount);

        const analyze = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getFloatTimeDomainData(dataArray);

            // Calculate RMS volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setVolume(rms);

            const isAboveThreshold = rms > threshold;

            if (isAboveThreshold) {
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                }

                if (!speechStartRef.current) {
                    speechStartRef.current = Date.now();
                }

                const speechDuration = Date.now() - speechStartRef.current;
                if (speechDuration >= minSpeechDurationMs) {
                    setIsSpeaking(true);
                }
            } else {
                if (speechStartRef.current && !silenceTimeoutRef.current) {
                    silenceTimeoutRef.current = setTimeout(() => {
                        setIsSpeaking(false);
                        speechStartRef.current = null;
                        silenceTimeoutRef.current = null;
                    }, debounceMs);
                }
            }

            animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
    }, [threshold, debounceMs, minSpeechDurationMs, cleanup]);

    const stopVAD = useCallback(() => {
        cleanup();
    }, [cleanup]);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return { isSpeaking, volume, startVAD, stopVAD, isActive };
}

export default useVoiceActivityDetection;
