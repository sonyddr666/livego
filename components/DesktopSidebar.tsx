import React from 'react';
import { APP_VERSION } from '../config/version';
import { ScreenName } from '../types';
import { IconClock, IconSettings, IconSparkles } from './Icons';
import { useI18n } from '../i18n';

interface DesktopSidebarProps {
  currentScreen: ScreenName;
  connected: boolean;
  onNavigate: (screen: ScreenName) => void;
}

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v10h14V10" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentScreen, connected, onNavigate }) => {
  const { locale } = useI18n();
  const isPortuguese = locale === 'pt-BR';
  const isHome = currentScreen === ScreenName.HOME || currentScreen === ScreenName.USAGE;
  const isHistory = currentScreen === ScreenName.HISTORY;
  const isSettings = !isHome && !isHistory;

  const navigation = [
    {
      label: isPortuguese ? 'Início' : 'Home',
      icon: HomeIcon,
      active: isHome,
      disabled: false,
      screen: connected ? ScreenName.USAGE : ScreenName.HOME,
    },
    {
      label: isPortuguese ? 'Histórico' : 'History',
      icon: IconClock,
      active: isHistory,
      disabled: connected,
      screen: ScreenName.HISTORY,
    },
    {
      label: isPortuguese ? 'Configurações' : 'Settings',
      icon: IconSettings,
      active: isSettings,
      disabled: connected,
      screen: ScreenName.SETTINGS,
    },
  ];

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-white/[0.07] bg-[#090a0f] px-4 py-5 text-white lg:flex">
      <a href="/" className="flex items-center gap-3 px-3 py-2" aria-label="LiveGo landing page">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-500/20">
          <IconSparkles className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-bold tracking-tight">LIVEGO</span>
          <span className="block text-[10px] font-medium tracking-[0.16em] text-zinc-600">VOICE AI</span>
        </span>
      </a>

      <nav className="mt-8 space-y-1" aria-label={isPortuguese ? 'Navegação do aplicativo' : 'Application navigation'}>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.screen)}
              disabled={item.disabled}
              aria-current={item.active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${item.active
                ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/15'
                : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200'
                } ${item.disabled ? 'cursor-not-allowed opacity-35' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-red-500' : 'bg-emerald-400'}`} />
            <span className="text-xs font-semibold text-zinc-300">
              {connected
                ? (isPortuguese ? 'Conversa em andamento' : 'Conversation in progress')
                : (isPortuguese ? 'Pronto para conversar' : 'Ready to talk')}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">
            {connected
              ? (isPortuguese ? 'Finalize a sessão para abrir outras áreas.' : 'End the session to open other areas.')
              : (isPortuguese ? 'Microfone e contexto sob seu controle.' : 'Microphone and context under your control.')}
          </p>
        </div>
        <div className="flex items-center justify-between px-3 text-[10px] text-zinc-700">
          <span>LiveGo Desktop</span>
          <span>v{APP_VERSION}</span>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
