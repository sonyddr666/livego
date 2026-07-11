/**
 * Data Functions for Gemini Function Calling
 * These functions interact with localStorage to provide data to Gemini
 */

import { EmotionalNote, ConversationEntry, EmotionStatistics, TimePattern, EmotionType } from '../types';

const EMOTIONAL_NOTES_KEY = 'livego_emotional_notes';
const CONVERSATION_HISTORY_KEY = 'livego_history';
const FETCH_PAGE_TIMEOUT_MS = 9000;
const FETCH_PAGE_MAX_CHARS = 12000;

type FetchPageResult = {
    ok: boolean;
    url: string;
    finalUrl?: string;
    source?: 'direct' | 'proxy';
    title?: string;
    contentPreview?: string;
    contentChars?: number;
    truncated?: boolean;
    error?: string;
    errorCode?: string;
    details?: string[];
};

function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = FETCH_PAGE_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        ...init,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
}

function normalizeUrl(input: string): string | null {
    const trimmed = String(input || '').trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (
        host === 'localhost' ||
        host === '::1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local')
    ) {
        return true;
    }

    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return false;

    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
}

function cleanTextContent(raw: string): string {
    return raw
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function parseHtmlToText(html: string): { title: string; text: string } {
    const fallback = {
        title: '',
        text: cleanTextContent(html.replace(/<[^>]*>/g, ' '))
    };

    if (typeof DOMParser === 'undefined') return fallback;

    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = cleanTextContent(doc.title || '');

        doc.querySelectorAll('script,style,noscript,template,svg').forEach(node => node.remove());
        const bodyText = cleanTextContent(doc.body?.textContent || '');

        return { title, text: bodyText };
    } catch {
        return fallback;
    }
}

/**
 * Fetches and summarizes a page content for the assistant.
 * Uses direct fetch first and falls back to a readability proxy when CORS blocks.
 */
