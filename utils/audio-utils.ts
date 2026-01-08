import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Resamples audio data from source sample rate to target sample rate.
 * Uses linear interpolation for efficient real-time processing.
 */
export function resampleAudio(
  inputData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return inputData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.floor(inputData.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation between samples
    output[i] = inputData[srcIndexFloor] * (1 - fraction) + inputData[srcIndexCeil] * fraction;
  }

  return output;
}

/**
 * Creates a PCM blob for sending to Gemini API.
 * Automatically resamples from source sample rate to 16kHz (required by Gemini).
 */
export function createPcmBlob(data: Float32Array, sourceSampleRate: number = 16000): Blob {
  // Resample to 16kHz if necessary (Gemini expects 16kHz input)
  const resampledData = resampleAudio(data, sourceSampleRate, 16000);

  const l = resampledData.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to prevent overflow
    const sample = Math.max(-1, Math.min(1, resampledData[i]));
    int16[i] = sample * 32767;
  }
  return {
    data: arrayBufferToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Resamples an AudioBuffer to a target sample rate for playback.
 * Used to convert Gemini's 24kHz output to the system's native sample rate.
 */
export async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer;
  }

  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}