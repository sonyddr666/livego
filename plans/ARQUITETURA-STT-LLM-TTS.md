# Arquitetura Completa: STT → LLM → TTS

## Visão Geral

O LiveGo usa uma arquitetura de **voz-a-voz via texto**, onde três sistemas independentes trabalham em sequência:

```
[Microfone] → STT → [Texto] → LLM → [Texto] → TTS → [Speaker]
```

Cada sistema é um módulo separado:
- **STT** = Speech-to-Text (Web Speech API do Chrome)
- **LLM** = Large Language Model (Gemini 3.1 Flash Lite via REST API)
- **TTS** = Text-to-Speech (Inworld TTS API externa)

---

## 1. STT — Reconhecimento de Voz

**Arquivo**: `hooks/useSpeechRecognition.ts`

### O que faz
Escuta o microfone do usuário e converte fala em texto usando a Web Speech API nativa do Chrome.

### Como funciona
1. Cria instância de `SpeechRecognition` com `continuous: true` e `interimResults: true`
2. Quando detecta fala final (não intermediária), emite evento `SPEECH_READY_EVENT` com o texto
3. O App.tsx escuta esse evento e processa

### Estados
- **Listening**: STT ativo, escutando microfone
- **Paused**: STT temporariamente parado (durante TTS), mas pronto para retomar
- **Stopped**: STT completamente destruído (call encerrada)

### Funções principais
- `startListening()` — Cria nova instância e começa a escutar
- `stopListening()` — Destrói instância completamente (abort + null)
- `pauseListening()` — Para temporariamente (abort, mas mantém flag de "deveria estar ouvindo")
- `resumeListening()` — Cria nova instância e retoma após pausa
- `resetTranscript()` — Limpa texto acumulado

### Problema fundamental
O STT escuta TUDO que o microfone captura — incluindo o áudio do TTS saindo pelo speaker. Não há como filtrar. Por isso, o STT DEVE ser pausado enquanto o TTS está falando.

---

## 2. LLM — Modelo de Linguagem

**Arquivo**: `hooks/useChatAPI.ts`

### O que faz
Recebe texto do usuário, envia ao Gemini via REST API, e retorna a resposta em texto.

### Como funciona
1. Mantém histórico de mensagens (`historyRef`)
2. Envia request POST para `generativelanguage.googleapis.com`
3. Inclui `tools` (function declarations) para ghost_search, show_image, etc.
4. Se a resposta contém `functionCall`, executa a função e reenvia o resultado
5. Loop de até 5 iterações de tool calling
6. Retorna o texto final da resposta

### Function Calling
O Gemini pode chamar funções durante a conversa:
- `ghost_search` — Pesquisa avançada via Ghost-Search API
- `show_image` — Exibe imagem na tela
- `hide_image` — Remove imagem
- `fetch_page` — Lê conteúdo de uma URL
- `save_emotional_note` — Salva nota emocional
- `get_conversation_history` — Busca histórico

### Thinking Config
O modelo lite usa `thinkingBudget: 1024` para melhorar a qualidade das respostas sem demorar muito.

---

## 3. TTS — Síntese de Voz

**Arquivo**: `utils/inworldTTS.ts`

### O que faz
Converte texto em áudio usando a API Inworld TTS e reproduz pelo speaker.

### TTS Chunked (como funciona)
Para textos longos, o TTS divide em pedaços (chunks) e reproduz em sequência:

1. **Split**: Divide o texto em sentenças usando regex (`.` `!` `?` `\n`)
2. **Primeiro chunk menor** (~120 chars) para resposta rápida
3. **Demais chunks** até 250 chars cada
4. **Prefetch**: Enquanto chunk N toca, chunk N+1 já está sendo gerado
5. **Reprodução sequencial**: Chunk 1 → Chunk 2 → Chunk 3 → ...

### AudioManager Singleton
Controle global de reprodução:
- `stopSpeaking()` — Para áudio + cancela fetch + limpa fila + revoga blob URLs
- `isPlaying()` — Verifica se está reproduzindo
- `speakChunked()` — Processa fila de chunks com callbacks

### Callbacks
- `onChunkStart(i, total)` — Chunk começou a tocar
- `onQueueComplete()` — Todos os chunks terminaram
- `onCancelled()` — Fila foi cancelada (interrupt)

---

## 4. Coordenação no App.tsx

### Fluxo Normal (sem interrupt)

```
1. [STT ativo] Usuário fala "olá"
2. STT emite SPEECH_READY_EVENT com "olá"
3. App.tsx recebe evento
4. App.tsx chama pauseListening() — STT para
5. App.tsx chama sendMessage("olá") — envia ao Gemini
6. Gemini responde "Oi! Como posso ajudar?"
7. App.tsx chama speakChunked("Oi! Como posso ajudar?")
8. TTS divide em chunks e começa a reproduzir
9. [STT pausado durante toda a reprodução]
10. TTS termina → callback onQueueComplete
11. App.tsx chama resumeListening() — STT retoma
12. Volta ao passo 1
```

### Interrupt por Botão de Mute

