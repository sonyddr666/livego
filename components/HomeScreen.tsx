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

interface SpeakButtonProps {
  onStartCall: () => void;
  hasApiKey: boolean;
  isConnecting: boolean;
  desktop?: boolean;
}

const SpeakButton: React.FC<SpeakButtonProps> = ({ onStartCall, hasApiKey, isConnecting, desktop = false }) => {
  const { t } = useI18n();
  return (
    <div className="relative group">
      {!isConnecting && <div className="absolute inset-0 bg-blue-500/20 dark:bg-white/10 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 animate-pulse-ring pointer-events-none" />}
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
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${desktop ? 'h-48 w-48' : 'h-40 w-40'} ${isConnecting
          ? 'bg-theme-secondary border-4 border-theme cursor-wait'
          : `hover:scale-105 bg-gradient-to-br from-[#4353FF] to-[#2F80ED] shadow-lg shadow-blue-500/30
             dark:bg-white/10 dark:backdrop-blur-md dark:border dark:border-white/20 dark:from-transparent dark:to-transparent
             ${desktop ? 'lg:bg-[#15171c] lg:border-blue-400/45 lg:shadow-[0_0_70px_rgba(48,91,255,.22)] lg:hover:border-blue-400/70' : ''}`
        } ${!hasApiKey ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        {isConnecting ? (
          <div className="w-12 h-12 border-4 border-theme border-t-indigo-600 dark:border-t-white rounded-full animate-spin" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${desktop ? 'h-16 w-16' : 'h-14 w-14'} text-white drop-shadow-md`}>
            <path d="M12 3L14.2 9.8L21 12L14.2 14.2L12 21L9.8 14.2L3 12L9.8 9.8L12 3Z" />
          </svg>
        )}
      </button>
    </div>
  );
};

const HomeScreenComponent: React.FC<HomeScreenProps> = ({ onStartCall, onSettings, hasApiKey = true, onConfigureApiKey, isConnecting = false }) => {
  const { t } = useI18n();

  const warning = !hasApiKey && (
    <div onClick={onConfigureApiKey} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && onConfigureApiKey?.()} className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
      <p className="text-amber-700 dark:text-amber-300 text-sm font-medium text-center">{t('home.apiKeyWarning')}</p>
    </div>
  );

  return (
    <>
      {/* Original mobile Home. Kept isolated so desktop work cannot change it. */}
      <div className="flex lg:hidden flex-col h-full bg-theme-secondary text-theme-primary relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-indigo-500/10 to-transparent rounded-[100%] blur-3xl pointer-events-none" />
        <div className="flex justify-between items-center px-8 pt-6 pb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg"><IconSparkles className="w-6 h-6" /></div>
            <span className="font-bold text-xl tracking-tight text-theme-primary">LIVEGO</span>
          </div>
          <button onClick={onSettings} disabled={isConnecting} className="p-3 rounded-full hover:bg-theme-hover active:bg-theme-active transition-all text-theme-secondary" aria-label="Settings"><IconSettings className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center z-10 pb-20">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-3xl font-bold text-theme-primary">{t('home.greetingTitle')}</h2>
            <p className="text-theme-secondary text-lg">{t('home.greetingSubtitle')}</p>
          </div>
          {warning}
          <SpeakButton onStartCall={onStartCall} hasApiKey={hasApiKey} isConnecting={isConnecting} />
          <p className="mt-10 text-sm font-medium text-theme-muted uppercase tracking-widest animate-pulse">{isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}</p>
        </div>
      </div>

      {/* Desktop-only Home. */}
      <div className="relative hidden h-full flex-col overflow-hidden bg-theme-secondary text-theme-primary lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(30,64,175,.16),transparent_42%)]" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 pb-4">
          <div className="mb-14 space-y-2 text-center">
            <h2 className="text-[38px] font-bold leading-tight tracking-[-0.025em] text-theme-primary">{t('home.greetingTitle')}</h2>
            <p className="mt-3 text-[18px] text-theme-secondary">{t('home.greetingSubtitle')}</p>
          </div>
          {warning}
          <SpeakButton onStartCall={onStartCall} hasApiKey={hasApiKey} isConnecting={isConnecting} desktop />
          <p className="mt-10 animate-pulse text-sm font-medium uppercase tracking-widest text-theme-muted">{isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}</p>
        </div>
      </div>
    </>
  );
};

export const HomeScreen = memo(HomeScreenComponent);
