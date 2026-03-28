import { GoogleGenAI, Modality } from 'https://esm.run/@google/genai';

const ACTIVE_SESSION_KEY = 'livego_active_session';
const SYSTEM_PROMPT_KEY = 'livego_system_prompt';
const CONFIG_BAR_HIDDEN_KEY = 'livego_config_bar_hidden';
const TRANSCRIPT_DEBOUNCE_MS = 3000;
const BUBBLE_IDLE_MS = 3000;
const MODEL_NAME = 'gemini-3.1-flash-live-preview';
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;
const MODE_CONFIG = {
    mic_text: { needsMic: true, allowText: true },
    mic_only: { needsMic: true, allowText: false },
    text_only: { needsMic: false, allowText: true },
};

const $ = (id) => document.getElementById(id);

let session = null;
let status = 'idle';
let sendMode = 'mic_text';
let isMuted = false;
let isSpeakerOn = true;
let isManualDisconnect = false;

let audioCtx = null;
let outputGainNode = null;
let outputQueue = [];
let isDrainingOutput = false;
let activeOutputSource = null;

let mediaStream = null;
let mediaSourceNode = null;
let analyserNode = null;
let micProcessorNode = null;
let micProcessorSink = null;
let workletBlobUrl = null;
let meterAnimationId = null;

let debounceTimer = null;
let transcriptText = '';
let toolResults = [];
let currentSpeaker = null;

const bubbleState = {
    user: { el: null, timer: null },
    gemini: { el: null, timer: null },
};

let savedSessionData = loadSavedSession();

init();

function getDefaultSystemPrompt() {
    return [
        'Voce e um assistente inteligente.',
        'Responda em portugues do Brasil, com clareza e objetividade.',
        'Quando houver tools disponiveis, use-as para fatos atualizados e URLs especificas.',
        'A conversa acontece em audio, mas a interface mostra transcricoes incrementais.',
    ].join('\n');
}

function init() {
    try {
        $('apiKey').value = localStorage.getItem('gemini_api_key') || '';
        $('systemPrompt').value = localStorage.getItem(SYSTEM_PROMPT_KEY) || getDefaultSystemPrompt();
    } catch (error) {
        console.warn('localStorage unavailable for API key:', error);
        $('systemPrompt').value = getDefaultSystemPrompt();
    }

    if (savedSessionData?.transcript) {
        $('recoveryBanner').hidden = false;
        $('recoveryBanner').textContent =
            'Sessao anterior encontrada. O transcript salvo sera usado como contexto na proxima conexao.';
    }

    if (location.protocol === 'file:') {
        const warning = document.createElement('div');
        warning.className = 'recovery-banner';
        warning.innerHTML =
            'Aberto via file://. Para tools e microfone funcionarem com menos atrito, use ' +
            '<a href="http://localhost:3000/test.html" style="color:#d9d2ff;font-weight:700;">http://localhost:3000/test.html</a>.';
        document.body.insertBefore(warning, $('chat'));
    }

    $('userInput').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            sendMessage();
        }
    });

    $('userInput').addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    $('systemPrompt').addEventListener('input', persistSystemPrompt);

    $('modeTabs').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-mode]');
        if (!button) return;
        const nextMode = button.dataset.mode;
        if (!MODE_CONFIG[nextMode] || nextMode === sendMode) return;
        sendMode = nextMode;
        renderModeTabs();
        updateComposerState();
        if (session) {
            if (MODE_CONFIG[sendMode].needsMic) {
                await ensureMicrophoneReady();
            } else {
                await stopMicrophonePipeline();
            }
        }
    });

    renderModeTabs();
    applyConfigBarState();
    updateComposerState();
    updateStatusUI();
    drawIdleMeter();
}

function loadSavedSession() {
    try {
        const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('Unable to load saved session:', error);
        return null;
    }
}

function persistSystemPrompt() {
    try {
        localStorage.setItem(SYSTEM_PROMPT_KEY, $('systemPrompt').value);
    } catch (error) {
        console.warn('Unable to persist system prompt:', error);
    }
}

function scheduleSessionSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        try {
            localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
                transcript: transcriptText,
                toolResults,
                timestamp: Date.now(),
            }));
            savedSessionData = loadSavedSession();
            $('recoveryBanner').hidden = !savedSessionData?.transcript;
            if (!$('recoveryBanner').hidden) {
                $('recoveryBanner').textContent =
                    'Sessao ativa salva localmente. Se a conexao cair, esse contexto volta na proxima conexao.';
            }
        } catch (error) {
            console.warn('Unable to save session state:', error);
        }
    }, TRANSCRIPT_DEBOUNCE_MS);
}