export async function fetchPage(
    url: string,
    maxChars: number = FETCH_PAGE_MAX_CHARS
): Promise<FetchPageResult> {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        return {
            ok: false,
            url: String(url || ''),
            errorCode: 'INVALID_URL',
            error: 'URL invalida. Use um link http(s) completo.'
        };
    }

    try {
        const parsed = new URL(normalizedUrl);
        if (isBlockedHost(parsed.hostname)) {
            return {
                ok: false,
                url: normalizedUrl,
                errorCode: 'BLOCKED_HOST',
                error: 'Host local/rede privada nao permitido.'
            };
        }
    } catch {
        return {
            ok: false,
            url: normalizedUrl,
            errorCode: 'INVALID_URL',
            error: 'Falha ao interpretar URL.'
        };
    }

    const cappedMaxChars = Math.min(Math.max(500, Number(maxChars) || FETCH_PAGE_MAX_CHARS), 30000);
    const directErrors: string[] = [];

    try {
        const response = await fetchWithTimeout(normalizedUrl, {
            method: 'GET',
            headers: {
                Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            directErrors.push(`Direct HTTP ${response.status}`);
            throw new Error(`Direct HTTP ${response.status}`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const raw = await response.text();

        const { title, text } = contentType.includes('text/html')
            ? parseHtmlToText(raw)
            : { title: '', text: cleanTextContent(raw) };

        if (!text) {
            return {
                ok: false,
                url: normalizedUrl,
                source: 'direct',
                errorCode: 'EMPTY_CONTENT',
                error: 'Pagina carregada, mas sem conteudo textual legivel.'
            };
        }

        const preview = text.slice(0, cappedMaxChars);
        return {
            ok: true,
            url: normalizedUrl,
            finalUrl: response.url || normalizedUrl,
            source: 'direct',
            title,
            contentPreview: preview,
            contentChars: text.length,
            truncated: text.length > cappedMaxChars
        };
    } catch (directError) {
        directErrors.push(
            directError instanceof Error ? directError.message : String(directError)
        );
    }

    // Fallback for CORS/opaque failures in static frontends: fetch readable text via proxy.
    const proxyUrl = `https://r.jina.ai/http://${normalizedUrl.replace(/^https?:\/\//i, '')}`;
    try {
        const proxyResponse = await fetchWithTimeout(proxyUrl, {
            method: 'GET',
            headers: { Accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.1' },
            cache: 'no-store'
        });

        if (!proxyResponse.ok) {
            return {
                ok: false,
                url: normalizedUrl,
                errorCode: 'FETCH_FAILED',
                error: `Falha ao buscar pagina (proxy HTTP ${proxyResponse.status}).`,
                details: directErrors
            };
        }

        const raw = await proxyResponse.text();
        const text = cleanTextContent(raw);
        if (!text) {
            return {
                ok: false,
                url: normalizedUrl,
                source: 'proxy',
                errorCode: 'EMPTY_CONTENT',
                error: 'Proxy retornou sem conteudo.'
            };
        }

        const preview = text.slice(0, cappedMaxChars);
        return {
            ok: true,
            url: normalizedUrl,
            source: 'proxy',
            title: '',
            contentPreview: preview,
            contentChars: text.length,
            truncated: text.length > cappedMaxChars
        };
    } catch (proxyError) {
        const proxyMessage = proxyError instanceof Error ? proxyError.message : String(proxyError);
        return {
            ok: false,
            url: normalizedUrl,
            errorCode: 'FETCH_FAILED',
            error: 'Nao foi possivel ler a pagina.',
            details: [...directErrors, proxyMessage]
        };
    }
}

// Helper: Get mode (most frequent) of an array
function mode(arr: string[]): EmotionType {
    if (!arr.length) return 'unknown';
    const counts: Record<string, number> = {};
    arr.forEach(item => counts[item] = (counts[item] || 0) + 1);

    let maxItem = 'unknown';
    let maxCount = 0;
    for (const [item, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            maxItem = item;
        }
    }
    return maxItem as EmotionType;
}

// Helper: Extract relevant excerpt around a topic
function extractRelevantExcerpt(text: string, topic: string, context: number = 50): string {
    const lowerText = text.toLowerCase();
    const lowerTopic = topic.toLowerCase();
    const index = lowerText.indexOf(lowerTopic);
    if (index === -1) return text.substring(0, 100) + '...';

    const start = Math.max(0, index - context);
    const end = Math.min(text.length, index + topic.length + context);

    return '...' + text.substring(start, end) + '...';
}

// Helper: Parse Brazilian date format "dd/mm/yyyy, HH:MM:SS" to Date
function parseBrazilianDate(dateStr: string): Date {
    try {
        // Format: "16/01/2026, 23:08:13"
        const [datePart, timePart] = dateStr.split(', ');
        if (!datePart || !timePart) return new Date(dateStr); // fallback

        const dateParts = datePart.split('/').map(Number);
        const timeParts = timePart.split(':').map(Number);

        const day = dateParts[0] || 1;
        const month = dateParts[1] || 1;
        const year = dateParts[2] || 2026;
        const hours = timeParts[0] || 0;
        const minutes = timeParts[1] || 0;
        const seconds = timeParts[2] || 0;

        return new Date(year, month - 1, day, hours, minutes, seconds);
    } catch {
        return new Date(dateStr); // fallback to default parsing
    }
}

// Helper: Parse history items to ConversationEntry format
function parseHistoryToEntries(): ConversationEntry[] {
    try {
        const saved = localStorage.getItem(CONVERSATION_HISTORY_KEY);
        if (!saved) return [];

        const history = JSON.parse(saved);
        console.log('[History] Raw history from localStorage:', history);

        const entries = history.map((item: any) => ({
            id: item.id,
            timestamp: parseBrazilianDate(item.date).toISOString(), // Convert to ISO format
            duration: parseDurationToMinutes(item.duration),
            transcript: item.transcript || '',
            emotion: item.emotion || 'unknown',
            intensity: item.intensity || 5
        }));

        console.log('[History] Parsed entries:', entries);
        return entries;
    } catch (error) {
        console.error('Failed to parse history:', error);
        return [];
    }
}

// Helper: Parse duration string "M:SS" to minutes
function parseDurationToMinutes(durationStr: string | undefined): number {
    if (!durationStr) return 0;
    const parts = durationStr.split(':');
    if (parts.length !== 2) return 0;
    const mins = parseInt(parts[0] || '0', 10);
    const secs = parseInt(parts[1] || '0', 10);
    return mins + (secs / 60);
}

/**
 * Get conversation history by period and optional emotion filter
 */
export async function getConversationHistory(
    days: number,
    emotionFilter: string = 'all'
): Promise<any> {
    const history = parseHistoryToEntries();
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    let filtered = history.filter(entry => {
        const entryDate = new Date(entry.timestamp).getTime();
        return entryDate > cutoffDate;
    });

    if (emotionFilter !== 'all') {
        filtered = filtered.filter(entry => entry.emotion === emotionFilter);
    }

    const totalDuration = filtered.reduce((sum, e) => sum + e.duration, 0);

    return {
        totalConversations: filtered.length,
        averageDuration: filtered.length > 0 ? (totalDuration / filtered.length).toFixed(1) : 0,
        totalMinutes: totalDuration.toFixed(1),
        conversations: filtered.slice(0, 10).map(e => ({
            date: new Date(e.timestamp).toLocaleDateString('pt-BR'),
            duration: `${e.duration.toFixed(1)} min`,
            emotion: e.emotion || 'unknown',
            preview: e.transcript.substring(0, 100) + '...'
        }))
    };
}

/**
 * Save an emotional note
 */
export async function saveEmotionalNote(data: {
    emotion: EmotionType;
    intensity: number;
    trigger?: string;
    note?: string;
}): Promise<any> {
    try {
        const saved = localStorage.getItem(EMOTIONAL_NOTES_KEY);
        const notes: EmotionalNote[] = saved ? JSON.parse(saved) : [];

        const newNote: EmotionalNote = {
            timestamp: new Date().toISOString(),
            emotion: data.emotion,
            intensity: Math.min(10, Math.max(1, data.intensity)),
            trigger: data.trigger,
            note: data.note
        };

        notes.push(newNote);
        localStorage.setItem(EMOTIONAL_NOTES_KEY, JSON.stringify(notes));

        return {
            saved: true,
            totalNotes: notes.length,
            message: `Nota salva: ${data.emotion} (intensidade ${data.intensity}/10)`
        };
    } catch (error) {
        console.error('Failed to save emotional note:', error);
        return { saved: false, error: String(error) };
    }
}

/**
 * Get time patterns (when user talks most)
 */
export async function getTimePatterns(analysisType: string): Promise<TimePattern | any> {
    const history = parseHistoryToEntries();

    if (analysisType === 'hourly') {
        const byHour: Record<number, { count: number; emotions: string[] }> = {};

        history.forEach(entry => {
            const hour = new Date(entry.timestamp).getHours();
            if (!byHour[hour]) byHour[hour] = { count: 0, emotions: [] };
            byHour[hour].count++;
            if (entry.emotion) byHour[hour].emotions.push(entry.emotion);
        });

        const peakHour = Object.entries(byHour).reduce((max, [hour, data]) =>
            data.count > (byHour[Number(max)]?.count || 0) ? hour : max
            , '0');

        return {
            type: 'hourly' as const,
            peakHour: `${peakHour}h`,
            distribution: Object.entries(byHour).map(([hour, data]) => ({
                period: `${hour}h`,
                conversations: data.count,
                dominantEmotion: mode(data.emotions)
            }))
        };
    }

    if (analysisType === 'daily') {
        const byDay: Record<string, { count: number; emotions: string[] }> = {};
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        history.forEach(entry => {
            const dayIndex = new Date(entry.timestamp).getDay();
            const day = dayNames[dayIndex] || 'Segunda';
            if (!byDay[day]) byDay[day] = { count: 0, emotions: [] };
            byDay[day].count++;
            if (entry.emotion) byDay[day].emotions.push(entry.emotion);
        });

        let peakDay = 'Segunda';
        let peakCount = 0;
        for (const [day, data] of Object.entries(byDay)) {
            if (data.count > peakCount) {
                peakCount = data.count;
                peakDay = day;
            }
        }

        return {
            type: 'daily' as const,
            peakDay,
            distribution: Object.entries(byDay).map(([day, data]) => ({
                period: day,
                conversations: data.count,
                dominantEmotion: mode(data.emotions)
            }))
        };
    }

    return { error: 'Tipo de análise não suportado. Use: hourly ou daily' };
}

/**
 * Search conversations by topic
 */
export async function searchConversationTopic(
    topic: string,
    limit: number = 5
): Promise<any> {
    const history = parseHistoryToEntries();

    const results = history
        .filter(entry =>
            entry.transcript.toLowerCase().includes(topic.toLowerCase())
        )
        .slice(-limit)
        .reverse();

    return {
        topic,
        found: results.length,
        results: results.map(e => ({
            date: new Date(e.timestamp).toLocaleDateString('pt-BR'),
            excerpt: extractRelevantExcerpt(e.transcript, topic),
            emotion: e.emotion
        }))
    };
}

/**
 * Get emotion statistics for a period
 */
export async function getEmotionStatistics(period: string): Promise<EmotionStatistics | any> {
    try {
        const saved = localStorage.getItem(EMOTIONAL_NOTES_KEY);
        const notes: EmotionalNote[] = saved ? JSON.parse(saved) : [];

        const periods: Record<string, number> = {
            today: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
            all: Infinity
        };

        const periodMs = periods[period] ?? periods['all'] ?? 0;
        const cutoff = Date.now() - periodMs;
        const filtered = notes.filter(n =>
            new Date(n.timestamp).getTime() > cutoff
        );

        if (filtered.length === 0) {
            return {
                period,
                totalNotes: 0,
                averageIntensity: 0,
                mostCommonEmotion: 'unknown' as EmotionType,
                distribution: [],
                message: 'Nenhum dado encontrado para este período'
            };
        }

        const emotionCounts: Record<string, number> = {};
        const intensities: number[] = [];

        filtered.forEach(note => {
            emotionCounts[note.emotion] = (emotionCounts[note.emotion] || 0) + 1;
            intensities.push(note.intensity);
        });

        const avgIntensity = intensities.reduce((sum, i) => sum + i, 0) / intensities.length;

        let mostCommon: EmotionType = 'neutral';
        let mostCount = 0;
        for (const [emotion, count] of Object.entries(emotionCounts)) {
            if (count > mostCount) {
                mostCount = count;
                mostCommon = emotion as EmotionType;
            }
        }

        return {
            period,
            totalNotes: filtered.length,
            averageIntensity: parseFloat(avgIntensity.toFixed(1)),
            mostCommonEmotion: mostCommon,
            distribution: Object.entries(emotionCounts).map(([emotion, count]) => ({
                emotion: emotion as EmotionType,
                count,
                percentage: ((count / filtered.length) * 100).toFixed(1) + '%'
            }))
        };
    } catch (error) {
        console.error('Failed to get emotion statistics:', error);
        return { error: String(error) };
    }
}

/**
 * Ghost-Search: pesquisa avançada via api.ghost1.cloud
 */
export async function ghostSearch(args: {
    query: string;
    model?: string;
    focus?: string;
    time_range?: string;
}): Promise<any> {
    // Always use proxy path — works in dev (Vite proxy) and production (Render _redirects proxy)
    const GHOST_SEARCH_URL = '/api/ghost/search';
    const GHOST_TIMEOUT_MS = 60000; // deep_research pode demorar ate 60s

    // Normalize query: Gemini sometimes sends it as Array(['text']) instead of string
    const normalizedQuery = Array.isArray(args.query) ? args.query.join(' ') : args.query;

    const body: Record<string, string> = {
        query: normalizedQuery,
        model: args.model || 'best',
        focus: args.focus || 'web',
        time_range: args.time_range || 'all',
        citation_mode: 'clean',
        user_id: 'livego_app'
    };

    console.log('[Ghost-Search] Requesting:', body);
    console.log('[Ghost-Search] URL:', GHOST_SEARCH_URL);

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("Timeout de seguranca: 60s sem resposta do Ghost-Search"), GHOST_TIMEOUT_MS);

    try {
        const response = await fetch(GHOST_SEARCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Read as text first to handle empty/non-JSON responses safely
        const rawText = await response.text();
        console.log(`[Ghost-Search] HTTP ${response.status} | Time: ${((Date.now() - startTime)/1000).toFixed(1)}s | Body:`, rawText.length);

        if (!response.ok) {
            return {
                ok: false,
                error: `Ghost-Search HTTP ${response.status}: ${rawText.slice(0, 200)}`,
                query: args.query
            };
        }

        if (!rawText || !rawText.trim()) {
            return {
                ok: false,
                error: 'Ghost-Search retornou resposta vazia',
                query: args.query
            };
        }

        let data: any;
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error('[Ghost-Search] JSON parse error. Raw (first 500 chars):', rawText.slice(0, 500));
            return {
                ok: false,
                error: 'Resposta inválida da API Ghost-Search',
                query: args.query
            };
        }

        console.log('[Ghost-Search] Response:', data.status, data.model_used);

        return {
            ok: data.status === 'success',
            answer: data.answer || '',
            model_used: data.model_used || body.model,
            focus_mode: data.focus_mode || body.focus,
            citations: (data.citations || []).slice(0, 5).map((c: any) => ({
                title: c.title,
                url: c.url
            })),
            has_thinking: data.has_thinking || false,
            thinking: data.thinking || ''
        };
    } catch (error) {
        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Ghost-Search] Error after ${elapsed}s:`, msg);
        
        const isTimeout = msg.includes('abort') || Number(elapsed) >= (GHOST_TIMEOUT_MS / 1000 - 1);
        
        return {
            ok: false,
            error: isTimeout ? `Timeout na busca Ghost-Search apos ${elapsed}s` : msg,
            query: args.query
        };
    }
}

/**
 * Handle tool calls from Gemini
 */
export async function handleToolCall(call: { name: string; args: any }): Promise<any> {
    console.log(`[Tool] Function called: ${call.name}`, call.args);
    const args = call.args || {};

    switch (call.name) {
        case 'get_conversation_history':
            return await getConversationHistory(
                args.days || 7,
                args.emotionFilter || 'all'
            );

        case 'save_emotional_note':
            return await saveEmotionalNote(args);

        case 'get_time_patterns':
            return await getTimePatterns(args.analysisType || 'hourly');

        case 'search_conversation_topic':
            return await searchConversationTopic(
                args.topic,
                args.limit || 5
            );

        case 'get_emotion_statistics':
            return await getEmotionStatistics(args.period || 'week');

        case 'fetch_page':
            return await fetchPage(
                String(args.url || ''),
                Number(args.maxChars || FETCH_PAGE_MAX_CHARS)
            );

        case 'ghost_search':
            return await ghostSearch(args);

        case 'show_image': {
            console.log('[Skill] show_image called:', args);
            // Auto-detect URL in query field
            const imgQuery = args.query || '';
            const isDirectUrl = /^https?:\/\//i.test(imgQuery);
            const imgSource = isDirectUrl ? 'url' : (args.source || 'search');
            // Dispatch a custom event so any component can react
            window.dispatchEvent(new CustomEvent('livego:show_image', {
                detail: {
                    query: imgQuery,
                    caption: args.caption || '',
                    source: imgSource,
                    duration: args.duration || 15,
                    timestamp: Date.now(),
                }
            }));
            return {
                ok: true,
                displayed: true,
                // Minimal response — Gemini already announced the image, 
                // don't give him text that makes him repeat it
            };

        }

        case 'hide_image':
            console.log('[Skill] hide_image called');
            window.dispatchEvent(new CustomEvent('livego:hide_image'));
            return {
                ok: true,
                message: 'Todas as imagens foram removidas da tela.',
            };

        default:
            return { error: `Function ${call.name} not implemented` };
    }
}
