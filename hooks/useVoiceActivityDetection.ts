import { useState, useRef, useCallback, useEffect } from 'react';

interface VADOptions {
    /** Multiplicador do noise floor para threshold (default: 3.0) */
    thresholdMultiplier?: number;
    /** Duração mínima de fala para considerar "está falando" (ms) */
    minSpeechDurationMs?: number;
    /** Duração do warmup para calibrar noise floor (ms) */
    warmupMs?: number;
    /** Callback direto quando voz é detectada por tempo suficiente (interrupt) */
    onVoiceDetected?: () => void;
    /** Callback quando usuário começa a falar (para ducking) */
    onVoiceStart?: () => void;
    /** Callback quando usuário para de falar (para restore volume) */
    onVoiceEnd?: () => void;
}

interface VADResult {
    volume: number;
    noiseFloor: number;
    isCalibrated: boolean;
    isActive: boolean;
    startVAD: (stream: MediaStream) => void;
    stopVAD: () => void;
    pauseVAD: () => void;
    resumeVAD: () => void;
}

const DEFAULT_THRESHOLD_MULTIPLIER = 3.0;
const DEFAULT_MIN_SPEECH_MS = 300;
const DEFAULT_WARMUP_MS = 3000;

/**
 * VAD com threshold adaptativo e callback direto
 * 
 * Funciona assim:
 * 1. Nos primeiros `warmupMs` ms, mede o ruído de fundo (noise floor)
 * 2. Após calibração, threshold = noiseFloor * thresholdMultiplier
 * 3. Se volume > threshold por > minSpeechDurationMs → chama onVoiceDetected()
 * 4. Pode ser pausado durante TTS para evitar falsos positivos
 * 
 * NÃO usa React state para trigger — callback direto, sem re-render
 */
