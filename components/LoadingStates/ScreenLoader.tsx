import React from 'react';
import { useI18n } from '../../i18n';

export const ScreenLoader: React.FC = () => {
  const { locale } = useI18n();

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-theme-secondary"
      role="status"
      aria-live="polite"
    >
      <div className="absolute h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
        <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-200/20 border-t-indigo-500" />
      </div>
      <p className="relative mt-5 text-sm font-medium text-theme-secondary">
        {locale === 'pt-BR' ? 'Carregando...' : 'Loading...'}
      </p>
    </div>
  );
};

export default ScreenLoader;