function appendTranscript(speaker, text, { forceNewTurn = false } = {}) {
    if (!text) return;
    const label = speaker === 'user' ? 'Voce' : 'Gemini';
    const isNewTurn = forceNewTurn || currentSpeaker !== speaker;
    const prefix = isNewTurn ? `${transcriptText ? '\n' : ''}${label}: ` : '';
    transcriptText += prefix + text;
    currentSpeaker = speaker;
    scheduleSessionSave();
}

function resetBubbleTimeout(speaker) {
    const state = bubbleState[speaker];
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
        state.el = null;
        state.timer = null;
    }, BUBBLE_IDLE_MS);
}

function closeSpeakerBubble(speaker) {
    const state = bubbleState[speaker];
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    state.el = null;
}

function appendSpeakerBubble(speaker, text) {
    if (!text) return;
    const state = bubbleState[speaker];
    if (!state.el) {
        state.el = speaker === 'user' ? addUserMsg('') : addGeminiMsg('');
    }
    state.el.querySelector('.content').textContent += text;
    resetBubbleTimeout(speaker);
    scrollToBottom();
}

function addUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = '<span class="label">Voce</span><span class="content"></span>';
    div.querySelector('.content').textContent = text;
    $('chat').appendChild(div);
    scrollToBottom();
    return div;
}

function addGeminiMsg(text) {
    const div = document.createElement('div');
    div.className = 'msg gemini';
    div.innerHTML = '<span class="label">Gemini</span><span class="content"></span>';
    div.querySelector('.content').textContent = text;
    $('chat').appendChild(div);
    scrollToBottom();
    return div;
}

function addSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.innerHTML = text;
    $('chat').appendChild(div);
    scrollToBottom();
    return div;
}

function scrollToBottom() {
    const chat = $('chat');
    chat.scrollTop = chat.scrollHeight;
}

function renderModeTabs() {
    document.querySelectorAll('.mode-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === sendMode);
    });
}

function updateComposerState() {
    const mode = MODE_CONFIG[sendMode];
    const connected = !!session;
    $('userInput').disabled = !connected || !mode.allowText;
    $('sendBtn').disabled = !connected || !mode.allowText;
    $('userInput').placeholder = mode.allowText
        ? 'Digite sua mensagem... (Ctrl+Enter para enviar)'
        : 'Modo So Mic ativo. A transcricao do microfone aparece automaticamente.';
}

function updateStatusUI() {
    const dot = $('statusDot');
    dot.className = 'status-dot';
    if (status === 'connecting') dot.classList.add('connecting');
    if (status === 'connected') dot.classList.add('connected');

    const connected = status === 'connected';
    $('connectBtn').className = 'connect-btn ' + (connected ? 'on' : 'off');
    $('connectBtn').textContent = connected ? 'Desconectar' : (status === 'connecting' ? 'Conectando...' : 'Conectar');
    $('connectBtn').disabled = status === 'connecting';

    const muteVisible = connected;
    const speakerVisible = connected;
    $('muteBtn').className = 'mini-btn' + (muteVisible ? ' visible' : '') + (isMuted ? ' alert' : '');
    $('speakerBtn').className = 'mini-btn' + (speakerVisible ? ' visible' : '') + (isSpeakerOn ? ' active' : '');
    $('muteBtn').textContent = isMuted ? 'Unmute' : 'Mute';
    $('speakerBtn').textContent = isSpeakerOn ? 'Speaker On' : 'Speaker Off';
    $('muteBtn').disabled = !connected || !MODE_CONFIG[sendMode].needsMic;
    $('speakerBtn').disabled = !connected;

    updateComposerState();
}

function applyConfigBarState() {
    let isCollapsed = false;
    try {
        isCollapsed = localStorage.getItem(CONFIG_BAR_HIDDEN_KEY) === '1';
    } catch (error) {
        console.warn('Unable to read config bar state:', error);
    }

    $('toggleBarBtn').textContent = isCollapsed ? 'Mostrar barra' : 'Esconder barra';
    $('toggleBarBtn').setAttribute('aria-expanded', String(!isCollapsed));
    $('toggleBarBtn').classList.toggle('active', !isCollapsed);
    $('toggleBarBtn').classList.toggle('alert', isCollapsed);
    document.querySelector('.config-bar')?.classList.toggle('collapsed', isCollapsed);
}

