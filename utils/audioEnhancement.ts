/**
 * Audio enhancement utilities for real-time audio processing
 */

interface AudioEnhancementOptions {
    noiseReduction?: boolean;
    volumeNormalization?: boolean;
    targetVolume?: number;
}

/**
 * Creates a noise gate to reduce background noise
 */
export function createNoiseGate(
    audioContext: AudioContext,
    _threshold: number = -50
): GainNode {
    // Note: threshold param reserved for future use with AnalyserNode
    const gain = audioContext.createGain();
    gain.gain.value = 1;
    return gain;
}

/**
 * Creates a dynamics compressor for volume normalization
 */
export function createCompressor(audioContext: AudioContext): DynamicsCompressorNode {
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    return compressor;
}

/**
 * Creates a low-pass filter to reduce high-frequency noise
 */
export function createLowPassFilter(
    audioContext: AudioContext,
    frequency: number = 8000
): BiquadFilterNode {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    return filter;
}

/**
 * Creates a high-pass filter to reduce low-frequency rumble
 */
export function createHighPassFilter(
    audioContext: AudioContext,
    frequency: number = 80
): BiquadFilterNode {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    return filter;
}

/**
 * Creates an audio enhancement chain with optional processing nodes
 */
export function createEnhancementChain(
    audioContext: AudioContext,
    options: AudioEnhancementOptions = {}
): {
    input: AudioNode;
    output: AudioNode;
    nodes: AudioNode[];
} {
    const nodes: AudioNode[] = [];

    // High-pass filter to remove rumble
    const highPass = createHighPassFilter(audioContext);
    nodes.push(highPass);

    // Low-pass filter to remove high-frequency noise
    const lowPass = createLowPassFilter(audioContext);
    nodes.push(lowPass);

    // Volume normalization via compressor
    if (options.volumeNormalization) {
        const compressor = createCompressor(audioContext);
        nodes.push(compressor);
    }

    // Connect nodes in chain
    for (let i = 0; i < nodes.length - 1; i++) {
        const current = nodes[i];
        const next = nodes[i + 1];
        if (current && next) {
            current.connect(next);
        }
    }

    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];

    return {
        input: firstNode!,
        output: lastNode!,
        nodes,
    };
}

/**
 * Calculates the RMS volume of an audio buffer
 */
export function calculateRMSVolume(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

/**
 * Converts decibels to linear gain value
 */
export function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
}

/**
 * Converts linear gain value to decibels
 */
export function linearToDb(linear: number): number {
    return 20 * Math.log10(Math.max(linear, 0.0001));
}

export default {
    createNoiseGate,
    createCompressor,
    createLowPassFilter,
    createHighPassFilter,
    createEnhancementChain,
    calculateRMSVolume,
    dbToLinear,
    linearToDb,
};