```
1. TTS está falando (chunks 2/5)
2. Usuário clica botão MUTE
3. toggleMute() é chamado:
   - setIsMuted(true)
   - stopSpeaking() — para TTS imediatamente, cancela chunks 3,4,5
   - stopListening() — para STT
   - resetTranscript() — limpa texto
4. Usuário clica UNMUTE
5. toggleMute() é chamado:
   - setIsMuted(false)
   - resetTranscript()
   - startListening() — STT reinicia
6. Volta ao fluxo normal
```

### Interrupt por Voz (VAD)

```
1. TTS está falando
2. VAD monitora microfone continuamente
3. Usuário fala alto no mic (volume > 0.15 por > 400ms)
4. VAD detecta → vadSpeaking = true
5. useEffect dispara:
   - stopSpeaking() — para TTS
   - isProcessingRef = false — reseta flag
   - resetTranscript() — limpa texto antigo
   - resumeListening() — STT retoma
6. STT captura a fala do usuário
7. Novo ciclo: envia ao Gemini → resposta → TTS
```

### Interrupt por End Call

```
1. Usuário clica botão vermelho (End Call)
2. handleEndCall() é chamado:
   - stopSpeaking() — para TTS
   - stopListening() — para STT
   - stopVAD() — para VAD
   - disconnectChat() — desconecta Gemini
   - resetTranscript() — limpa texto
   - Libera mic stream
   - Salva histórico
   - Navega para HOME
```

---

## 5. Problema do Echo (Auto-escuta)

### O Problema
O microfone captura TUDO — incluindo o áudio do TTS saindo pelo speaker do computador. Isso causa:
- STT transcreve a fala do TTS como se fosse o usuário
- VAD detecta o TTS como "fala do usuário" e interrompe

### Soluções Implementadas

1. **STT pausado durante TTS**: O STT é completamente parado enquanto o TTS fala. Não há como o STT capturar a voz do TTS.

2. **VAD com threshold alto (0.15)**: O volume do TTS captado pelo mic é geralmente baixo (0.02-0.06). A voz do usuário falando diretamente no mic é alta (0.10-0.30). O threshold de 0.15 filtra o TTS.

3. **Cooldown de 2 segundos**: Após um interrupt por VAD, ignora novos triggers por 2s para evitar interrupt repetido.

4. **minSpeechDuration de 400ms**: Precisa falar por 400ms contínuos para interromper. Picos curtos de áudio são ignorados.

### Limitações
- Se o speaker estiver muito alto e perto do mic, o VAD pode detectar o TTS como fala
- Se o usuário estiver longe do mic, o VAD pode não detectar a fala
- Com fones de ouvido, o problema não existe (mic não captura o speaker)

### Ajuste do Threshold
O threshold pode ser ajustado em `App.tsx` na configuração do `useVoiceActivityDetection`:
- **0.08** — Sensível (bom com fones de ouvido)
- **0.15** — Padrão (bom para a maioria dos setups)
- **0.25** — Conservador (para speakers muito altos)
- **0.35** — Muito conservador (só detecta fala muito próxima ao mic)

---

## 6. Diagrama de Estados

```
                    ┌─────────────┐
                    │    IDLE     │
                    │ (Home)      │
                    └──────┬──────┘
                           │ Start Call
                           ▼
                    ┌─────────────┐
              ┌────►│  LISTENING  │◄────────────────┐
              │     │ (STT ativo) │                  │
              │     └──────┬──────┘                  │
              │            │ Fala detectada           │
              │            ▼                          │
              │     ┌─────────────┐                  │
              │     │ PROCESSING  │                  │
              │     │ (STT pausa) │                  │
              │     │ (LLM pensa) │                  │
              │     └──────┬──────┘                  │
              │            │ Resposta recebida        │
              │            ▼                          │
              │     ┌─────────────┐    TTS termina   │
              │     │  SPEAKING   │──────────────────┘
              │     │ (TTS fala)  │
              │     │ (STT pausa) │
              │     │ (VAD ativo) │
              │     └──────┬──────┘
              │            │ VAD interrupt OU Mute
              │            ▼
              │     ┌─────────────┐
              │     │ INTERRUPTED │
              │     │ (TTS para)  │
              │     │ (STT retoma)│
              └─────┴─────────────┘
                           │ End Call
                           ▼
                    ┌─────────────┐
                    │    IDLE     │
                    └─────────────┘
```

---

## 7. Arquivos e Responsabilidades

| Arquivo | Responsabilidade |
|---------|-----------------|
| `App.tsx` | Orquestrador — coordena STT, LLM, TTS, VAD |
| `hooks/useSpeechRecognition.ts` | STT — Web Speech API com pause/resume |
| `hooks/useChatAPI.ts` | LLM — Gemini REST API com function calling |
| `utils/inworldTTS.ts` | TTS — Inworld TTS com chunked playback |
| `hooks/useVoiceActivityDetection.ts` | VAD — Detecta fala por volume do mic |
| `store/settingsStore.ts` | Configurações — TTS key, voice, model |
| `store/skillsStore.ts` | Skills — Function declarations para Gemini |
| `utils/dataFunctions.ts` | Tool handlers — ghost_search, fetch_page, etc. |
