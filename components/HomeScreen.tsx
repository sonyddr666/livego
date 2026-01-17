import React from 'react';
import { IconSettings, IconSparkles } from './Icons';
import { useI18n } from '../i18n';

interface HomeScreenProps {
  onStartCall: () => void;
  onSettings: () => void;
  hasApiKey?: boolean;
  onConfigureApiKey?: () => void;
  isConnecting?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  onStartCall, 
  onSettings, 
  hasApiKey = true, 
  onConfigureApiKey,
  isConnecting = false
}) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-col h-full bg-white text-gray-900 relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-blue-50/80 to-transparent rounded-[100%] blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-6 pb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <IconSparkles className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">LIVEGO</span>
        </div>
        <button
          onClick={onSettings}
          disabled={isConnecting}
          className="p-3 rounded-full hover:bg-gray-100 active:scale-95 transition-all text-gray-500"
        >
          <IconSettings className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 pb-20">

        <div className="text-center mb-12 space-y-2">
          <h2 className="text-3xl font-bold text-slate-800">{t('home.greetingTitle')}</h2>
          <p className="text-slate-500 text-lg">{t('home.greetingSubtitle')}</p>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div
            onClick={onConfigureApiKey}
            className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <p className="text-amber-700 text-sm font-medium text-center">
              {t('home.apiKeyWarning')}
            </p>
          </div>
        )}

        {/* Hero Button */}
        <div className="relative group">
          {/* Pulse Ring */}
          {!isConnecting && (
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 animate-pulse-ring" />
          )}

          <button
            onClick={onStartCall}
            disabled={isConnecting || !hasApiKey}
            className={`relative w-40 h-40 rounded-full flex items-center justify-center shadow-[0_20px_50px_rgba(37,99,235,0.4)] transition-all duration-300 transform 
                ${isConnecting ? 'bg-white border-4 border-indigo-200 cursor-wait' : 'bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 hover:scale-105 active:scale-95 border-4 border-white/10'} 
                ${!hasApiKey ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isConnecting ? (
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : (
                <IconSparkles className="w-16 h-16 text-white" />
            )}
          </button>
        </div>

        <p className="mt-10 text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">
          {isConnecting ? t('home.connecting') : hasApiKey ? t('home.tapToSpeak') : t('home.configureApiKey')}
        </p>
      </div>

    </div>
  );
};
