import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconEye,
  IconEyeOff,
  IconLock,
  IconSettings,
  IconSparkles,
  IconTrash
} from '../components/Icons';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const CHAT_HISTORY_KEY = 'livego_chat_history';
const CHAT_ACTIVE_KEY = 'livego_chat_active_session';
const DEFAULT_MODEL = 'gemini-3-flash-preview';

const MODEL_GROUPS = [
  {
    title: 'Image',
    models: ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image']
  },
  {
    title: 'Text',
    models: ['gemini-2.5-pro', 'gemini-3-pro-preview']
  },
  {
    title: 'Text fast',
    models: ['gemini-3-flash-preview', 'gemini-2.5-flash']
  },
  {
    title: 'Text faster',
    models: ['gemini-2.5-flash-lite']
  }
];

const PRESET_MODELS = new Set(MODEL_GROUPS.flatMap(group => group.models));

type ChatRole = 'user' | 'model';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type ChatSession = {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  updatedAt: number;
};

type ErrorState = {
  summary: string;
  details?: string;
};

type ChatScreen = 'chat' | 'history' | 'settings' | 'model' | 'apiKey';

const buildContents = (messages: ChatMessage[]) => {
  return messages.map(message => ({
    role: message.role,
    parts: [{ text: message.text }]
  }));
};

const readStoredApiKey = (): string => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const persistApiKey = (value: string) => {
  try {
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
};

const loadChatHistory = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.id === 'string');
  } catch {
    return [];
  }
};

const persistChatHistory = (sessions: ChatSession[]) => {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage errors.
  }
};

const readActiveSessionId = (): string | null => {
  try {
    return localStorage.getItem(CHAT_ACTIVE_KEY);
  } catch {
    return null;
  }
};

const persistActiveSessionId = (sessionId: string | null) => {
  try {
    if (sessionId) {
      localStorage.setItem(CHAT_ACTIVE_KEY, sessionId);
    } else {
      localStorage.removeItem(CHAT_ACTIVE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
};

const sortSessions = (sessions: ChatSession[]) => {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
};

const formatSessionTime = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '';
  }
};

const buildTitle = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 'New chat';
  const maxLength = 40;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed;
};

const createSessionId = () => {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
};

const createEmptySession = (model: string): ChatSession => ({
  id: createSessionId(),
  title: 'New chat',
  model,
  messages: [],
  updatedAt: Date.now()
});

const normalizeError = (err: unknown): ErrorState => {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  let parsedMessage = raw;

  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed) as { error?: { message?: string } };
      parsedMessage = parsed.error?.message || raw;
    }
  } catch {
    parsedMessage = raw;
  }

  const lower = parsedMessage.toLowerCase();
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('429')) {
    return {
      summary: 'Quota exceeded. Switch model or check billing.',
      details: parsedMessage
    };
  }

  if (lower.includes('unauthorized') || lower.includes('api key') || lower.includes('permission')) {
    return {
      summary: 'API key error. Check your key and billing.',
      details: parsedMessage
    };
  }

  return {
    summary: 'Request failed. Check your model and API key.',
    details: parsedMessage
  };
};

const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-full bg-[#f3f4f6]">
    {children}
  </div>
);

const DetailHeader: React.FC<{ title: string; subtitle?: string; onBack: () => void }> = ({ title, subtitle, onBack }) => (
  <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
    <button type="button" onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
      <IconChevronLeft className="w-6 h-6" />
    </button>
    <div className="flex-1 text-center mr-8">
      <h1 className="text-[17px] font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="text-xs text-gray-500 font-medium">{subtitle}</p>}
    </div>
  </div>
);

const SettingsGroup: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const titleId = React.useId();

  return (
    <div className="mb-6" role="group" aria-labelledby={title ? titleId : undefined}>
      {title && <h3 id={titleId} className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-4 mb-2">{title}</h3>}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {children}
      </div>
    </div>
  );
};

const SettingsItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
  isLast?: boolean;
  color?: string;
}> = ({ icon, label, value, onClick, isLast, color = 'bg-gray-100' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-gray-100' : ''}`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-white ${color}`}>
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
    </div>
    <div className="flex-1 flex justify-between items-center mr-2">
      <span className="text-[15px] font-medium text-gray-900">{label}</span>
      {value && <span className="text-[14px] text-gray-400">{value}</span>}
    </div>
    <IconChevronRight className="text-gray-300 w-5 h-5 shrink-0" />
  </button>
);

const ModelOption: React.FC<{
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  isLast?: boolean;
}> = ({ label, isSelected, onSelect, isLast }) => (
  <button
    type="button"
    role="radio"
    aria-checked={isSelected}
    onClick={onSelect}
    className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-gray-100' : ''}`}
  >
    <span className="text-[15px] font-medium text-gray-900">{label}</span>
    {isSelected && <IconCheck className="w-5 h-5 text-blue-500" />}
  </button>
);

const ChatApp: React.FC = () => {
  const [apiKey, setApiKey] = useState(readStoredApiKey);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadChatHistory());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => readActiveSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [screen, setScreen] = useState<ChatScreen>('chat');
  const [showApiKey, setShowApiKey] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const resolvedApiKey = apiKey || process.env.API_KEY || '';
  const modelValue = model.trim() || DEFAULT_MODEL;
  const canSend = Boolean(resolvedApiKey) && input.trim().length > 0 && !isSending;
  const isCustomModel = !PRESET_MODELS.has(modelValue);

  const activeSession = useMemo(() => {
    return sessions.find(session => session.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const orderedSessions = useMemo(() => sortSessions(sessions), [sessions]);

  const headerSubtitle = useMemo(() => {
    const title = activeSession?.title || 'New chat';
    return `${title} - ${modelValue}`;
  }, [activeSession, modelValue]);

  useEffect(() => {
    document.title = 'LIVEGO - Chat Lab';
  }, []);

  useEffect(() => {
    persistChatHistory(sessions);
  }, [sessions]);

  useEffect(() => {
    persistActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    const session = sessions.find(item => item.id === activeSessionId);
    if (session) {
      setMessages(session.messages);
      setModel(session.model || DEFAULT_MODEL);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (screen !== 'chat') return;
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length, screen]);

  useEffect(() => {
    if (activeSessionId && !sessions.some(session => session.id === activeSessionId)) {
      const fallback = orderedSessions[0];
      setActiveSessionId(fallback ? fallback.id : null);
    }
  }, [activeSessionId, orderedSessions, sessions]);

  const clearError = () => {
    setError(null);
    setShowErrorDetails(false);
  };

  const handleModelChange = (value: string) => {
    clearError();
    setModel(value);
    const nextModel = value.trim() || DEFAULT_MODEL;
    if (activeSessionId) {
      setSessions(prev => {
        const next = prev.map(session => {
          if (session.id !== activeSessionId) return session;
          return {
            ...session,
            model: nextModel,
            updatedAt: Date.now()
          };
        });
        return sortSessions(next);
      });
    }
  };

  const handleSend = async () => {
    if (!canSend) return;

    const trimmed = input.trim();
    const now = Date.now();
    const sessionModel = modelValue;
    const userMessage: ChatMessage = {
      id: `${now}-user`,
      role: 'user',
      text: trimmed
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsSending(true);
    setError(null);
    setShowErrorDetails(false);

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createSessionId();
      const newSession: ChatSession = {
        id: sessionId,
        title: buildTitle(trimmed),
        model: sessionModel,
        messages: nextMessages,
        updatedAt: now
      };
      setSessions(prev => sortSessions([newSession, ...prev]));
      setActiveSessionId(sessionId);
    } else {
      setSessions(prev => {
        const next = prev.map(session => {
          if (session.id !== sessionId) return session;
          const title = session.title && session.title !== 'New chat' ? session.title : buildTitle(trimmed);
          return {
            ...session,
            title,
            model: sessionModel,
            messages: nextMessages,
            updatedAt: now
          };
        });
        return sortSessions(next);
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: resolvedApiKey });
      const response = await ai.models.generateContent({
        model: sessionModel,
        contents: buildContents(nextMessages)
      });
      const replyText = response.text || 'No response text returned.';
      const modelMessage: ChatMessage = {
        id: `${Date.now()}-model`,
        role: 'model',
        text: replyText
      };

      setMessages(current => [...current, modelMessage]);
      setSessions(prev => {
        const next = prev.map(session => {
          if (session.id !== sessionId) return session;
          return {
            ...session,
            model: sessionModel,
            messages: [...session.messages, modelMessage],
            updatedAt: Date.now()
          };
        });
        return sortSessions(next);
      });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleApiKeyChange = (value: string) => {
    clearError();
    setApiKey(value);
    persistApiKey(value);
  };

  const handleNewChat = () => {
    clearError();
    const newSession = createEmptySession(modelValue);
    setSessions(prev => sortSessions([newSession, ...prev]));
    setActiveSessionId(newSession.id);
    setMessages([]);
    setInput('');
    setScreen('chat');
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(session => session.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      clearError();
    }
  };

  const handleSelectSession = (sessionId: string) => {
    clearError();
    setActiveSessionId(sessionId);
    setScreen('chat');
  };

  const openHistory = () => {
    setScreen('history');
  };

  const openSettings = () => {
    setScreen('settings');
  };

  const apiKeyLabel = apiKey
    ? 'Saved'
    : resolvedApiKey
      ? 'Using env key'
      : 'Not set';
  const historyLabel = `${sessions.length} ${sessions.length === 1 ? 'chat' : 'chats'}`;

  return (
    <div className="w-full h-[100dvh] md:flex md:justify-center md:items-center md:min-h-screen md:bg-[#e5e5e5] font-sans">
      <div className="w-full h-full md:max-w-[390px] md:h-[844px] relative overflow-hidden md:rounded-[40px] md:shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] md:border-[8px] md:border-black md:bg-black">
        <div className="w-full h-full bg-white overflow-hidden md:rounded-[32px] flex flex-col relative">
          {screen === 'chat' && (
            <div className="flex flex-col h-full bg-[#f3f4f6]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.location.assign('/')}
                    className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
                    title="Back"
                  >
                    <IconChevronLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h1 className="text-[17px] font-semibold text-gray-900">Chat Lab</h1>
                    <p className="text-xs text-gray-500">{headerSubtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openHistory}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title="History"
                  >
                    <IconClock className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={openSettings}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title="Settings"
                  >
                    <IconSettings className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <IconSparkles className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="px-6 pt-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400">Active model</p>
                    <p className="text-sm font-semibold text-gray-900">{modelValue}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
                  >
                    New chat
                  </button>
                </div>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm mt-10">
                    Start a new conversation with Gemini text-to-text.
                  </div>
                ) : (
                  messages.map(message => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] px-4 py-3 text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap
                          ${message.role === 'user'
                            ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                            : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-sm'
                          }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {error && (
                <div className="px-6 mb-4">
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Error</p>
                        <p>{error.summary}</p>
                        {error.details && (
                          <button
                            type="button"
                            onClick={() => setShowErrorDetails(prev => !prev)}
                            className="mt-2 text-[11px] text-red-500 hover:text-red-700"
                          >
                            {showErrorDetails ? 'Hide details' : 'Show details'}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={clearError}
                        className="text-[11px] text-red-500 hover:text-red-700"
                      >
                        Dismiss
                      </button>
                    </div>
                    {showErrorDetails && error.details && (
                      <pre className="mt-2 text-[11px] text-red-600 whitespace-pre-wrap break-words">
                        {error.details}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div className="px-6 pb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={input}
                      onChange={(event) => {
                        clearError();
                        setInput(event.target.value);
                      }}
                      onKeyDown={handleInputKeyDown}
                      rows={2}
                      className="flex-1 resize-none px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                      placeholder="Type a message..."
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSend}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {screen === 'history' && (
            <ContentWrapper>
              <DetailHeader title="Chat history" onBack={() => setScreen('chat')} />
              <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                {orderedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                    <IconClock className="w-16 h-16 mb-4" />
                    <p>No chats yet.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                    {orderedSessions.map((session, index) => {
                      const isActive = session.id === activeSessionId;
                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectSession(session.id)}
                          className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${index !== orderedSessions.length - 1 ? 'border-b border-gray-100' : ''} ${isActive ? 'bg-blue-50' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4 text-blue-600">
                            <IconClock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">{session.title}</div>
                            <div className="text-xs text-gray-500">
                              {session.model} - {formatSessionTime(session.updatedAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <IconTrash className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ContentWrapper>
          )}

          {screen === 'settings' && (
            <ContentWrapper>
              <DetailHeader title="Chat settings" onBack={() => setScreen('chat')} />
              <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                <SettingsGroup title="Chat">
                  <SettingsItem
                    icon={<IconSparkles />}
                    label="Model"
                    value={modelValue}
                    color="bg-indigo-500"
                    onClick={() => setScreen('model')}
                  />
                  <SettingsItem
                    icon={<IconLock />}
                    label="API key"
                    value={apiKeyLabel}
                    color="bg-emerald-500"
                    onClick={() => setScreen('apiKey')}
                    isLast
                  />
                </SettingsGroup>

                <SettingsGroup title="History">
                  <SettingsItem
                    icon={<IconClock />}
                    label="Chat history"
                    value={historyLabel}
                    color="bg-teal-500"
                    onClick={() => setScreen('history')}
                    isLast
                  />
                </SettingsGroup>
              </div>
            </ContentWrapper>
          )}

          {screen === 'model' && (
            <ContentWrapper>
              <DetailHeader title="Model" onBack={() => setScreen('settings')} />
              <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                {MODEL_GROUPS.map(group => (
                  <SettingsGroup key={group.title} title={group.title}>
                    <div role="radiogroup" aria-label={group.title}>
                      {group.models.map((preset, index) => (
                        <ModelOption
                          key={preset}
                          label={preset}
                          isSelected={modelValue === preset}
                          onSelect={() => handleModelChange(preset)}
                          isLast={index === group.models.length - 1}
                        />
                      ))}
                    </div>
                  </SettingsGroup>
                ))}

                <SettingsGroup title="Custom model">
                  <div className="p-4">
                    <input
                      value={model}
                      onChange={(event) => handleModelChange(event.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                      placeholder={DEFAULT_MODEL}
                      aria-label="Custom model"
                    />
                    <p className="mt-2 text-xs text-gray-500">Enter any model ID.</p>
                    {isCustomModel && (
                      <p className="mt-2 text-xs text-blue-600">Active: {modelValue}</p>
                    )}
                  </div>
                </SettingsGroup>
              </div>
            </ContentWrapper>
          )}

          {screen === 'apiKey' && (
            <ContentWrapper>
              <DetailHeader title="API key" onBack={() => setScreen('settings')} />
              <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                <SettingsGroup title="API key">
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(event) => handleApiKeyChange(event.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                        placeholder="Use Settings key or paste here"
                        aria-label="API key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(prev => !prev)}
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {showApiKey ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
                      </button>
                    </div>
                    {!resolvedApiKey && (
                      <p className="mt-2 text-xs text-amber-600">
                        API key is required to send messages.
                      </p>
                    )}
                    {resolvedApiKey && !apiKey && (
                      <p className="mt-2 text-xs text-gray-500">
                        Using env key.
                      </p>
                    )}
                  </div>
                </SettingsGroup>
              </div>
            </ContentWrapper>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatApp;