function setStatus(nextStatus) {
    status = nextStatus;
    updateStatusUI();
}
function ensureAudioContext() {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        outputGainNode = audioCtx.createGain();
        outputGainNode.gain.value = isSpeakerOn ? 1 : 0;
        outputGainNode.connect(audioCtx.destination);
    }
    return audioCtx;
}

async function ensureAudioContextRunning() {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
    return ctx;
}

function decodeBase64ToFloat32(base64Audio) {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const pcm = new Float32Array(bytes.byteLength / 2);
    for (let i = 0; i < pcm.length; i++) {
        pcm[i] = view.getInt16(i * 2, true) / 32768;
    }
    return pcm;
}

async function resampleToContextBuffer(float32, sourceRate) {
    const ctx = ensureAudioContext();
    if (ctx.sampleRate === sourceRate) {
        const buffer = ctx.createBuffer(1, float32.length, sourceRate);
        buffer.copyToChannel(float32, 0);
        return buffer;
    }

    const inputBuffer = ctx.createBuffer(1, float32.length, sourceRate);
    inputBuffer.copyToChannel(float32, 0);

    const targetLength = Math.max(1, Math.round(float32.length * ctx.sampleRate / sourceRate));
    const offline = new OfflineAudioContext(1, targetLength, ctx.sampleRate);
    const source = offline.createBufferSource();
    source.buffer = inputBuffer;
    source.connect(offline.destination);
    source.start();
    return await offline.startRendering();
}

async function drainOutputQueue() {
    if (isDrainingOutput || !audioCtx || !outputGainNode) return;
    isDrainingOutput = true;

    try {
        while (outputQueue.length > 0) {
            const chunk = outputQueue.shift();
            if (!chunk) continue;
            const buffer = await resampleToContextBuffer(chunk, OUTPUT_SAMPLE_RATE);
            await new Promise((resolve) => {
                activeOutputSource = audioCtx.createBufferSource();
                activeOutputSource.buffer = buffer;
                activeOutputSource.connect(outputGainNode);
                activeOutputSource.onended = () => {
                    activeOutputSource = null;
                    resolve();
                };
                activeOutputSource.start();
            });
        }
    } catch (error) {
        console.error('Audio output error:', error);
    } finally {
        activeOutputSource = null;
        isDrainingOutput = false;
    }
}

function stopOutputPlayback() {
    outputQueue = [];
    if (activeOutputSource) {
        try {
            activeOutputSource.stop();
        } catch (error) {
            console.warn('Unable to stop output source:', error);
        }
        activeOutputSource = null;
    }
}

function queueOutputAudio(base64Audio) {
    if (!$('playAudio').checked || !audioCtx) return;
    outputQueue.push(decodeBase64ToFloat32(base64Audio));
    void drainOutputQueue();
}

function drawIdleMeter() {
    const canvas = $('volumeMeter');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#151522';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isMuted ? 'rgba(248,113,113,0.9)' : 'rgba(124,92,252,0.35)';
    ctx.fillRect(0, 0, 8, canvas.height);
}

function startVolumeMeter() {
    if (!analyserNode) {
        drawIdleMeter();
        return;
    }

    const canvas = $('volumeMeter');
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(analyserNode.frequencyBinCount);

    const render = () => {
        meterAnimationId = requestAnimationFrame(render);
        analyserNode.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            const value = Math.abs((data[i] - 128) / 128);
            if (value > peak) peak = value;
        }

        const width = Math.max(6, Math.min(canvas.width, Math.round(peak * canvas.width * 2.6)));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#151522';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isMuted ? '#f87171' : '#7c5cfc';
        ctx.fillRect(0, 0, width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    };

    if (meterAnimationId) cancelAnimationFrame(meterAnimationId);
    render();
}

function stopVolumeMeter() {
    if (meterAnimationId) cancelAnimationFrame(meterAnimationId);
    meterAnimationId = null;
    drawIdleMeter();
}

function resampleFloat32(input, inputRate, outputRate) {
    if (inputRate === outputRate) return input;
    const ratio = inputRate / outputRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const position = i * ratio;
        const left = Math.floor(position);
        const right = Math.min(left + 1, input.length - 1);
        const weight = position - left;
        output[i] = input[left] * (1 - weight) + input[right] * weight;
    }

    return output;
}

