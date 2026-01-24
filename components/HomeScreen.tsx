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
  const { t } = useI18n();

  return (
    <div className="flex flex-col h-full bg-theme-secondary text-theme-primary relative overflow-hidden transition-colors duration-300">

      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-[100%] blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-6 pb-6 relative z-10">
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
      <div className="flex-1 flex flex-col items-center justify-center z-10 pb-20">

        <div className="text-center mb-12 space-y-2">
          <h2 className="text-3xl font-bold text-theme-primary">{t('home.greetingTitle')}</h2>
          <p className="text-theme-secondary text-lg">{t('home.greetingSubtitle')}</p>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div
            onClick={onConfigureApiKey}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onConfigureApiKey?.()}
            className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            <p className="text-amber-700 dark:text-amber-300 text-sm font-medium text-center">
              {t('home.apiKeyWarning')}
            </p>
          </div>
        )}

        {/* Hero Button */}
        <div className="relative group">
          {/* Pulse Ring - only in light mode */}
          {!isConnecting && (
            <div className="absolute inset-0 bg-blue-500/20 dark:bg-white/10 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 animate-pulse-ring" />
          )}

          <button
            onClick={onStartCall}
            disabled={isConnecting || !hasApiKey}
            aria-label={isConnecting ? 'Connecting' : t('home.tapToSpeak')}
            className={`group relative flex items-center justify-center rounded-full transition-all duration-300 transform
                ${isConnecting
                ? 'w-40 h-40 bg-theme-secondary border-4 border-theme cursor-wait'
                : `w-40 h-40 hover:scale-105 active:scale-95
                     /* Light Mode: Gradient Blue */
                     bg-gradient-to-br from-[#4353FF] to-[#2F80ED] shadow-lg shadow-blue-500/30
                     /* Dark Mode: Glassmorphism */
                     dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/20 dark:shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] dark:hover:bg-white/20 dark:hover:border-white/40 dark:from-transparent dark:to-transparent`
              } 
                ${!hasApiKey ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Hover glow overlay for dark mode */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 dark:block hidden" />

            {isConnecting ? (
              <div className="relative">
                <div className="w-12 h-12 border-4 border-theme border-t-indigo-600 dark:border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14 text-white drop-shadow-md">
                <path d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8L12 3Z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-10 text-sm font-medium text-theme-muted uppercase tracking-widest animate-pulse">
          {isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}
        </p>
      </div>

    </div>
  );
};

export const HomeScreen = memo(HomeScreenComponent);
