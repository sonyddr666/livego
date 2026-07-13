import React from 'react';
import { APP_VERSION } from '../config/version';
import { ScreenName } from '../types';
import {
  IconBell,
  IconClock,
  IconGlobe,
  IconHelp,
  IconInfo,
  IconLock,
  IconUser,
} from './Icons';
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

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
  </svg>
);

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ currentScreen, connected, onNavigate }) => {
  const { locale } = useI18n();
  const isPortuguese = locale === 'pt-BR';

  const primaryNavigation = [
    { label: isPortuguese ? 'Início' : 'Home', icon: HomeIcon, screen: connected ? ScreenName.USAGE : ScreenName.HOME, color: 'text-blue-400' },
    { label: isPortuguese ? 'Conta' : 'Account', icon: IconUser, screen: ScreenName.ACCOUNT, color: 'text-blue-400' },
    { label: isPortuguese ? 'Histórico' : 'History', icon: IconClock, screen: ScreenName.HISTORY, color: 'text-emerald-400' },
    { label: isPortuguese ? 'Idioma' : 'Language', description: isPortuguese ? 'Português (Brasil)' : 'English', icon: IconGlobe, screen: ScreenName.LANGUAGE, color: 'text-green-400' },
    { label: isPortuguese ? 'Notificações' : 'Notifications', icon: IconBell, screen: ScreenName.NOTIFICATIONS, color: 'text-purple-400' },
  ];
  const supportNavigation = [
    { label: isPortuguese ? 'Privacidade' : 'Privacy', icon: IconLock, screen: ScreenName.PRIVACY, color: 'text-green-400' },
    { label: isPortuguese ? 'Ajuda e suporte' : 'Help & support', icon: IconHelp, screen: ScreenName.HELP, color: 'text-orange-400' },
    { label: isPortuguese ? 'Sobre' : 'About', icon: IconInfo, screen: ScreenName.ABOUT, color: 'text-zinc-400' },
  ];

  const renderItem = (item: typeof primaryNavigation[number]) => {
    const isHomeTarget = item.screen === ScreenName.HOME || item.screen === ScreenName.USAGE;
    const active = isHomeTarget
      ? currentScreen === ScreenName.HOME || currentScreen === ScreenName.USAGE
      : currentScreen === item.screen;
    const disabled = connected && !isHomeTarget;
    const Icon = item.icon;

    return (
      <button
        key={item.label}
        type="button"
        onClick={() => onNavigate(item.screen)}
        disabled={disabled}
        aria-current={active ? 'page' : undefined}
        className={`group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition ${active
          ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/10 text-white ring-1 ring-inset ring-blue-400/15 shadow-[inset_3px_0_0_#377dff]'
          : 'text-zinc-400 hover:bg-white/[0.045] hover:text-white'
        } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-400' : item.color}`} />
        <span className="min-w-0">
          <span className="block text-[14px] font-medium">{item.label}</span>
          {'description' in item && item.description && <span className="mt-0.5 block text-[11px] text-zinc-600">{item.description}</span>}
        </span>
      </button>
    );
  };

  return (
    <aside className="hidden h-full w-[270px] shrink-0 flex-col border-r border-white/[0.09] bg-[#0b0c10] px-4 py-5 text-white lg:flex">
      <nav className="space-y-1" aria-label={isPortuguese ? 'Navegação do aplicativo' : 'Application navigation'}>
        {primaryNavigation.map(renderItem)}
      </nav>

      <div className="my-4 h-px bg-white/[0.08]" />

      <nav className="space-y-1" aria-label={isPortuguese ? 'Ajuda e informações' : 'Help and information'}>
        {supportNavigation.map(renderItem)}
      </nav>

      <div className="mt-auto space-y-5 px-2">
        <div className="h-px bg-white/[0.08]" />
        <button type="button" disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 py-3 text-sm font-semibold text-red-400 opacity-70">
          <LogoutIcon className="h-5 w-5" />
          {isPortuguese ? 'Sair' : 'Sign out'}
        </button>
        <p className="pb-1 text-center text-[11px] font-medium tracking-[0.08em] text-zinc-600">{isPortuguese ? 'VERSÃO' : 'VERSION'} {APP_VERSION}</p>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
