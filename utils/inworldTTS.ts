/**
 * inworldTTS - Utilitário para síntese de voz via Inworld TTS API
 * 
 * Features:
 * - AudioManager singleton com controle global
 * - TTS Chunked: divide texto em sentenças, gera áudio em paralelo (prefetch)
 * - Interrupt: cancela fila de chunks a qualquer momento
 * - stopSpeaking(): para tudo imediatamente
 */

const INWORLD_TTS_URL = 'https://apitts.ghost1.cloud';

export const DEFAULT_VOICE_ID = 'default--pb4bm1oowkem_r9ri2wiw__makoguren2';

export type TTSModel = 'inworld-tts-1.5-mini' | 'inworld-tts-1.5-max';

interface TTSRequest {
  chavesecreta: string;
  voz: string;
  texto: string;
  model?: TTSModel;
}

interface VoiceInfo {
  voiceId: string;
  displayName: string;
  languageCode: string;
}

interface TTSResponse {
  ok: boolean;
  audioUrl?: string;
  error?: string;
}

interface ChunkCallbacks {
  onChunkStart?: (chunkIndex: number, totalChunks: number) => void;
  onChunkEnd?: (chunkIndex: number, totalChunks: number) => void;
  onInterruptWindow?: () => void; // Called between chunks — STT should listen here
  onQueueComplete?: () => void;
  onCancelled?: () => void;
}

// ============================================================
// Text Splitting — divide texto em chunks para TTS rápido
// ============================================================

