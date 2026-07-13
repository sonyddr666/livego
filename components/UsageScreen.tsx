import React, { useEffect, useMemo, useState, useRef, memo } from 'react';
import { Visualizer } from './Visualizer';
import { IconMic, IconMicOff, IconPhoneOff, IconVolume2, IconSettings, IconMonitor } from './Icons';
import { ImageOverlay } from './ImageOverlay';
import { useI18n } from '../i18n';

interface UsageScreenProps {
  onEndCall: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
  caption: string;
  getAnalysers: () => { input: AnalyserNode | null, output: AnalyserNode | null };
  isScreenSharing: boolean;
  toggleScreenShare: () => void;
  onSendText: (text: string) => boolean;
}

type SearchNotice = {
  query: string;
  status: 'searching' | 'success' | 'error';
};

const SEARCH_RESULT_VISIBLE_MS = 3000;
const MAX_VISIBLE_TRANSCRIPT_CHARS = 420;
const TRANSCRIPT_PREVIEW_CHARS = 240;

type TranscriptTurn = {
  speaker: 'user' | 'gemini' | 'unknown';
  text: string;
};

function parseTranscript(transcript: string): TranscriptTurn[] {
  if (!transcript.trim()) return [];

  const markerPattern = /(?:^|\n)(User|Gemini):\s*/g;
  const markers = [...transcript.matchAll(markerPattern)];
  if (markers.length === 0) return [{ speaker: 'unknown', text: transcript.trim() }];

  const turns: TranscriptTurn[] = [];
  const firstMarkerIndex = markers[0]?.index ?? 0;
  const leadingText = transcript.slice(0, firstMarkerIndex).trim();
  if (leadingText) turns.push({ speaker: 'unknown', text: leadingText });

  markers.forEach((marker, index) => {
    const contentStart = (marker.index ?? 0) + marker[0].length;
    const contentEnd = markers[index + 1]?.index ?? transcript.length;
    const text = transcript.slice(contentStart, contentEnd).trim();
    if (!text) return;
    turns.push({
      speaker: marker[1] === 'User' ? 'user' : 'gemini',
      text,
    });
  });

  return turns;
}