export function useVoiceActivityDetection(options: VADOptions = {}): VADResult {
    const {
        thresholdMultiplier = DEFAULT_THRESHOLD_MULTIPLIER,
        minSpeechDurationMs = DEFAULT_MIN_SPEECH_MS,
        warmupMs = DEFAULT_WARMUP_MS,
        onVoiceDetected,
        onVoiceStart,
        onVoiceEnd,
    } = options;

    const [volume, setVolume] = useState(0);
    const [noiseFloor, setNoiseFloor] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isCalibrated, setIsCalibrated] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const speechStartRef = useRef<number | null>(null);
    
    // Adaptive noise floor
    const noiseFloorRef = useRef(0.001);
    const noiseFloorSamplesRef = useRef<number[]>([]);
    const startTimeRef = useRef(0);
    const isCalibratedRef = useRef(false);
    
    // Pause/resume
    const pausedRef = useRef(false);
    
    // Callback refs (always current, no stale closure)
    const onVoiceDetectedRef = useRef(onVoiceDetected);
    onVoiceDetectedRef.current = onVoiceDetected;
    const onVoiceStartRef = useRef(onVoiceStart);
    onVoiceStartRef.current = onVoiceStart;
    const onVoiceEndRef = useRef(onVoiceEnd);
    onVoiceEndRef.current = onVoiceEnd;
    
    // Cooldown para evitar trigger repetido
    const lastTriggerRef = useRef(0);
    const TRIGGER_COOLDOWN_MS = 2000;
    
    // Voice start/end tracking for ducking
    const wasSpeakingRef = useRef(false);
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
        wasSpeakingRef.current = false;
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current?.state !== 'closed') {
            audioContextRef.current?.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        noiseFloorSamplesRef.current = [];
        isCalibratedRef.current = false;
        pausedRef.current = false;
        setIsActive(false);
        setIsCalibrated(false);
        setVolume(0);
        setNoiseFloor(0);
    }, []);

    const startVAD = useCallback((stream: MediaStream) => {
        cleanup();

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;
        startTimeRef.current = Date.now();
        noiseFloorRef.current = 0.001;
        noiseFloorSamplesRef.current = [];
        isCalibratedRef.current = false;
        pausedRef.current = false;
        lastTriggerRef.current = 0;
        setIsActive(true);
        setIsCalibrated(false);

        const dataArray = new Float32Array(analyser.frequencyBinCount);
        const ALPHA = 0.97;

        const analyze = () => {
            if (!analyserRef.current) return;
            
            // Se pausado, continuar o loop mas não processar
            if (pausedRef.current) {
                speechStartRef.current = null; // Reset speech tracking
                animationFrameRef.current = requestAnimationFrame(analyze);
                return;
            }

            analyserRef.current.getFloatTimeDomainData(dataArray);

            // Calculate RMS volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const sample = dataArray[i];
                if (sample !== undefined) {
                    sum += sample * sample;
                }
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setVolume(rms);

            const elapsed = Date.now() - startTimeRef.current;

            // FASE 1: Warmup — calibrar noise floor
            if (elapsed < warmupMs) {
                noiseFloorSamplesRef.current.push(rms);
                
                if (noiseFloorSamplesRef.current.length > 10) {
                    const sorted = [...noiseFloorSamplesRef.current].sort((a, b) => a - b);
                    const p75Index = Math.floor(sorted.length * 0.75);
                    const p75 = sorted[p75Index] ?? sorted[sorted.length - 1] ?? 0.001;
                    noiseFloorRef.current = Math.max(p75, 0.001);
                    setNoiseFloor(noiseFloorRef.current);
                }
                
                animationFrameRef.current = requestAnimationFrame(analyze);
                return;
            }

            // FASE 2: Calibração completa
            if (!isCalibratedRef.current) {
                isCalibratedRef.current = true;
                setIsCalibrated(true);
                console.log(`[VAD] Calibrado! Noise floor: ${noiseFloorRef.current.toFixed(4)}, Threshold: ${(noiseFloorRef.current * thresholdMultiplier).toFixed(4)}`);
            }

            // FASE 3: Detecção de fala — threshold com floor mínimo de segurança
            const MIN_THRESHOLD = 0.08; // Nunca cai abaixo disso — filtra eco do TTS pelo speaker
            const currentThreshold = Math.max(noiseFloorRef.current * thresholdMultiplier, MIN_THRESHOLD);
            const isAboveThreshold = rms > currentThreshold;

            if (isAboveThreshold) {
                // Cancelar timeout de silêncio
                if (silenceTimeoutRef.current) {
                    clearTimeout(silenceTimeoutRef.current);
                    silenceTimeoutRef.current = null;
                }

                // NÃO atualizar noise floor durante fala — só durante silêncio

                if (!speechStartRef.current) {
                    speechStartRef.current = Date.now();
                }

                // Voice START — dispara ducking imediatamente
                if (!wasSpeakingRef.current) {
                    wasSpeakingRef.current = true;
                    onVoiceStartRef.current?.();
                }

                const speechDuration = Date.now() - speechStartRef.current;
                if (speechDuration >= minSpeechDurationMs) {
                    // Verificar cooldown
                    const timeSinceLastTrigger = Date.now() - lastTriggerRef.current;
                    if (timeSinceLastTrigger > TRIGGER_COOLDOWN_MS) {
                        lastTriggerRef.current = Date.now();
                        console.log(`[VAD] Voz detectada! RMS: ${rms.toFixed(4)}, Threshold: ${currentThreshold.toFixed(4)}`);
                        onVoiceDetectedRef.current?.();
                    }
                    speechStartRef.current = null;
                }
            } else {
                // Atualizar noise floor APENAS durante silêncio (nunca durante fala)
                noiseFloorRef.current = ALPHA * noiseFloorRef.current + (1 - ALPHA) * rms;
                // Garantir que noise floor nunca caia abaixo de um mínimo
                noiseFloorRef.current = Math.max(noiseFloorRef.current, 0.0005);
                setNoiseFloor(noiseFloorRef.current);
                speechStartRef.current = null;

                // Voice END — debounce antes de restaurar volume
                if (wasSpeakingRef.current && !silenceTimeoutRef.current) {
                    silenceTimeoutRef.current = setTimeout(() => {
                        wasSpeakingRef.current = false;
                        silenceTimeoutRef.current = null;
                        onVoiceEndRef.current?.();
                    }, 400);
                }
            }

            animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
    }, [thresholdMultiplier, minSpeechDurationMs, warmupMs, cleanup]);

    const stopVAD = useCallback(() => {
        cleanup();
    }, [cleanup]);

    const pauseVAD = useCallback(() => {
        pausedRef.current = true;
        console.log('[VAD] Pausado');
    }, []);

    const resumeVAD = useCallback(() => {
        pausedRef.current = false;
        speechStartRef.current = null;
        console.log('[VAD] Retomado');
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    return { volume, noiseFloor, isCalibrated, isActive, startVAD, stopVAD, pauseVAD, resumeVAD };
}

export default useVoiceActivityDetection;