function splitTextIntoChunks(text: string, firstChunkMaxChars = 120, maxCharsPerChunk = 250): string[] {
  // Limpar texto
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Dividir por sentenças (. ! ? \n e também ; e :)
  const sentenceRegex = /[^.!?\n;]+[.!?\n;]*/g;
  const rawSentences = cleaned.match(sentenceRegex) || [cleaned];
  
  // Limpar sentenças
  const sentences = rawSentences
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) return [cleaned];

  // Agrupar sentenças em chunks
  const chunks: string[] = [];
  let currentChunk = '';
  const isFirstChunk = () => chunks.length === 0;

  for (const sentence of sentences) {
    const maxChars = isFirstChunk() ? firstChunkMaxChars : maxCharsPerChunk;
    
    if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================
// AudioManager Singleton
// ============================================================

class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAbortController: AbortController | null = null;
  private _isPlaying = false;
  private _isCancelled = false;
  private chunkQueue: string[] = [];
  private prefetchedAudio: Map<number, string> = new Map();
  private totalChunks = 0;
  private chunkCallbacks: ChunkCallbacks | null = null;
  private secretKey = '';
  private voiceId = '';
  private model: TTSModel = 'inworld-tts-1.5-mini';
  
  // Web Audio ducking
  private audioCtx: AudioContext | null = null;
  private ttsGainNode: GainNode | null = null;

  /** Get or create AudioContext + GainNode for ducking */
  private getOrCreateContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContext();
      this.ttsGainNode = this.audioCtx.createGain();
      this.ttsGainNode.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  private _isDucked = false;

  /** Duck TTS volume — exponential ramp for natural sound */
  duckVolume(targetGain: number = 0.35, durationSec: number = 0.3): void {
    if (this._isDucked) return;
    if (!this.ttsGainNode || !this.audioCtx) return;
    this._isDucked = true;
    const ctx = this.audioCtx;
    this.ttsGainNode.gain.setValueAtTime(this.ttsGainNode.gain.value, ctx.currentTime);
    this.ttsGainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetGain, 0.001), // exponential não aceita 0
      ctx.currentTime + durationSec
    );
    console.log(`[AudioManager] Duck → ${(targetGain * 100).toFixed(0)}%`);
  }

  /** Restore TTS volume — smooth exponential ramp */
  restoreVolume(durationSec: number = 0.5): void {
    if (!this.ttsGainNode || !this.audioCtx) return;
    this._isDucked = false;
    const ctx = this.audioCtx;
    this.ttsGainNode.gain.setValueAtTime(this.ttsGainNode.gain.value, ctx.currentTime);
    this.ttsGainNode.gain.exponentialRampToValueAtTime(
      1.0,
      ctx.currentTime + durationSec
    );
  }

  /** Reset duck state — call when TTS queue completes or is cancelled */
  resetDuckState(): void {
    this._isDucked = false;
  }

  /** Para o áudio atual e cancela toda a fila */
  stopSpeaking(): void {
    this._isCancelled = true;

    // Cancelar fetch em andamento
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // Parar áudio em reprodução
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        if (this.currentAudio.src && this.currentAudio.src.startsWith('blob:')) {
          URL.revokeObjectURL(this.currentAudio.src);
        }
      } catch (e) {
        console.warn('[AudioManager] Erro ao parar áudio:', e);
      }
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }

    // Limpar prefetch
    for (const [, url] of this.prefetchedAudio) {
      try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }
    this.prefetchedAudio.clear();

    // Limpar fila
    this.chunkQueue = [];
    this._isPlaying = false;

    const callbacks = this.chunkCallbacks;
    this.chunkCallbacks = null;

    if (callbacks?.onCancelled) {
      callbacks.onCancelled();
    }

    console.log('[AudioManager] Tudo parado e fila cancelada');
  }

  isPlaying(): boolean {
    return this._isPlaying;
  }

  isCancelled(): boolean {
    return this._isCancelled;
  }

  /** Cria AbortController para fetch */
  private createAbortController(): AbortController {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();
    return this.currentAbortController;
  }

  /** Fetch de um chunk de áudio */
  private async fetchChunkAudio(text: string): Promise<string | null> {
    if (this._isCancelled) return null;

    const abortController = this.createAbortController();

    try {
      const response = await fetch(INWORLD_TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chavesecreta: this.secretKey,
          voz: this.voiceId,
          texto: text.slice(0, 2000),
          model: this.model,
        } as TTSRequest),
        signal: abortController.signal,
      });

      if (!response.ok) {
        console.error('[TTS] HTTP', response.status);
        return null;
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
      console.error('[TTS] Fetch error:', error);
      return null;
    }
  }

  /** Reproduz um áudio e retorna Promise — roteado pelo GainNode para ducking */
  private playAudioUrl(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._isCancelled) {
        URL.revokeObjectURL(audioUrl);
        resolve();
        return;
      }

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      this._isPlaying = true;

      // Rotear pelo GainNode para ducking funcionar
      try {
        const ctx = this.getOrCreateContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const source = ctx.createMediaElementSource(audio);
        source.connect(this.ttsGainNode!);
      } catch (e) {
        // Fallback: se não conseguir rotear, toca direto
        console.warn('[AudioManager] Fallback: tocando sem GainNode', e);
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        reject(e);
      };

      audio.play().catch((err) => {
        this.currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        reject(err);
      });
    });
  }

  /** Prefetch do próximo chunk em background */
  private async prefetchNext(index: number): Promise<void> {
    if (index >= this.chunkQueue.length || this._isCancelled) return;
    if (this.prefetchedAudio.has(index)) return;

    const text = this.chunkQueue[index];
    if (!text) return;

    const audioUrl = await this.fetchChunkAudio(text);
    if (audioUrl && !this._isCancelled) {
      this.prefetchedAudio.set(index, audioUrl);
    }
  }

  /**
   * Fala texto em chunks com prefetch e interrupt
   * Divide o texto em sentenças, gera áudio em paralelo, reproduz conforme ficam prontos
   */
  async speakChunked(
    text: string,
    secretKey: string,
    voiceId: string = DEFAULT_VOICE_ID,
    model: TTSModel = 'inworld-tts-1.5-mini',
    callbacks?: ChunkCallbacks
  ): Promise<void> {
    // Parar qualquer reprodução anterior
    this.stopSpeaking();

    // Reset state
    this._isCancelled = false;
    this.secretKey = secretKey;
    this.voiceId = voiceId;
    this.model = model;
    this.chunkCallbacks = callbacks || null;

    // Dividir texto em chunks
    this.chunkQueue = splitTextIntoChunks(text);
    this.totalChunks = this.chunkQueue.length;
    if (this.chunkQueue.length === 0) {
      callbacks?.onQueueComplete?.();
      return;
    }

    console.log(`[AudioManager] Iniciando TTS chunked: ${this.totalChunks} chunks`);

    // Processar fila de chunks
    for (let i = 0; i < this.chunkQueue.length; i++) {
      if (this._isCancelled) break;

      // Notificar início do chunk
      callbacks?.onChunkStart?.(i, this.totalChunks);

      // Obter áudio (do prefetch ou fetch novo)
      let audioUrl: string | null = this.prefetchedAudio.get(i) || null;
      if (!audioUrl) {
        audioUrl = await this.fetchChunkAudio(this.chunkQueue[i]!);
      }
      this.prefetchedAudio.delete(i);

      if (!audioUrl || this._isCancelled) break;

      // Iniciar prefetch do próximo chunk em background
      if (i + 1 < this.chunkQueue.length) {
        this.prefetchNext(i + 1); // Fire and forget
      }

      // Reproduzir chunk
      try {
        await this.playAudioUrl(audioUrl);
      } catch (e) {
        console.warn('[AudioManager] Erro ao reproduzir chunk', i, e);
      }

      if (this._isCancelled) break;

      // Notificar fim do chunk
      callbacks?.onChunkEnd?.(i, this.totalChunks);

      // JANELA DE INTERRUPT: entre chunks, ativar STT brevemente
      if (i + 1 < this.chunkQueue.length && !this._isCancelled) {
        callbacks?.onInterruptWindow?.();
        // Pequena pausa para dar tempo ao STT detectar fala
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (this._isCancelled) break;
    }

    this._isPlaying = false;

    if (!this._isCancelled) {
      callbacks?.onQueueComplete?.();
      console.log('[AudioManager] Fila de chunks completa');
    }
  }

  /** Reproduz áudio simples (sem chunks) */
  async playAudio(audioUrl: string, onEnd?: () => void): Promise<void> {
    this.stopSpeaking();
    this._isCancelled = false;

    try {
      await this.playAudioUrl(audioUrl);
    } catch (e) {
      console.warn('[AudioManager] Erro ao reproduzir:', e);
    } finally {
      this._isPlaying = false;
      onEnd?.();
    }
  }
}

