import React from 'react';
import { ScreenName } from '../types';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useSkillsStore } from '../store/skillsStore';
import { useThemeStore } from '../store/themeStore';
import {
  IconChevronRight,
  IconClock,
  IconGlobe,
  IconMic,
  IconSparkles,
  IconUser,
} from './Icons';

interface DesktopSettingsPanelProps {
  currentVoice: string;
  onNavigate: (screen: ScreenName) => void;
}

const PanelItem: React.FC<{
  label: string;
  value?: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}> = ({ label, value, icon, color, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-white/[0.07] px-3 py-3 text-left last:border-b-0 hover:bg-white/[0.04]">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-lg ${color}`}>{icon}</span>
    <span className="flex-1 text-[13px] font-medium text-zinc-200">{label}</span>
    {value && <span className="max-w-[105px] truncate text-[11px] text-zinc-500">{value}</span>}
    <IconChevronRight className="h-4 w-4 text-zinc-600" />
  </button>
);

export const DesktopSettingsPanel: React.FC<DesktopSettingsPanelProps> = ({ currentVoice, onNavigate }) => {
  const { locale } = useI18n();
  const isPortuguese = locale === 'pt-BR';
  const { searchMode, setSearchMode, screenVisionFps, setScreenVisionFps } = useSettingsStore();
  const enabledSkills = useSkillsStore(state => state.skills.filter(skill => skill.enabled).length);
  const { resolvedTheme, setTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  return (
    <aside className="hidden h-full w-[410px] shrink-0 flex-col overflow-y-auto border-l border-white/[0.09] bg-[#0b0c10] px-5 py-5 text-white no-scrollbar xl:flex">
      <h2 className="text-[17px] font-semibold">{isPortuguese ? 'Configurações' : 'Settings'}</h2>
      <div className="mt-4 h-px bg-white/[0.09]" />

      <section className="mt-4">
        <h3 className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{isPortuguese ? 'Inteligência' : 'Intelligence'}</h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.025]">
          <PanelItem label={isPortuguese ? 'Voz' : 'Voice'} value={currentVoice} icon={<IconMic className="h-4 w-4" />} color="bg-gradient-to-br from-indigo-500 to-violet-500" onClick={() => onNavigate(ScreenName.VOICE)} />
          <PanelItem label={isPortuguese ? 'Instruções do sistema' : 'System instructions'} icon={<IconSparkles className="h-4 w-4" />} color="bg-gradient-to-br from-pink-500 to-rose-500" onClick={() => onNavigate(ScreenName.INSTRUCTIONS)} />
          <PanelItem label="Skills" value={`${enabledSkills} ${isPortuguese ? 'ativas' : 'active'}`} icon={<IconSparkles className="h-4 w-4" />} color="bg-gradient-to-br from-amber-400 to-orange-500" onClick={() => onNavigate(ScreenName.SKILLS)} />
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.025] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-zinc-200">{isPortuguese ? 'Modo de Busca' : 'Search mode'}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{searchMode === 'ghost' ? 'Ghost-Search ativo' : 'Google Search ativo'}</p>
          </div>
          <div className="flex overflow-hidden rounded-full border border-purple-500/40 text-[9px] font-bold uppercase tracking-wide">
            <button type="button" onClick={() => setSearchMode('google')} className={`px-3 py-2 ${searchMode === 'google' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Google</button>
            <button type="button" onClick={() => setSearchMode('ghost')} className={`px-3 py-2 ${searchMode === 'ghost' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-zinc-500'}`}>Ghost</button>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium text-zinc-200">{isPortuguese ? 'Taxa de Captura de Tela' : 'Screen capture rate'}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{isPortuguese ? 'Mais FPS = melhor para conteúdo dinâmico' : 'More FPS improves dynamic content'}</p>
          </div>
          <span className="text-xs font-semibold text-blue-400">{screenVisionFps} FPS</span>
        </div>
        <input type="range" min={0.5} max={5} step={0.5} value={screenVisionFps} onChange={event => setScreenVisionFps(Number(event.target.value))} className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-blue-500" />
        <div className="mt-1 flex justify-between text-[9px] text-zinc-600"><span>0.5</span><span>5</span></div>
      </section>

      <section className="mt-4">
        <h3 className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{isPortuguese ? 'Geral' : 'General'}</h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.025]">
          <PanelItem label={isPortuguese ? 'Conta' : 'Account'} icon={<IconUser className="h-4 w-4" />} color="bg-gradient-to-br from-blue-500 to-indigo-500" onClick={() => onNavigate(ScreenName.ACCOUNT)} />
          <PanelItem label={isPortuguese ? 'Histórico' : 'History'} icon={<IconClock className="h-4 w-4" />} color="bg-gradient-to-br from-emerald-400 to-teal-500" onClick={() => onNavigate(ScreenName.HISTORY)} />
          <PanelItem label={isPortuguese ? 'Idioma' : 'Language'} value={isPortuguese ? 'Português (Brasil)' : 'English'} icon={<IconGlobe className="h-4 w-4" />} color="bg-gradient-to-br from-green-400 to-emerald-500" onClick={() => onNavigate(ScreenName.LANGUAGE)} />
        </div>
      </section>

      <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-3 text-left">
        <span><span className="block text-[13px] font-medium text-zinc-200">Dark Mode</span><span className="mt-0.5 block text-[10px] text-zinc-600">{isDark ? (isPortuguese ? 'Tema escuro ativado' : 'Dark theme enabled') : (isPortuguese ? 'Tema claro ativado' : 'Light theme enabled')}</span></span>
        <span className={`relative h-6 w-11 rounded-full transition ${isDark ? 'bg-emerald-500' : 'bg-zinc-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${isDark ? 'translate-x-6' : 'translate-x-1'}`} /></span>
      </button>
    </aside>
  );
};

export default DesktopSettingsPanel;
