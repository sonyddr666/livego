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
  isConnecting = false,
}) => {
  const { t } = useI18n();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-theme-secondary text-theme-primary transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_42%,rgba(30,64,175,.16),transparent_42%)] lg:block" />
      <div className="pointer-events-none absolute -left-[20%] -top-[20%] h-[60%] w-[140%] rounded-[100%] bg-gradient-to-b from-indigo-500/10 to-transparent blur-3xl lg:hidden" />

      {/* The current mobile header remains untouched below the desktop breakpoint. */}
      <div className="relative z-10 flex items-center justify-between px-8 pb-6 pt-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg">
            <IconSparkles className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-theme-primary">LIVEGO</span>
        </div>
        <button onClick={onSettings} disabled={isConnecting} className="rounded-full p-3 text-theme-secondary transition-all hover:bg-theme-hover active:bg-theme-active" aria-label="Settings">
          <IconSettings className="h-6 w-6" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 lg:pb-4">
        <div className="mb-12 space-y-2 text-center lg:mb-14">
          <h2 className="text-3xl font-bold text-theme-primary lg:text-[38px] lg:leading-tight lg:tracking-[-0.025em]">{t('home.greetingTitle')}</h2>
          <p className="text-lg text-theme-secondary lg:mt-3 lg:text-[18px]">{t('home.greetingSubtitle')}</p>
        </div>

        {!hasApiKey && (
          <div onClick={onConfigureApiKey} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && onConfigureApiKey?.()} className="mb-6 max-w-md cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50">
            <p className="text-center text-sm font-medium text-amber-700 dark:text-amber-300">{t('home.apiKeyWarning')}</p>
          </div>
        )}

        <div className="relative group">
          {!isConnecting && <div className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full bg-blue-500/20 blur-2xl transition-all duration-500 group-hover:blur-3xl dark:bg-blue-500/10" />}
          <button
            onClick={onStartCall}
            onTouchEnd={event => {
              if (!isConnecting && hasApiKey) {
                event.preventDefault();
                onStartCall();
              }
            }}
            disabled={isConnecting || !hasApiKey}
            aria-label={isConnecting ? 'Connecting' : t('home.tapToSpeak')}
            className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${isConnecting
              ? 'h-40 w-40 cursor-wait border-4 border-theme bg-theme-secondary lg:h-48 lg:w-48'
              : 'h-40 w-40 bg-gradient-to-br from-[#4353FF] to-[#2F80ED] shadow-lg shadow-blue-500/30 hover:scale-105 dark:border dark:border-white/20 dark:bg-white/10 dark:from-transparent dark:to-transparent lg:h-48 lg:w-48 lg:border-blue-400/45 lg:bg-[#15171c] lg:shadow-[0_0_70px_rgba(48,91,255,.22)] lg:hover:border-blue-400/70 lg:hover:bg-[#1a1d24]'
            } ${!hasApiKey ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            {isConnecting ? (
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-theme border-t-indigo-600 dark:border-t-white" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-14 w-14 text-white drop-shadow-md lg:h-16 lg:w-16">
                <path d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8L12 3Z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-10 animate-pulse text-sm font-medium uppercase tracking-widest text-theme-muted">
          {isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}
        </p>
      </div>
    </div>
  );
};

export const HomeScreen = memo(HomeScreenComponent);
