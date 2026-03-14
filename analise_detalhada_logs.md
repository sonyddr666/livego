# ANÁLISE DETALHADA DOS LOGS DO LIVEGO (13/03/2026)

Este documento apresenta uma análise extensiva e linha-a-linha dos problemas atuais enfrentados pela integração do Gemini Live API no LiveGo, focado nos logs mais recentes.

## PARTE 1: FUNCIONAMENTO CORRETO DA BASE

### 1. Inicialização e Conexão de Áudio
**Logs Relacionados:**
```
[DEBUG] Starting connection...
[DEBUG] API key found, creating GoogleGenAI instance...
[DEBUG] Input AudioContext state: running
[DEBUG] Output AudioContext state: running
[DEBUG] Microphone access granted
[DEBUG] Track settings: {autoGainControl: true, channelCount: 1...}
```
**Análise:** 
A infraestrutura básica de WebAudio e permissões está impecável. O painel de controle do `AudioContext` do navegador aciona e gerencia a entrada (mic) e a saída de forma contínua (`state: running`). O navegador reconhece o fluxo e a aplicação dos efeitos de limpeza (`Noise Gate + EQ + Compression`) está ativada com sucesso. Nenhuma anomalia aqui.

### 2. O AudioWorklet (pcm-processor)
**Logs Relacionados:**
```
[DEBUG] Charging AudioWorklet from static file...
[DEBUG] AudioWorklet module added successfully from /pcm-processor.js
[DEBUG] Creating AudioWorkletNode 'pcm-processor'...
[DEBUG] Audio pipeline connected successfully via AudioWorklet
```
**Análise:**
O LiveGo está usando a arquitetura moderna de processamento de áudio (AudioWorkletNode) como esperado. Sem isso, o áudio picotaria e engasgaria. Este é um grande acerto técnico local. A transferência de arrays de PCM do cliente para o socket (`sendAudioChunk`) baseia-se nisso.


## PARTE 2: A MECÂNICA DE TOOLS (O EIXO DO PROBLEMA)

Os problemas observados residem exclusivamente no loop de *Function Calling* (chamamento de ferramentas), especificamente no `ghost_search`.

### O Ciclo Completo de uma Tool Call Bem-sucedida Localmente, mas que Falha na API:

**Passo 1: O Pedido do Usuário e o Reconhecimento da Tool**
```
[Tool] call received: {functionCalls: Array(1)}
[Tool] Function called: ghost_search {focus: 'web', model: 'best', query: 'notícias do Brasil'}
[Ghost-Search] Requesting: {query: 'notícias do Brasil', model: 'best', focus: 'web', time_range: 'all', citation_mode: 'clean' ...}
[Ghost-Search] URL: /api/ghost/search
```
**Análise:** O Gemini escutou seu áudio (ou leu seu prompt), interpretou a intenção e comandou a interface a invocar o `ghost_search`. O seu frontend montou corretamente o JSON de requisição e iniciou o fetch ao proxy `/api/ghost/search`.

**Passo 2: A Espera pelo Backend**
```
[Ghost-Search] HTTP 200 | Time: 36.1s | Body: 9158
[Ghost-Search] Response: success best
```
**Análise:** A API remota `ghost1.cloud` realizou a busca profunda ("deep research"), demorou exatos **36.1 segundos** processando as leituras e devolveu `HTTP 200 (Success)` com incríveis 9158 bytes de resposta. O nosso wrapper local processou e parseou JSON.
**Conclusão Parcial:** Seu backend e seu proxy Vite (porta 3000) **estão funcionando perfeitamente**.

