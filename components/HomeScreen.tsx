import React, { memo } from 'react';
import { IconSettings, IconSparkles } from './Icons';
import { useI18n } from '../i18n';

interface HomeScreenProps {
  onStartCall: () => void;
  onSettings: () => void;
  hasApiKey?: boolean;
  onConfigureApiKey?: () => void;
  isConnecting?: boolean;
}

const HomeScreenComponent: React.FC<HomeScreenProps> = ({
  onStartCall,
  onSettings,
  hasApiKey = true,
  onConfigureApiKey,
  isConnecting = false
}) => {
  const { t, locale } = useI18n();
  const isPortuguese = locale === 'pt-BR';

  return (
    <div className="flex flex-col h-full bg-theme-secondary text-theme-primary relative overflow-hidden transition-colors duration-300">

      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-[100%] blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-6 pb-6 relative z-10 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <IconSparkles className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-theme-primary">LIVEGO</span>
        </div>
        <button
          onClick={onSettings}
          disabled={isConnecting}
          className="p-3 rounded-full hover:bg-theme-hover active:bg-theme-active transition-all text-theme-secondary"
          aria-label="Settings"
        >
          <IconSettings className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 pb-20 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 lg:px-16 lg:pb-0">
        <div className="flex flex-col items-center justify-center lg:items-start">
          <div className="text-center mb-12 space-y-2 lg:mb-10 lg:text-left">
            <span className="hidden lg:inline-flex mb-4 items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-indigo-500 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isPortuguese ? 'ASSISTENTE PRONTO' : 'ASSISTANT READY'}
            </span>
            <h2 className="text-3xl font-bold text-theme-primary lg:max-w-xl lg:text-5xl lg:leading-[1.08] lg:tracking-[-0.04em]">{t('home.greetingTitle')}</h2>
            <p className="text-theme-secondary text-lg lg:mt-4 lg:max-w-lg lg:text-xl">{t('home.greetingSubtitle')}</p>
          </div>

          {!hasApiKey && (
            <div
              onClick={onConfigureApiKey}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onConfigureApiKey?.()}
              className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors lg:max-w-lg"
            >
              <p className="text-amber-700 dark:text-amber-300 text-sm font-medium text-center lg:text-left">
                {t('home.apiKeyWarning')}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-7 lg:flex-row lg:gap-8">
            <div className="relative group">
              {!isConnecting && (
                <div className="absolute inset-0 bg-blue-500/20 dark:bg-white/10 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 animate-pulse-ring pointer-events-none" />
              )}

              <button
                onClick={onStartCall}
                onTouchEnd={(e) => {
                  if (!isConnecting && hasApiKey) {
                    e.preventDefault();
                    onStartCall();
                  }
                }}
                disabled={isConnecting || !hasApiKey}
                aria-label={isConnecting ? 'Connecting' : t('home.tapToSpeak')}
                className={`relative flex items-center justify-center rounded-full transition-all duration-300
                  ${isConnecting
                    ? 'w-40 h-40 bg-theme-secondary border-4 border-theme cursor-wait lg:h-44 lg:w-44'
                    : `w-40 h-40 hover:scale-105 lg:h-44 lg:w-44
                       bg-gradient-to-br from-[#4353FF] to-[#2F80ED] shadow-lg shadow-blue-500/30
                       dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/20 dark:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] dark:hover:bg-white/20 dark:hover:border-white/40 dark:from-transparent dark:to-transparent`
                  }
                  ${!hasApiKey ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              >
                {isConnecting ? (
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-theme border-t-indigo-600 dark:border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14 text-white drop-shadow-md lg:h-16 lg:w-16">
                    <path d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8L12 3Z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="hidden max-w-[210px] lg:block">
              <p className="text-base font-semibold text-theme-primary">
                {isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}
              </p>
              <p className="mt-2 text-sm leading-6 text-theme-secondary">
                {isPortuguese ? 'Clique e comece uma conversa por voz em tempo real.' : 'Click and start a real-time voice conversation.'}
              </p>
            </div>
          </div>

          <p className="mt-10 text-sm font-medium text-theme-muted uppercase tracking-widest animate-pulse lg:hidden">
            {isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}
          </p>
        </div>

        <aside className="hidden rounded-[28px] border border-theme bg-theme-primary p-6 lg:block">
          <div className="flex items-center justify-between border-b border-theme pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{isPortuguese ? 'SESSÃO' : 'SESSION'}</p>
              <p className="mt-1 text-lg font-semibold text-theme-primary">{isPortuguese ? 'Nova conversa' : 'New conversation'}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"><IconSparkles className="h-5 w-5" /></span>
          </div>
          <div className="space-y-4 py-5 text-sm">
            <div className="flex items-center justify-between"><span className="text-theme-secondary">{isPortuguese ? 'Voz' : 'Voice'}</span><span className="font-medium text-theme-primary">Zephyr</span></div>
            <div className="flex items-center justify-between"><span className="text-theme-secondary">{isPortuguese ? 'Resposta' : 'Response'}</span><span className="font-medium text-theme-primary">{isPortuguese ? 'Tempo real' : 'Real time'}</span></div>
            <div className="flex items-center justify-between"><span className="text-theme-secondary">{isPortuguese ? 'Contexto' : 'Context'}</span><span className="font-medium text-theme-primary">{isPortuguese ? 'Sob seu controle' : 'Your choice'}</span></div>
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />{isPortuguese ? 'Conexão protegida' : 'Protected connection'}</div>
            <p className="mt-2 text-xs leading-5 text-theme-secondary">{isPortuguese ? 'Credenciais temporárias são priorizadas quando disponíveis.' : 'Temporary credentials are prioritized when available.'}</p>
          </div>
        </aside>
      </div>

    </div>
  );
};

export const HomeScreen = memo(HomeScreenComponent);