// Singleton global
export const audioManager = new AudioManager();

// ============================================================
// Funções exportadas
// ============================================================

export async function synthesizeSpeech(
  text: string,
  secretKey: string,
  voiceId: string = DEFAULT_VOICE_ID,
  model: TTSModel = 'inworld-tts-1.5-mini'
): Promise<TTSResponse> {
  if (!secretKey) {
    return { ok: false, error: 'Secret key não fornecida' };
  }

  try {
    const response = await fetch(INWORLD_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chavesecreta: secretKey,
        voz: voiceId,
        texto: text.slice(0, 2000),
        model,
      } as TTSRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    return { ok: true, audioUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, error: errorMessage };
  }
}

export async function listVoices(secretKey: string): Promise<VoiceInfo[] | null> {
  if (!secretKey) {
    console.warn('[TTS] Secret key não fornecida para listar vozes');
    return null;
  }

  try {
    const response = await fetch(`${INWORLD_TTS_URL}/vozes`, {
      method: 'GET',
      headers: { 'x-secret': secretKey },
    });

    if (!response.ok) {
      console.error('[TTS] Erro ao listar vozes:', response.status);
      return null;
    }

    const data = await response.json();
    return data.voices || data || [];
  } catch (error) {
    console.error('[TTS] Erro ao listar vozes:', error);
    return null;
  }
}

export function stopSpeaking(): void {
  audioManager.stopSpeaking();
}

export function isPlaying(): boolean {
  return audioManager.isPlaying();
}

/**
 * Fala texto em chunks com prefetch e interrupt
 */
export async function speakChunked(
  text: string,
  secretKey: string,
  voiceId: string = DEFAULT_VOICE_ID,
  model: TTSModel = 'inworld-tts-1.5-mini',
  callbacks?: ChunkCallbacks
): Promise<void> {
  return audioManager.speakChunked(text, secretKey, voiceId, model, callbacks);
}

/**
 * Fala texto simples (sem chunks) — para textos curtos
 */
export async function speakText(
  text: string,
  secretKey: string,
  voiceId: string = DEFAULT_VOICE_ID,
  model: TTSModel = 'inworld-tts-1.5-mini',
  onEnd?: () => void
): Promise<void> {
  const result = await synthesizeSpeech(text, secretKey, voiceId, model);
  if (!result.ok || !result.audioUrl) {
    onEnd?.();
    throw new Error(result.error || 'Falha ao gerar áudio');
  }
  await audioManager.playAudio(result.audioUrl, onEnd);
}

export function playAudio(audioUrl: string, onEnd?: () => void): Promise<void> {
  return audioManager.playAudio(audioUrl, onEnd);
}

export default {
  synthesizeSpeech,
  listVoices,
  playAudio,
  speakText,
  speakChunked,
  stopSpeaking,
  isPlaying,
  audioManager,
  DEFAULT_VOICE_ID,
};
