import React from 'react';
import { ScreenName } from '../types';
import { IconChevronLeft, IconChevronRight, IconUser, IconBell, IconLock, IconHelp, IconInfo, IconMic, IconSparkles, IconClock, IconGlobe, IconCheck, IconEye, IconEyeOff, IconTrash, IconPlus } from './Icons';
import { AVAILABLE_VOICES } from '../config/voices';
import type { VoiceConfig } from '../config/voices';
import { useI18n } from '../i18n';
import type { Locale, TranslationKey } from '../i18n';
import { useThemeStore } from '../store/themeStore';
import { useInstructionPresets, type InstructionPreset } from '../store/instructionPresetsStore';

// Instructions Screen with Presets Component
const InstructionsScreenWithPresets: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const { presets, selectedPresetId, customInstruction, addPreset, updatePreset, deletePreset, selectPreset, setCustomInstruction } = useInstructionPresets();
    const [editingPreset, setEditingPreset] = React.useState<InstructionPreset | null>(null);
    const [isCreating, setIsCreating] = React.useState(false);
    const [newName, setNewName] = React.useState('');
    const [newInstruction, setNewInstruction] = React.useState('');

    const handleSaveNew = () => {
        if (newName.trim() && newInstruction.trim()) {
            addPreset(newName.trim(), newInstruction.trim());
            setNewName('');
            setNewInstruction('');
            setIsCreating(false);
        }
    };

    const handleUpdatePreset = () => {
        if (editingPreset && newName.trim() && newInstruction.trim()) {
            updatePreset(editingPreset.id, newName.trim(), newInstruction.trim());
            setEditingPreset(null);
            setNewName('');
            setNewInstruction('');
        }
    };

    const startEditing = (preset: InstructionPreset) => {
        setEditingPreset(preset);
        setNewName(preset.name);
        setNewInstruction(preset.instruction);
        setIsCreating(false);
    };

    const cancelEdit = () => {
        setEditingPreset(null);
        setIsCreating(false);
        setNewName('');
        setNewInstruction('');
    };

    // If editing or creating, show the form
    if (isCreating || editingPreset) {
        return (
            <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
                <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
                    <button type="button" onClick={cancelEdit} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
                        <IconChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">
                        {editingPreset ? 'Editar Preset' : 'Novo Preset'}
                    </h1>
                </div>
                <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-theme-secondary mb-2">Nome do Preset</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Ex: Modo Casual"
                            className="w-full px-4 py-3 bg-theme-secondary border border-theme rounded-xl text-theme-primary placeholder:text-theme-muted focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-theme-secondary mb-2">Instrução do Sistema</label>
                        <textarea
                            value={newInstruction}
                            onChange={(e) => setNewInstruction(e.target.value)}
                            placeholder="Descreva como o assistente deve se comportar..."
                            className="w-full px-4 py-3 bg-theme-secondary border border-theme rounded-xl text-theme-primary placeholder:text-theme-muted focus:border-blue-500 outline-none resize-none"
                            style={{ minHeight: '200px' }}
                        />
                    </div>
                    <button
                        onClick={editingPreset ? handleUpdatePreset : handleSaveNew}
                        disabled={!newName.trim() || !newInstruction.trim()}
                        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                        {editingPreset ? 'Salvar Alterações' : 'Criar Preset'}
                    </button>
                </div>
            </div>
        );
    }

    // Main presets list
    return (
        <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
            <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
                <button type="button" onClick={onBack} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">
                    {t('settings.instructions.title')}
                </h1>
            </div>

            <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
                {/* Create New Button */}
                <button
                    onClick={() => setIsCreating(true)}
                    className="w-full mb-6 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <IconPlus className="w-5 h-5" />
                    Criar Novo Preset
                </button>

                {/* Presets List */}
                <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme">
                    {presets.map((preset, i) => (
                        <div
                            key={preset.id}
                            className={`p-4 ${i !== presets.length - 1 ? 'border-b border-theme' : ''}`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Selection Radio */}
                                <button
                                    onClick={() => selectPreset(preset.id)}
                                    className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedPresetId === preset.id
                                            ? 'border-blue-500 bg-blue-500'
                                            : 'border-theme-secondary'
                                        }`}
                                >
                                    {selectedPresetId === preset.id && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-theme-primary">{preset.name}</h3>
                                        {preset.isDefault && (
                                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">Padrão</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-theme-secondary line-clamp-2">{preset.instruction}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {!preset.isDefault && (
                                        <>
                                            <button
                                                onClick={() => startEditing(preset)}
                                                className="p-2 text-theme-secondary hover:text-blue-500 transition-colors"
                                                title="Editar"
                                            >
                                                <IconSparkles className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deletePreset(preset.id)}
                                                className="p-2 text-theme-secondary hover:text-red-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-4 text-xs text-theme-muted px-2 text-center">
                    Selecione um preset ou crie seu próprio. Presets padrão não podem ser editados.
                </p>
            </div>
        </div>
    );
};
const APP_VERSION = '1.0.14';
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
            {title && <h3 id={titleId} className="text-xs font-semibold text-theme-muted uppercase tracking-wider ml-4 mb-2">{title}</h3>}
            <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme">
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
        className={`w-full flex items-center p-4 text-left hover:bg-theme-hover active:bg-theme-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-theme' : ''}`}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-white ${color}`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
        </div>
        <div className="flex-1 flex justify-between items-center mr-2">
            <span className="text-[15px] font-medium text-theme-primary">{label}</span>
            {value && <span className="text-[14px] text-theme-secondary">{value}</span>}
        </div>
        <IconChevronRight className="text-theme-muted w-5 h-5 shrink-0" />
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
        className={`w-full flex items-center justify-between p-4 text-left hover:bg-theme-hover active:bg-theme-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-theme' : ''}`}
    >
        <div className="flex flex-col">
            <span className="text-theme-primary font-medium">{label}</span>
            {description && <span className="text-xs text-theme-secondary">{description}</span>}
        </div>
        <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-green-500' : 'bg-theme-tertiary'}`} aria-hidden="true">
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
        <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
            <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
                <button type="button" onClick={onBack} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">
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
    <div className="flex flex-col h-full bg-theme-primary transition-colors duration-300">
        {children}
    </div>
);

const DetailHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
    <div className="flex items-center px-6 pt-6 pb-4 bg-theme-secondary border-b border-theme sticky top-0 z-20">
        <button type="button" onClick={onBack} className="p-2 -ml-2 text-theme-primary rounded-full hover:bg-theme-hover transition-colors">
            <IconChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-theme-primary mr-8">{title}</h1>
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
            className={`w-full flex items-center justify-between p-4 text-left hover:bg-theme-hover active:bg-theme-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-theme' : ''}`}
        >
            <div className="flex flex-col">
                <span className="text-[15px] font-medium text-theme-primary">{voice.name}</span>
                {description && <span className="text-xs text-theme-secondary">{description}</span>}
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
        className={`w-full flex items-center justify-between p-4 text-left hover:bg-theme-hover active:bg-theme-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${!isLast ? 'border-b border-theme' : ''}`}
    >
        <span className="text-[15px] font-medium text-theme-primary">{label}</span>
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
                    <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme" role="radiogroup" aria-label={t('settings.voice.title')}>
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
                    <p className="mt-4 text-xs text-theme-secondary px-2">
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
                    <div className="bg-theme-secondary rounded-xl overflow-hidden shadow-sm border border-theme" role="radiogroup" aria-label={t('settings.language.title')}>
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
                    <p className="mt-4 text-xs text-theme-secondary px-2">
                        {t('settings.language.description')}
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- INSTRUCTIONS SCREEN with Presets ---
    if (screen === ScreenName.INSTRUCTIONS) {
        return <InstructionsScreenWithPresets onBack={onBack} />;
    }

    // --- ACCOUNT SCREEN ---
    if (screen === ScreenName.ACCOUNT) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title={t('settings.account.title')} />
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-500 dark:text-blue-400 mb-4">
                            <IconUser className="w-10 h-10" />
                        </div>
                        <h2 className="text-lg font-bold text-theme-primary">{t('settings.account.demoUser')}</h2>
                        <p className="text-theme-secondary text-sm">user_839210@livego.dev</p>
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
                                    className="flex-1 px-3 py-2 border border-theme rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-theme-tertiary text-theme-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    aria-label={showApiKey ? t('common.hideApiKey') : t('common.showApiKey')}
                                    className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-lg transition-colors"
                                >
                                    {showApiKey ? <IconEyeOff className="w-5 h-5" /> : <IconEye className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-theme-secondary">
                                {t('settings.account.apiKeySaved')}
                            </p>
                        </div>
                    </SettingsGroup>

                    <SettingsGroup title={t('settings.account.profile')}>
                        <div className="p-4 border-b border-theme flex justify-between">
                            <span className="text-theme-secondary">{t('settings.account.plan')}</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{t('settings.account.planValue')}</span>
                        </div>
                        <div className="p-4 flex justify-between">
                            <span className="text-theme-secondary">{t('settings.account.memberSince')}</span>
                            <span className="font-medium text-theme-primary">{t('settings.account.memberSinceValue')}</span>
                        </div>
                    </SettingsGroup>

                    <button
                        type="button"
                        disabled
                        title={t('common.comingSoon')}
                        className="w-full py-3 text-red-500 dark:text-red-400 bg-theme-secondary rounded-xl shadow-sm border border-theme font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                        <div className="p-4 border-b border-theme"><span className="text-theme-primary font-medium">{t('settings.help.voice')}</span></div>
                        <div className="p-4 border-b border-theme"><span className="text-theme-primary font-medium">{t('settings.help.free')}</span></div>
                        <div className="p-4"><span className="text-theme-primary font-medium">{t('settings.help.contact')}</span></div>
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
                    <h2 className="text-xl font-bold text-theme-primary">LIVEGO</h2>
                    <p className="text-theme-muted mb-8">{t('app.versionBeta', { version: APP_VERSION })}</p>

                    <div className="w-full bg-theme-secondary rounded-xl shadow-sm border border-theme p-4">
                        <p className="text-sm text-theme-secondary text-center leading-relaxed">
                            {t('settings.about.powered')}
                            {' '}
                            {t('settings.about.tagline')}
                        </p>
                    </div>
                    <p className="mt-8 text-xs text-theme-muted">{t('settings.about.copyright')}</p>
                </div>
            </ContentWrapper>
        );
    }

    return null;
};