**Passo 3: A Devolução para o Gemini (A Falha Fatal 1011)**
```
[Tool] sending response: {id: 'function-call-17706853507698612215', name: 'ghost_search', response: {...}}
O Buscar terminou de carregar: POST "http://localhost:3000/api/ghost/search".
--- E IMEDIATAMENTE APÓS ---
WebSocket is already in CLOSING or CLOSED state.
Close code: 1011
Close reason: Thread was cancelled when writing StartStep status to channel.; Failed to close the streaming context; status = CANCELLED:
```
**ANÁLISE PROFUNDA DO ERRO 1011:**
1. Quando nós abrimos a conexão Live (WebSocket), o servidor do Google Gemini abre uma "Thread" atrelada à nossa sessão de voz.
2. Eles mandam o comando da tool pra gente (`ghost_search`) e *ficam pendurados esperando a gente devolver a resposta*.
3. O servidor deles tem um Timeout interno agressivo. No SDK V2 (GenAI), esse limite para uma function call girava em torno de 15 a 30 segundos nas APIS de chat padrão, mas na Live API (streaming realtime), é **críticamente intolerante** a demoras.
4. Como o nosso servidor demorou 36 segundos, os engenheiros de rede da Google "mataram" a nossa Thread lá no data center deles (`Thread was cancelled`). Consequentemente, a perna do socket deles foi fechada à força (`CANCELLED`).
5. Aos 36.1 segundos, nós tentamos mandar o `sendToolResponse`. Só que nossa variável de socket do SDK já se encontra no estado `CLOSING or CLOSED` e o SDK do seu console lança o erro local do Chrome (`WebSocket is already in CLOSING`).


## PARTE 3: O CASCATEAMENTO DOS ERROS

Como a conexão WebSocket foi arrebentada prematuramente, outras ações de fundo entram num loop de falhas:

**O Loop de Áudio Reagindo ao Socket Fechado:**
```
useLiveAPI.ts:392 WebSocket is already in CLOSING or CLOSED state.
sendAudioChunk @ useLiveAPI.ts:390
audioWorkletNodeRef.current.port.onmessage @ useLiveAPI.ts:408
useLiveAPI.ts:392 WebSocket is already in CLOSING or CLOSED state.
...e assim por diante continuamente.
```
**Análise:** O seu microfone ainda continua ouvindo. O AudioWorklet, a cada milissegundo, produz buffers de PCM de áudio para mandar pro Google. A função `sendAudioChunk` da `useLiveAPI` é chamada incontáveis vezes a cada segundo e tenta jogar dados no WebSocket que o Google fechou devido ao timeout, empilhando esses erros vermelhos.

## PARTE 4: A ANOMALIA - ERRO 1008 (Requested entity was not found)

```
[DEBUG] Live Session Closed
[DEBUG] Close code: 1008
[DEBUG] Close reason: Requested entity was not found.
```
**Análise do Erro 1008:**
Isto é comportamento de erro no SDK do Google ou de indisponibilidade de sessão/entidade nos backends deles após múltiplas tentativas frustradas.
* Possibilidade A: Tentar reiniciar a conexão WebRTC/Socket rápido demais depois de um erro abrupto 1011 (`CANCELLED`) deixa uma "sujeira" atrelada ao session_id no backend deles. O novo handshake vai procurar um recurso e gera erro NotFound.
* Possibilidade B: Se esse erro aconteceu quando tentou rodar as tools `show_image` e `hide_image` via `functionDeclarations` nas primeiras chamadas, pode significar que o modelo Native Audio subitamente achava que aquele schema de tool era inválido (entidade de tool não encontrada/cadastrada validamente conforme o spec estrito do Live).


## RESUMO E PRÓXIMOS PASSOS OBRIGATÓRIOS

**O "Ghost-Search" não é compatível (em seu estado atual de deep_research de 30s+) com os limites assíncronos da API Gemini Live WebSocket nativa**. 

Para resolver o problema 1011 e os loops do WebSocket `CLOSED`, há três vertentes de solução:

1. **Acelerar o Backend/Tool**: Em vez de fazer a "Deep Research" sincronamente travando a "Thread" da API do Google, fazer o ghost_search com um limitador, focando em responder em menos de ~10-15 segundos.
2. **Respostas Intermediárias**: Informações parciais (não suportado built-in na lib client).
3. **Desativação Temporária**: Para evitar que a conversa trave toda vez que o modelo decida buscar notícias longas, remover ou interceptar `ghost_search` no array de functions de entrada quando a config da sua conexão abrir, até podermos resolver os limites de latência com o backend.
