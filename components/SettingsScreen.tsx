import React from 'react';
import { ScreenName } from '../types';
import { IconChevronLeft, IconChevronRight, IconUser, IconBell, IconLock, IconHelp, IconInfo, IconMic, IconSparkles, IconClock, IconGlobe, IconCheck, IconEye, IconEyeOff } from './Icons';
import { AVAILABLE_VOICES } from '../config/voices';
import type { VoiceConfig } from '../config/voices';
import { useI18n } from '../i18n';
import type { Locale, TranslationKey } from '../i18n';
import { useThemeStore } from '../store/themeStore';

const APP_VERSION = '1.0.13';
const LANGUAGE_OPTIONS: { id: Locale; labelKey: TranslationKey }[] = [
    { id: 'en', labelKey: 'language.name.en' },
    { id: 'pt-BR', labelKey: 'language.name.pt-BR' },
    { id: 'es-ES', labelKey: 'language.name.es-ES' },
    { id: 'fr-FR', labelKey: 'language.name.fr-FR' }
];

interface SettingsProps {
    onBack: () => void;
    onNavigate: (screen: ScreenName) => void;
    currentVoice: string;
}

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
}> = ({ icon, label, value, onClick, isLast, color = "bg-gray-100" }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-white ${color}`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
        </div>
        <div className="flex-1 flex justify-between items-center mr-2">
            <span className="text-[15px] font-medium text-gray-900">{label}</span>
            {value && <span className="text-[14px] text-gray-400">{value}</span>}
        </div>
        <IconChevronRight className="text-gray-300 w-5 h-5 shrink-0" />
    </button>
);

const ToggleRow: React.FC<{
    label: string;
    checked: boolean;
    onChange: (nextValue: boolean) => void;
    isLast?: boolean;
    description?: string;
}> = ({ label, checked, onChange, isLast, description }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
        <div className="flex flex-col">
            <span className="text-gray-900 font-medium">{label}</span>
            {description && <span className="text-xs text-gray-400">{description}</span>}
        </div>
        <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-green-500' : 'bg-gray-200'}`} aria-hidden="true">
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </span>
    </button>
);

// --- MAIN SETTINGS LIST ---

export const SettingsScreen: React.FC<SettingsProps> = ({ onBack, onNavigate, currentVoice }) => {
    const { t, locale } = useI18n();
    const currentLanguageLabel = t(`language.name.${locale}` as TranslationKey);
    const { theme, setTheme } = useThemeStore();
    const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <div className="flex flex-col h-full bg-[#f3f4f6]">
            <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
                <button type="button" onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-[17px] font-semibold text-gray-900 mr-8">
                    {t('settings.title')}
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6">

                <SettingsGroup title={t('settings.section.intelligence')}>
                    <SettingsItem
                        icon={<IconMic />}
                        label={t('settings.item.voice')}
                        value={currentVoice}
                        color="bg-indigo-500"
                        onClick={() => onNavigate(ScreenName.VOICE)}
                    />
                    <SettingsItem
                        icon={<IconSparkles />}
                        label={t('settings.item.systemInstructions')}
                        color="bg-pink-500"
                        onClick={() => onNavigate(ScreenName.INSTRUCTIONS)}
                        isLast
                    />
                </SettingsGroup>

                <SettingsGroup title={t('settings.section.general')}>
                    <SettingsItem
                        icon={<IconUser />}
                        label={t('settings.item.account')}
                        color="bg-blue-500"
                        onClick={() => onNavigate(ScreenName.ACCOUNT)}
                    />
                    <SettingsItem
                        icon={<IconClock />}
                        label={t('settings.item.history')}
                        color="bg-teal-500"
                        onClick={() => onNavigate(ScreenName.HISTORY)}
                    />
                    <SettingsItem
                        icon={<IconGlobe />}
                        label={t('settings.item.language')}
                        value={currentLanguageLabel}
                        color="bg-emerald-500"
                        onClick={() => onNavigate(ScreenName.LANGUAGE)}
                    />
                    <ToggleRow
                        label="Dark Mode"
                        description={isDarkMode ? 'Tema escuro ativado' : 'Tema claro ativado'}
                        checked={isDarkMode}
                        onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    />
                    <SettingsItem
                        icon={<IconBell />}
                        label={t('settings.item.notifications')}
                        color="bg-purple-500"
                        onClick={() => onNavigate(ScreenName.NOTIFICATIONS)}
                        isLast
                    />
                </SettingsGroup>

                <SettingsGroup title={t('settings.section.legal')}>
                    <SettingsItem
                        icon={<IconLock />}
                        label={t('settings.item.privacy')}
                        color="bg-green-500"
                        onClick={() => onNavigate(ScreenName.PRIVACY)}
                    />
                    <SettingsItem
                        icon={<IconHelp />}
                        label={t('settings.item.help')}
                        color="bg-orange-500"
                        onClick={() => onNavigate(ScreenName.HELP)}
                    />
                    <SettingsItem
                        icon={<IconInfo />}
                        label={t('settings.item.about')}
                        color="bg-gray-500"
                        onClick={() => onNavigate(ScreenName.ABOUT)}
                        isLast
                    />
                </SettingsGroup>

                <div className="mt-8 text-center pb-8">
                    <button
                        type="button"
                        disabled
                        title={t('common.comingSoon')}
                        className="text-red-500 text-sm font-semibold py-3 px-8 rounded-xl bg-white shadow-sm border border-gray-100 active:bg-red-50 w-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {t('settings.action.logout')}
                    </button>
                    <p className="mt-6 text-xs text-gray-400 font-medium tracking-wide">
                        {t('app.versionLabel', { version: APP_VERSION })}
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- SUB SCREENS ---

interface SettingsDetailProps {
    screen: ScreenName;
    onBack: () => void;
    // Props for config
    voiceName: string;
    setVoiceName: (v: string) => void;
    systemInstruction: string;
    setSystemInstruction: (i: string) => void;
    // API Key props
    apiKey: string;
    setApiKey: (key: string) => void;
}

// Voices are sourced from config/voices.ts

// Helper components defined OUTSIDE to prevent re-creation on each render
const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-col h-full bg-[#f3f4f6]">
        {children}
    </div>
);

const DetailHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
    <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
        <button type="button" onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
            <IconChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-gray-900 mr-8">{title}</h1>
    </div>
);

