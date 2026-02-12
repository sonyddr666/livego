/**
 * Data Functions for Gemini Function Calling
 * These functions interact with localStorage to provide data to Gemini
 */

import { EmotionalNote, ConversationEntry, EmotionStatistics, TimePattern, EmotionType } from '../types';

const EMOTIONAL_NOTES_KEY = 'livego_emotional_notes';
const CONVERSATION_HISTORY_KEY = 'livego_history';

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
        console.log('📜 Raw history from localStorage:', history);

        const entries = history.map((item: any) => ({
            id: item.id,
            timestamp: parseBrazilianDate(item.date).toISOString(), // Convert to ISO format
            duration: parseDurationToMinutes(item.duration),
            transcript: item.transcript || '',
            emotion: item.emotion || 'unknown',
            intensity: item.intensity || 5
        }));

        console.log('📜 Parsed entries:', entries);
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

// ============================================================
// Web Fetch Functions
// ============================================================

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Strip HTML tags and clean up text content
 */
function stripHtml(html: string): string {
    // Remove scripts, styles, SVG, nav, header, footer
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // Convert structural tags to newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|article|section)>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = text.replace(/<h([1-6])[^>]*>/gi, '\n## ');

    // Remove all remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&#\d+;/g, '');

    // Clean whitespace
    text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return text;
}

/**
 * Extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): Array<{ title: string; url: string }> {
    const links: Array<{ title: string; url: string }> = [];
    const regex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const href = match[1];
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        if (title && href && !href.startsWith('javascript:') && title.length > 3) {
            try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                links.push({ title: title.substring(0, 120), url: fullUrl });
            } catch {
                // Invalid URL, skip
            }
        }
    }

    // Deduplicate by URL
    const unique = [...new Map(links.map(l => [l.url, l])).values()];
    return unique.slice(0, 30);
}

/**
 * Fetch and analyze a web page
 * Modes: 'full' (complete text), 'links' (extract links), 'specific' (search for query)
 */
export async function fetchPage(
    url: string,
    mode: string = 'full',
    query?: string
): Promise<any> {
    console.log(`🌐 fetch_page: ${url} (mode: ${mode}, query: ${query || 'none'})`);

    try {
        // Normalize URL
        if (!url.startsWith('http')) url = 'https://' + url;

        // Fetch with CORS fallback
        let html: string;
        try {
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(10000),
                headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            html = await resp.text();
            console.log('🌐 Direct fetch OK');
        } catch (directError) {
            console.log('🌐 Direct fetch failed, using CORS proxy...', directError);
            const resp = await fetch(CORS_PROXY + encodeURIComponent(url), {
                signal: AbortSignal.timeout(15000)
            });
            if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
            html = await resp.text();
            console.log('🌐 Proxy fetch OK');
        }

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Sem título';

        // MODE: links - return list of links/posts
        if (mode === 'links') {
            const links = extractLinks(html, url);
            return {
                url,
                title: pageTitle,
                totalLinks: links.length,
                links: links,
                hint: 'Apresente os links como lista organizada. Pergunte ao usuário qual quer ler em detalhe.'
            };
        }

        // Extract clean text
        const fullText = stripHtml(html);

        // MODE: specific - search for specific data
        if (mode === 'specific' && query) {
            const queryLower = query.toLowerCase();
            const lines = fullText.split('\n').filter(l =>
                l.toLowerCase().includes(queryLower)
            );
            return {
                url,
                title: pageTitle,
                query,
                found: lines.length,
                matches: lines.slice(0, 10).map(l => l.trim().substring(0, 300)),
                context: fullText.substring(0, 2000),
                hint: 'Apresente os matches encontrados de forma organizada. Se não encontrou, sugira buscar com outro termo.'
            };
        }

        // MODE: full - complete text (with token economy)
        const MAX_CONTENT = 6000;
        const truncated = fullText.length > MAX_CONTENT;
        const content = truncated
            ? fullText.substring(0, MAX_CONTENT) + '\n\n[... conteúdo truncado ...]'
            : fullText;

        return {
            url,
            title: pageTitle,
            contentLength: fullText.length,
            truncated,
            content,
            hint: truncated
                ? 'O conteúdo foi resumido. Analise e apresente os pontos principais. Se o usuário precisar de mais detalhes, use mode "specific" com uma query.'
                : 'Analise e apresente o conteúdo de forma conversacional e organizada.'
        };

    } catch (error) {
        console.error('🌐 fetch_page error:', error);
        return {
            url,
            error: `Não foi possível acessar: ${(error as Error).message}`,
            hint: 'Informe ao usuário que o site pode estar bloqueando acesso, fora do ar, ou exigir login. Sugira tentar outra URL.'
        };
    }
}

// ============================================================
// Tool Call Handler
// ============================================================

/**
 * Handle tool calls from Gemini
 */
export async function handleToolCall(call: { name: string; args: any }): Promise<any> {
    console.log(`🔧 Function chamada: ${call.name}`, call.args);

    switch (call.name) {
        case 'get_conversation_history':
            return await getConversationHistory(
                call.args.days || 7,
                call.args.emotionFilter || 'all'
            );

        case 'save_emotional_note':
            return await saveEmotionalNote(call.args);

        case 'get_time_patterns':
            return await getTimePatterns(call.args.analysisType || 'hourly');

        case 'search_conversation_topic':
            return await searchConversationTopic(
                call.args.topic,
                call.args.limit || 5
            );

        case 'get_emotion_statistics':
            return await getEmotionStatistics(call.args.period || 'week');

        case 'fetch_page':
            return await fetchPage(
                call.args.url,
                call.args.mode || 'full',
                call.args.query
            );

        default:
            return { error: `Função ${call.name} não implementada` };
    }
}
