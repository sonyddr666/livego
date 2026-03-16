/**
 * useSpeechRecognition - Hook para reconhecimento de voz (STT)
 * Usa Web Speech API do Chrome/Browser
 * 
 * Melhorias:
 * - abort() + destroy para parada garantida
 * - pauseListening/resumeListening para coordenar com TTS
 * - Guard contra restart indesejado no onend
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// Tipos para Web Speech API
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

// Tipo para o objeto global
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface UseSpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  pauseListening: () => void;
  resumeListening: () => void;
  resetTranscript: () => void;
}

// Evento emitido quando nova fala é reconhecida
export const SPEECH_READY_EVENT = 'livego:speech_ready';

export const useSpeechRecognition = (): UseSpeechRecognitionResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isPausedRef = useRef(false); // Pausa temporária (durante TTS)
  const finalTranscriptRef = useRef('');
  const instanceIdRef = useRef(0); // Guard contra restart de instância antiga

  // Destruir instância atual do recognition
  const destroyRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  // Inicializar reconhecimento de voz
  const initRecognition = useCallback((): SpeechRecognition | null => {
    // Destruir instância anterior
    destroyRecognition();

    // Verificar suporte
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      setError('Speech Recognition não suportada neste navegador');
      return null;
    }

    const recognition = new SpeechRecognitionClass();
    const myInstanceId = ++instanceIdRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR'; // Português do Brasil
    
    // Handler para resultados
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Guard: ignorar se pausado ou se instância mudou
      if (isPausedRef.current || instanceIdRef.current !== myInstanceId) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result[0]) continue;
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      // Atualizar transcrição intermediária (não final)
      setInterimTranscript(interim);

      // Se houver texto final, adicionar e enviar para o app
      if (final) {
        const fullTranscript = finalTranscriptRef.current + ' ' + final;
        finalTranscriptRef.current = fullTranscript;
        setTranscript(fullTranscript);
        setInterimTranscript('');

        // Emitir evento para o app processar
        window.dispatchEvent(new CustomEvent(SPEECH_READY_EVENT, {
          detail: { transcript: final.trim() } // Enviar apenas o texto novo, não acumulado
        }));
      }
    };

    // Handler para erros
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Erros comuns que não devem parar o reconhecimento
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // no-speech: ninguém falou durante a janela — normal
        // aborted: reconhecimento foi abortado intencionalmente — normal
        return;
      }
      
      console.error('[STT] Erro:', event.error);
      
      setError(event.error);
      setIsListening(false);
      isListeningRef.current = false;
    };

    // Handler quando reconhecimento para
    recognition.onend = () => {
      // Guard: não reiniciar se instância mudou
      if (instanceIdRef.current !== myInstanceId) return;

      // Se ainda deveria estar ouvindo e não está pausado, reiniciar
      if (isListeningRef.current && !isPausedRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error('[STT] Erro ao reiniciar:', e);
          // Se falhar ao reiniciar, tentar criar nova instância
          setTimeout(() => {
            if (isListeningRef.current && !isPausedRef.current) {
              recognitionRef.current = initRecognition();
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e2) {
                  console.error('[STT] Falha ao reiniciar com nova instância:', e2);
                }
              }
            }
          }, 200);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [destroyRecognition]);

  // Iniciar reconhecimento de voz
  const startListening = useCallback(() => {
    if (isListeningRef.current) return;

    isPausedRef.current = false;

    // Sempre criar nova instância para evitar estado corrompido
    recognitionRef.current = initRecognition();

    if (!recognitionRef.current) {
      setError('Não foi possível inicializar reconhecimento de voz');
      return;
    }

    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      console.log('[STT] Reconhecimento iniciado');
    } catch (e) {
      console.error('[STT] Erro ao iniciar:', e);
      setError('Erro ao iniciar reconhecimento');
    }
  }, [initRecognition]);

  // Parar reconhecimento de voz (definitivo)
  const stopListening = useCallback(() => {
    // Setar flags ANTES de abort para evitar restart no onend
    isListeningRef.current = false;
    isPausedRef.current = false;
    setIsListening(false);

    // Destruir instância completamente
    destroyRecognition();

    console.log('[STT] Reconhecimento parado (definitivo)');
  }, [destroyRecognition]);

  // Pausar reconhecimento temporariamente (durante TTS)
  const pauseListening = useCallback(() => {
    if (!isListeningRef.current) return;

    isPausedRef.current = true;
    
    // Parar o recognition mas manter isListeningRef = true
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
    }

    console.log('[STT] Reconhecimento pausado (TTS ativo)');
  }, []);

  // Retomar reconhecimento após pausa
  const resumeListening = useCallback(() => {
    if (!isListeningRef.current || !isPausedRef.current) return;

    isPausedRef.current = false;

    // Criar nova instância e iniciar
    recognitionRef.current = initRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        console.log('[STT] Reconhecimento retomado');
      } catch (e) {
        console.error('[STT] Erro ao retomar:', e);
      }
    }
  }, [initRecognition]);

  // Resetar transcrição
  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      isPausedRef.current = false;
      destroyRecognition();
    };
  }, [destroyRecognition]);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
};

export default useSpeechRecognition;