const VoiceOption: React.FC<{
    voice: VoiceConfig;
    isSelected: boolean;
    onSelect: () => void;
    isLast?: boolean;
}> = ({ voice, isSelected, onSelect, isLast }) => {
    const { t } = useI18n();
    const descriptionKey = `voice.description.${voice.id}` as TranslationKey;
    const localizedDescription = t(descriptionKey);
    const description = localizedDescription === descriptionKey ? voice.description : localizedDescription;

    return (
        <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={onSelect}
            className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-gray-100' : ''}`}
        >
            <div className="flex flex-col">
                <span className="text-[15px] font-medium text-gray-900">{voice.name}</span>
                {description && <span className="text-xs text-gray-400">{description}</span>}
            </div>
            {isSelected && <IconCheck className="w-5 h-5 text-blue-500" />}
        </button>
    );
};

const LanguageOption: React.FC<{
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

export const SettingsDetailScreen: React.FC<SettingsDetailProps> = ({
    screen, onBack, voiceName, setVoiceName, systemInstruction, setSystemInstruction, apiKey, setApiKey
}) => {
    const { t, locale, setLocale } = useI18n();
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [pushNotifications, setPushNotifications] = React.useState(true);
    const [emailDigest, setEmailDigest] = React.useState(false);
    const [shareUsageStats, setShareUsageStats] = React.useState(true);
    const [allowPersonalization, setAllowPersonalization] = React.useState(true);

    // --- VOICE SCREEN ---
    if (screen === ScreenName.VOICE) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.voice.title')} />
                <div className="p-6">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100" role="radiogroup" aria-label={t('settings.voice.title')}>
                        {AVAILABLE_VOICES.map((voice, i) => (
                            <VoiceOption
                                key={voice.id}
                                voice={voice}
                                isSelected={voiceName === voice.id}
                                onSelect={() => setVoiceName(voice.id)}
                                isLast={i === AVAILABLE_VOICES.length - 1}
                            />
                        ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500 px-2">
                        {t('settings.voice.description')}
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- LANGUAGE SCREEN ---
    if (screen === ScreenName.LANGUAGE) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.language.title')} />
                <div className="p-6">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100" role="radiogroup" aria-label={t('settings.language.title')}>
                        {LANGUAGE_OPTIONS.map((option, i) => (
                            <LanguageOption
                                key={option.id}
                                label={t(option.labelKey)}
                                isSelected={locale === option.id}
                                onSelect={() => setLocale(option.id)}
                                isLast={i === LANGUAGE_OPTIONS.length - 1}
                            />
                        ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500 px-2">
                        {t('settings.language.description')}
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- INSTRUCTIONS SCREEN ---
    if (screen === ScreenName.INSTRUCTIONS) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.instructions.title')} />
                <div className="p-6 flex-1 flex flex-col box-border">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1 flex flex-col overflow-hidden">
                        <textarea
                            value={systemInstruction}
                            onChange={(e) => setSystemInstruction(e.target.value)}
                            className="flex-1 w-full h-full resize-none outline-none text-[16px] leading-relaxed text-gray-900 placeholder-gray-400 bg-white font-normal p-1"
                            placeholder={t('settings.instructions.placeholder')}
                            style={{ minHeight: '300px' }}
                        />
                    </div>
                    <p className="mt-4 text-xs text-gray-500 px-2">
                        {t('settings.instructions.description')}
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- ACCOUNT SCREEN ---
    if (screen === ScreenName.ACCOUNT) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.account.title')} />
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-4">
                            <IconUser className="w-10 h-10" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">{t('settings.account.demoUser')}</h2>
                        <p className="text-gray-500 text-sm">user_839210@livego.dev</p>
                    </div>

                    {/* API Key Management Section */}
                    <SettingsGroup title={t('settings.account.apiKeyManagement')}>
                        <div className="p-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={t('settings.account.apiKeyPlaceholder')}
                                    aria-label={t('settings.account.apiKeyLabel')}
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    aria-label={showApiKey ? t('common.hideApiKey') : t('common.showApiKey')}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {showApiKey ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                {t('settings.account.apiKeySaved')}
                            </p>
                        </div>
                    </SettingsGroup>

                    <SettingsGroup title={t('settings.account.profile')}>
                        <div className="p-4 border-b border-gray-100 flex justify-between">
                            <span className="text-gray-600">{t('settings.account.plan')}</span>
                            <span className="font-medium text-blue-600">{t('settings.account.planValue')}</span>
                        </div>
                        <div className="p-4 flex justify-between">
                            <span className="text-gray-600">{t('settings.account.memberSince')}</span>
                            <span className="font-medium text-gray-900">{t('settings.account.memberSinceValue')}</span>
                        </div>
                    </SettingsGroup>

                    <button
                        type="button"
                        disabled
                        title={t('common.comingSoon')}
                        className="w-full py-3 text-red-500 bg-white rounded-xl shadow-sm border border-gray-100 font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {t('settings.account.delete')}
                    </button>
                </div>
            </ContentWrapper>
        );
    }

    // --- NOTIFICATIONS SCREEN ---
    if (screen === ScreenName.NOTIFICATIONS) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.notifications.title')} />
                <div className="p-6">
                    <SettingsGroup title={t('settings.notifications.alerts')}>
                        <ToggleRow
                            label={t('settings.notifications.push')}
                            checked={pushNotifications}
                            onChange={setPushNotifications}
                        />
                        <ToggleRow
                            label={t('settings.notifications.email')}
                            checked={emailDigest}
                            onChange={setEmailDigest}
                            isLast
                        />
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    // --- PRIVACY SCREEN ---
    if (screen === ScreenName.PRIVACY) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.privacy.title')} />
                <div className="p-6">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                        <p className="text-sm text-blue-800 leading-relaxed">
                            {t('settings.privacy.notice')}
                        </p>
                    </div>

                    <SettingsGroup>
                        <ToggleRow
                            label={t('settings.privacy.shareUsage')}
                            checked={shareUsageStats}
                            onChange={setShareUsageStats}
                        />
                        <ToggleRow
                            label={t('settings.privacy.allowPersonalization')}
                            checked={allowPersonalization}
                            onChange={setAllowPersonalization}
                            isLast
                        />
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    // --- HELP & ABOUT SCREENS ---
    if (screen === ScreenName.HELP) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.help.title')} />
                <div className="p-6">
                    <SettingsGroup title={t('settings.help.faq')}>
                        <div className="p-4 border-b border-gray-100"><span className="text-gray-900 font-medium">{t('settings.help.voice')}</span></div>
                        <div className="p-4 border-b border-gray-100"><span className="text-gray-900 font-medium">{t('settings.help.free')}</span></div>
                        <div className="p-4"><span className="text-gray-900 font-medium">{t('settings.help.contact')}</span></div>
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    if (screen === ScreenName.ABOUT) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.about.title')} />
                <div className="p-6 flex flex-col items-center pt-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg mb-6">
                        <IconSparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">LIVEGO</h2>
                    <p className="text-gray-400 mb-8">{t('app.versionBeta', { version: APP_VERSION })}</p>

                    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <p className="text-sm text-gray-600 text-center leading-relaxed">
                            {t('settings.about.powered')}
                            {' '}
                            {t('settings.about.tagline')}
                        </p>
                    </div>
                    <p className="mt-8 text-xs text-gray-300">{t('settings.about.copyright')}</p>
                </div>
            </ContentWrapper>
        );
    }

    return null;
};