const UsageScreenComponent: React.FC<UsageScreenProps> = ({
  onEndCall,
  isMuted,
  toggleMute,
  isSpeakerOn,
  toggleSpeaker,
  caption,
  getAnalysers,
  isScreenSharing,
  toggleScreenShare,
  onSendText,
}) => {
  const { t, locale } = useI18n();
  const isPortuguese = locale === 'pt-BR';
  const [seconds, setSeconds] = useState(0);
  const [textDraft, setTextDraft] = useState('');
  const mobileCaptionRef = useRef<HTMLDivElement>(null);
  const desktopCaptionRef = useRef<HTMLDivElement>(null);

  // Visual status only. Ghost Search execution remains managed by useLiveAPI.
  const [searchNotice, setSearchNotice] = useState<SearchNotice | null>(null);
  const searchNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onSearchStart = (e: Event) => {
      const query = (e as CustomEvent).detail?.query || '';
      if (searchNoticeTimerRef.current) clearTimeout(searchNoticeTimerRef.current);
      setSearchNotice({ query, status: 'searching' });
    };
    const onSearchDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setSearchNotice({
        query: detail.query || '',
        status: detail.ok ? 'success' : 'error',
      });
      if (searchNoticeTimerRef.current) clearTimeout(searchNoticeTimerRef.current);
      searchNoticeTimerRef.current = setTimeout(
        () => setSearchNotice(null),
        SEARCH_RESULT_VISIBLE_MS,
      );
    };
    window.addEventListener('livego:search_active', onSearchStart);
    window.addEventListener('livego:search_done', onSearchDone);
    return () => {
      window.removeEventListener('livego:search_active', onSearchStart);
      window.removeEventListener('livego:search_done', onSearchDone);
      if (searchNoticeTimerRef.current) clearTimeout(searchNoticeTimerRef.current);
    };
  }, []);

  const localizedCaption = useMemo(() => {
    if (!caption) return caption;
    const userLabel = t('transcript.userLabel');
    const geminiLabel = t('transcript.geminiLabel');
    return caption
      .replace(/(^|\n)User: /g, `$1${userLabel}: `)
      .replace(/(^|\n)Gemini: /g, `$1${geminiLabel}: `);
  }, [caption, t]);

  const transcriptTurns = useMemo(() => parseTranscript(caption), [caption]);

  const submitTextMessage = () => {
    const message = textDraft.trim();
    if (!message) return;
    if (onSendText(message)) setTextDraft('');
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to bottom when caption changes
  useEffect(() => {
    [mobileCaptionRef.current, desktopCaptionRef.current].forEach(element => {
      if (element) element.scrollTop = element.scrollHeight;
    });
  }, [caption]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white relative overflow-hidden transition-colors duration-500">

      {/* Ambient Background */}
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-indigo-900/30 via-black to-blue-900/20 blur-3xl pointer-events-none" />

      {/* Image Overlay — show_image skill */}
      <ImageOverlay />

      {/* Ghost Search status — progress stays visible; result remains for 3 seconds. */}
      {searchNotice && (
        <div
          className="absolute top-24 left-0 right-0 2xl:right-[390px] flex justify-center px-4 z-30 pointer-events-none animate-in"
          role="status"
          aria-live="polite"
        >
          <div className={`flex max-w-[min(92vw,430px)] items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl shadow-lg ${
            searchNotice.status === 'searching'
              ? 'border-purple-400/35 bg-purple-600/85 shadow-purple-500/25'
              : searchNotice.status === 'success'
                ? 'border-emerald-400/35 bg-emerald-700/90 shadow-emerald-500/20'
                : 'border-rose-400/35 bg-rose-700/90 shadow-rose-500/20'
          }`}>
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full bg-white ${searchNotice.status === 'searching' ? 'animate-pulse' : ''}`} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                {searchNotice.status === 'searching'
                  ? (isPortuguese ? '🔍 Buscando com Ghost' : '🔍 Searching with Ghost')
                  : searchNotice.status === 'success'
                    ? (isPortuguese ? '✓ Pesquisa concluída' : '✓ Search complete')
                    : (isPortuguese ? '✕ Pesquisa não concluída' : '✕ Search failed')}
              </p>
              {searchNotice.query && (
                <p className="mt-0.5 truncate text-xs text-white/75">{searchNotice.query}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-12 pb-6 lg:pt-7 lg:px-10 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">{t('usage.live')}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-gray-400 font-mono text-sm tracking-wider" aria-live="polite">{formatTime(seconds)}</span>
        </div>
        <button
          disabled
          className="p-2 rounded-full transition-colors text-gray-600 opacity-30 cursor-not-allowed"
          title={t('usage.settingsDisabled')}
          aria-label="Settings disabled during call"
        >
          <IconSettings className="w-6 h-6" />
        </button>
      </div>

      {/* Session workspace */}
      <div className="flex-1 min-h-0 relative z-10 w-full mb-20 lg:mb-0 lg:px-6 lg:pb-6 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:gap-6">
        <div className="h-full flex flex-col items-center justify-center">
          <div className="mb-4 text-center px-8">
            <h2 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">{t('usage.listening')}</h2>
            <p className="text-gray-500 mt-2 text-sm">{t('usage.geminiActive')}</p>
          </div>

          <Visualizer analysers={getAnalysers()} isMuted={isMuted} />
        </div>

        <aside className="hidden 2xl:flex min-h-0 flex-col rounded-[28px] border border-white/10 bg-white/[0.035] backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">
                {isPortuguese ? 'Sessão em andamento' : 'Session in progress'}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {isPortuguese ? 'Transcrição ao vivo' : 'Live transcript'}
              </h3>
            </div>
            <span className="font-mono text-xs text-gray-400">{formatTime(seconds)}</span>
          </div>
          <div
            ref={desktopCaptionRef}
            className="flex-1 min-h-0 overflow-y-auto px-6 py-5 no-scrollbar scroll-smooth"
            role="log"
            aria-live="polite"
          >
            {transcriptTurns.length > 0 ? (
              <div className="space-y-3">
                {transcriptTurns.map((turn, index) => {
                  const isLongContent = turn.text.length > MAX_VISIBLE_TRANSCRIPT_CHARS;
                  const visibleText = isLongContent
                    ? `${turn.text.slice(0, TRANSCRIPT_PREVIEW_CHARS).trimEnd()}…`
                    : turn.text;
                  const isUser = turn.speaker === 'user';
                  const isGemini = turn.speaker === 'gemini';

                  return (
                    <article
                      key={`${turn.speaker}-${index}`}
                      className={`rounded-2xl border px-4 py-3 ${
                        isUser
                          ? 'border-purple-400/20 bg-purple-500/10'
                          : isGemini
                            ? 'border-blue-400/20 bg-blue-500/10'
                            : 'border-white/10 bg-white/[0.035]'
                      }`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                        isUser ? 'text-purple-300' : isGemini ? 'text-blue-300' : 'text-gray-500'
                      }`}>
                        {isUser
                          ? (isPortuguese ? 'Usuário' : 'You')
                          : isGemini
                            ? 'Gemini'
                            : (isPortuguese ? 'Transcrição' : 'Transcript')}
                      </p>
                      <p className={`mt-1.5 whitespace-pre-wrap text-[13px] leading-6 ${
                        isUser ? 'text-purple-100' : isGemini ? 'text-blue-100' : 'text-gray-300'
                      }`}>
                        {visibleText}
                      </p>
                      {isLongContent && (
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {isPortuguese
                            ? `Conteúdo extenso · ${turn.text.length} caracteres`
                            : `Long content · ${turn.text.length} characters`}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center mb-4">
                  <IconMic className="w-5 h-5 text-indigo-300" />
                </div>
                <p className="text-sm font-medium text-gray-300">
                  {isPortuguese ? 'A conversa aparecerá aqui' : 'The conversation will appear here'}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  {isPortuguese ? 'Fale normalmente. O histórico desta sessão acompanha você sem cobrir os controles.' : 'Speak naturally. This session history stays visible without covering the controls.'}
                </p>
              </div>
            )}
          </div>
          <form
            className="border-t border-white/10 bg-black/20 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitTextMessage();
            }}
          >
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2 focus-within:border-indigo-400/50 focus-within:bg-white/[0.07]">
              <textarea
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitTextMessage();
                  }
                }}
                rows={1}
                maxLength={10000}
                placeholder={isPortuguese ? 'Enviar texto ao Gemini…' : 'Send text to Gemini…'}
                aria-label={isPortuguese ? 'Mensagem para o Gemini' : 'Message to Gemini'}
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-gray-600"
              />
              <button
                type="submit"
                disabled={!textDraft.trim()}
                aria-label={isPortuguese ? 'Enviar mensagem' : 'Send message'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-lg font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↑
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-gray-600">
              {isPortuguese ? 'Enter envia · Shift+Enter quebra a linha' : 'Enter sends · Shift+Enter adds a line'}
            </p>
          </form>
        </aside>
      </div>

      {/* Captions Overlay (Fixed position above controls) */}
      <div className={`absolute bottom-[200px] left-0 right-0 px-6 flex 2xl:hidden justify-center z-20 pointer-events-none transition-opacity duration-300 ${caption ? 'opacity-100' : 'opacity-0'}`}>
        <div
          ref={mobileCaptionRef}
          className="glass-dark rounded-xl px-5 py-3 max-w-[85%] md:max-w-[320px] pointer-events-auto max-h-[160px] overflow-y-auto no-scrollbar scroll-smooth"
          role="log"
          aria-live="polite"
        >
          <p className="text-center text-[13px] font-medium leading-relaxed text-gray-100 whitespace-pre-wrap">
            {localizedCaption}
          </p>
        </div>
      </div>

      {/* Controls Dock - Fixed at bottom */}
      <div className="px-8 pb-10 relative z-30 lg:absolute lg:left-8 lg:right-8 lg:bottom-8 lg:p-0 2xl:right-[392px]">
        <div className="glass-dark rounded-3xl p-5 flex justify-between items-center shadow-2xl lg:max-w-[560px] lg:mx-auto lg:px-8">

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={isMuted}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-95 ${isMuted ? 'text-red-400' : 'text-white'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
              {isMuted ? <IconMicOff className="w-6 h-6" /> : <IconMic className="w-6 h-6" />}
            </div>
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
              {isMuted ? t('usage.muted') : t('usage.mute')}
            </span>
          </button>

          {/* End Call */}
          <button
            onClick={onEndCall}
            aria-label="End call"
            className="flex flex-col items-center gap-1.5 active:scale-95"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 shadow-lg shadow-red-500/30 text-white transition-transform hover:scale-105">
              <IconPhoneOff className="w-8 h-8 fill-current" />
            </div>
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">{t('usage.end')}</span>
          </button>

          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            aria-label={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
            aria-pressed={isSpeakerOn}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-95 ${isSpeakerOn ? 'text-blue-400' : 'text-white'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-blue-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
              <IconVolume2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
              {isSpeakerOn ? t('usage.speaker') : t('usage.speakerMuted')}
            </span>
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            aria-label={isScreenSharing ? 'Stop screen share' : 'Start screen share'}
            aria-pressed={isScreenSharing}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-95 ${isScreenSharing ? 'text-green-400' : 'text-white'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-green-500/15 animate-pulse' : 'bg-white/5 hover:bg-white/10'}`}>
              <IconMonitor className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
              {isScreenSharing ? 'Tela On' : 'Tela'}
            </span>
          </button>

        </div>
      </div>

    </div>
  );
};

export const UsageScreen = memo(UsageScreenComponent);