function encodePcm16ToBase64(float32) {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {
        const sample = Math.max(-1, Math.min(1, float32[i]));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(i * 2, int16, true);
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function sendMicChunk(float32Chunk, inputRate) {
    if (!session || !MODE_CONFIG[sendMode].needsMic) return;
    const resampled = resampleFloat32(float32Chunk, inputRate, INPUT_SAMPLE_RATE);
    const payload = isMuted ? new Float32Array(resampled.length) : resampled;

    try {
        session.sendRealtimeInput({
            audio: {
                data: encodePcm16ToBase64(payload),
                mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
            },
        });
    } catch (error) {
        console.error('Mic send error:', error);
    }
}

async function setupWorkletProcessor(ctx) {
    const workletCode = `
        class LiveGoMicProcessor extends AudioWorkletProcessor {
            process(inputs) {
                const input = inputs[0];
                if (!input || !input[0]) return true;
                this.port.postMessage(input[0]);
                return true;
            }
        }
        registerProcessor('livego-mic-processor', LiveGoMicProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    workletBlobUrl = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(workletBlobUrl);

    const node = new AudioWorkletNode(ctx, 'livego-mic-processor');
    node.port.onmessage = (event) => {
        if (!event.data) return;
        sendMicChunk(event.data, ctx.sampleRate);
    };
    return node;
}

function setupScriptProcessorFallback(ctx) {
    const node = ctx.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        sendMicChunk(new Float32Array(input), ctx.sampleRate);
    };
    return node;
}

async function ensureMicrophoneReady() {
    if (!MODE_CONFIG[sendMode].needsMic || mediaStream) return;

    const ctx = await ensureAudioContextRunning();
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
        },
    });

    mediaSourceNode = ctx.createMediaStreamSource(mediaStream);
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 64;
    analyserNode.smoothingTimeConstant = 0.7;
    mediaSourceNode.connect(analyserNode);

    try {
        micProcessorNode = await setupWorkletProcessor(ctx);
    } catch (error) {
        console.warn('AudioWorklet unavailable, using ScriptProcessor fallback:', error);
        micProcessorNode = setupScriptProcessorFallback(ctx);
    }

    micProcessorSink = ctx.createGain();
    micProcessorSink.gain.value = 0;
    mediaSourceNode.connect(micProcessorNode);
    micProcessorNode.connect(micProcessorSink);
    micProcessorSink.connect(ctx.destination);

    startVolumeMeter();
}

async function stopMicrophonePipeline() {
    if (micProcessorNode) {
        try { micProcessorNode.disconnect(); } catch (error) { console.warn(error); }
        if ('port' in micProcessorNode) {
            try { micProcessorNode.port.onmessage = null; } catch (error) { console.warn(error); }
        }
        micProcessorNode = null;
    }

    if (micProcessorSink) {
        try { micProcessorSink.disconnect(); } catch (error) { console.warn(error); }
        micProcessorSink = null;
    }

    if (mediaSourceNode) {
        try { mediaSourceNode.disconnect(); } catch (error) { console.warn(error); }
        mediaSourceNode = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
    }

    analyserNode = null;
    stopVolumeMeter();

    if (workletBlobUrl) {
        URL.revokeObjectURL(workletBlobUrl);
        workletBlobUrl = null;
    }
}
function buildSystemInstruction() {
    const customPrompt = $('systemPrompt')?.value.trim();
    const parts = [customPrompt || getDefaultSystemPrompt()];

    if (savedSessionData?.transcript) {
        const transcriptPreview = savedSessionData.transcript.slice(-5000);
        parts.push('Contexto recuperado da ultima sessao (pode estar parcial):');
        parts.push(transcriptPreview);
    }

    if (savedSessionData?.toolResults?.length) {
        const compactResults = savedSessionData.toolResults
            .slice(-4)
            .map((entry) => `${entry.name}: ${JSON.stringify(entry.result).slice(0, 700)}`)
            .join('\n');
        parts.push('Resultados recentes de tools salvos localmente:');
        parts.push(compactResults);
    }

    return parts.join('\n\n');
}

function buildTools() {
    const mode = $('toolsMode').value;
    const tools = [];

    if (mode === 'all' || mode === 'search_only') {
        tools.push({ googleSearch: {} });
    }

    const declarations = [];

    if (mode === 'all' || mode === 'ghost_only') {
        declarations.push({
            name: 'ghost_search',
            description: 'Pesquisa avancada via Ghost-Search com foco web, academico, YouTube, Reddit ou Wolfram.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Pergunta ou termo de busca' },
                    model: { type: 'string', description: 'Modelo de IA', enum: ['best', 'sonar', 'deep_research'] },
                    focus: { type: 'string', description: 'Tipo de busca', enum: ['web', 'academic', 'youtube', 'reddit', 'wolfram'] },
                    time_range: { type: 'string', description: 'Filtro temporal', enum: ['all', 'day', 'week', 'month', 'year'] },
                },
                required: ['query'],
            },
        });
    }

    if (mode === 'all') {
        declarations.push({
            name: 'fetch_page',
            description: 'Le o conteudo textual principal de uma URL.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL da pagina' },
                    maxChars: { type: 'number', description: 'Limite de caracteres' },
                },
                required: ['url'],
            },
        });
    }

    if (declarations.length > 0) {
        tools.push({ functionDeclarations: declarations });
    }

    return tools;
}

function getGhostSearchUrl() {
    return '/api/ghost/search';
}

async function executeToolCall(name, args) {
    if (name === 'ghost_search') {
        try {
            const response = await fetch(getGhostSearchUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: args.query,
                    model: args.model || 'best',
                    focus: args.focus || 'web',
                    time_range: args.time_range || 'all',
                    citation_mode: 'clean',
                    user_id: 'livego_test',
                }),
            });

            const raw = await response.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch (parseError) {
                return {
                    ok: false,
                    error: `Ghost Search retornou resposta nao-JSON (${response.status}): ${raw.slice(0, 220)}`,
                };
            }

            if (!response.ok) {
                return {
                    ok: false,
                    error: data?.error || `Ghost Search falhou com status ${response.status}.`,
                };
            }

            if (data.status !== 'success') {
                return { ok: false, error: `API Error: ${JSON.stringify(data)}` };
            }
            return {
                ok: true,
                answer: data.answer || '',
                model_used: data.model_used,
                citations: (data.citations || []).slice(0, 5),
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    if (name === 'fetch_page') {
        try {
            const response = await fetch(args.url);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('script,style,noscript,template,svg').forEach((node) => node.remove());
            const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
            const maxChars = args.maxChars || 12000;
            return {
                ok: true,
                title: doc.title || '',
                contentPreview: text.slice(0, maxChars),
                truncated: text.length > maxChars,
            };
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    return { ok: false, error: `Function ${name} not implemented` };
}

async function handleToolCalls(toolCall) {
    if (!toolCall?.functionCalls?.length || !session) return;

    for (const call of toolCall.functionCalls) {
        const toolMsg = addSystemMsg(`Chamando tool: <strong>${call.name}</strong>...`);
        const result = await executeToolCall(call.name, call.args || {});

        toolResults.push({ name: call.name, args: call.args || {}, result, timestamp: Date.now() });
        toolResults = toolResults.slice(-20);
        scheduleSessionSave();

        toolMsg.innerHTML = `${call.name} - ${result.ok !== false ? 'OK' : 'Erro'}`;

        const details = document.createElement('details');
        details.className = 'tool-call';
        details.innerHTML = `<summary>Ver detalhes</summary><pre>${JSON.stringify({ args: call.args, result }, null, 2)}</pre>`;
        toolMsg.appendChild(details);

        try {
            session.sendToolResponse({
                functionResponses: [{
                    id: call.id,
                    name: call.name,
                    response: result,
                }],
            });
        } catch (error) {
            console.error('Tool response error:', error);
        }
    }
}

function handleServerContent(serverContent) {
    if (!serverContent) return;
    const hasOutputTranscript = !!serverContent.outputTranscription?.text;

    if (serverContent.interrupted) {
        stopOutputPlayback();
        closeSpeakerBubble('gemini');
    }

    if (serverContent.modelTurn?.parts?.length) {
        for (const part of serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
                queueOutputAudio(part.inlineData.data);
            }
            if (part.text && !hasOutputTranscript) {
                appendSpeakerBubble('gemini', part.text);
                appendTranscript('gemini', part.text);
            }
        }
    }

    if (serverContent.inputTranscription?.text) {
        const text = serverContent.inputTranscription.text;
        appendSpeakerBubble('user', text);
        appendTranscript('user', text);
    }

    if (serverContent.outputTranscription?.text) {
        const text = serverContent.outputTranscription.text;
        appendSpeakerBubble('gemini', text);
        appendTranscript('gemini', text);
    }

    if (serverContent.turnComplete) {
        closeSpeakerBubble('gemini');
        currentSpeaker = null;
    }
}

function handleMessage(message) {
    handleServerContent(message.serverContent);
    void handleToolCalls(message.toolCall);
}

async function teardownConnectionResources() {
    await stopMicrophonePipeline();
    stopOutputPlayback();

    if (audioCtx) {
        try { await audioCtx.close(); } catch (error) { console.warn(error); }
        audioCtx = null;
    }

    outputGainNode = null;
    closeSpeakerBubble('user');
    closeSpeakerBubble('gemini');
}
async function toggleConnection() {
    if (session || status === 'connecting') {
        if (session) {
            isManualDisconnect = true;
            try { session.close(); } catch (error) { console.warn(error); }
        }
        session = null;
        setStatus('idle');
        await teardownConnectionResources();
        addSystemMsg('Desconectado.');
        return;
    }

    const apiKey = $('apiKey').value.trim();
    if (!apiKey) {
        addSystemMsg('Cole sua API Key primeiro.');
        return;
    }

    try {
        localStorage.setItem('gemini_api_key', apiKey);
    } catch (error) {
        console.warn('Unable to persist API key:', error);
    }

    setStatus('connecting');
    addSystemMsg(`Conectando ao ${MODEL_NAME}...`);

    try {
        await ensureAudioContextRunning();
        if (MODE_CONFIG[sendMode].needsMic) {
            await ensureMicrophoneReady();
        } else {
            await stopMicrophonePipeline();
        }

        const ai = new GoogleGenAI({ apiKey });
        const tools = buildTools();
        const config = {
            responseModalities: [Modality.AUDIO],
            thinkingConfig: { thinkingLevel: 'minimal' },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildSystemInstruction(),
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
            ...(tools.length > 0 && { tools }),
        };

        session = await ai.live.connect({
            model: MODEL_NAME,
            config,
            callbacks: {
                onopen: () => {
                    isManualDisconnect = false;
                    setStatus('connected');
                    addSystemMsg('Conectado! Digite ou fale para conversar com o Gemini Live.');
                    if (savedSessionData?.transcript) {
                        addSystemMsg('Contexto salvo da sessao anterior foi incluido no prompt desta conexao.');
                    }
                },
                onmessage: (message) => handleMessage(message),
                onclose: async (event) => {
                    console.warn('Session closed:', event);
                    session = null;
                    setStatus('idle');
                    await teardownConnectionResources();
                    if (isManualDisconnect) {
                        isManualDisconnect = false;
                        return;
                    }
                    if (event?.code || event?.reason) {
                        addSystemMsg(`Sessao encerrada (${event.code || 'sem codigo'}${event.reason ? ` - ${event.reason}` : ''}).`);
                    } else {
                        addSystemMsg('Sessao encerrada.');
                    }
                },
                onerror: async (error) => {
                    console.error('Session error:', error);
                    isManualDisconnect = false;
                    session = null;
                    setStatus('idle');
                    await teardownConnectionResources();
                    addSystemMsg(`Erro: ${error.message || JSON.stringify(error)}`);
                },
            },
        });
    } catch (error) {
        console.error('Connection failed:', error);
        session = null;
        setStatus('idle');
        await teardownConnectionResources();
        addSystemMsg(`Falha ao conectar: ${error.message}`);
    }
}

function sendMessage() {
    if (!session || !MODE_CONFIG[sendMode].allowText) return;

    const text = $('userInput').value.trim();
    if (!text) return;

    addUserMsg(text);
    appendTranscript('user', text, { forceNewTurn: true });
    closeSpeakerBubble('user');

    $('userInput').value = '';
    $('userInput').style.height = 'auto';

    try {
        session.sendRealtimeInput({ text });
    } catch (error) {
        addSystemMsg(`Erro ao enviar: ${error.message}`);
    }
}

function toggleMute() {
    isMuted = !isMuted;
    updateStatusUI();
    drawIdleMeter();
}

function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    if (outputGainNode) {
        outputGainNode.gain.value = isSpeakerOn ? 1 : 0;
    }
    updateStatusUI();
}

function toggleConfigBar() {
    try {
        const isCollapsed = localStorage.getItem(CONFIG_BAR_HIDDEN_KEY) === '1';
        localStorage.setItem(CONFIG_BAR_HIDDEN_KEY, isCollapsed ? '0' : '1');
    } catch (error) {
        console.warn('Unable to persist config bar state:', error);
    }
    applyConfigBarState();
}

window.toggleConnection = toggleConnection;
window.sendMessage = sendMessage;
window.toggleMute = toggleMute;
window.toggleSpeaker = toggleSpeaker;
window.toggleConfigBar = toggleConfigBar;
