import React from 'react';
import { ScreenName } from '../types';
import { IconChevronLeft, IconChevronRight, IconUser, IconBell, IconLock, IconHelp, IconInfo, IconMic, IconSparkles, IconClock } from './Icons';

interface SettingsProps {
    onBack: () => void;
    onNavigate: (screen: ScreenName) => void;
    currentVoice: string;
}

const SettingsGroup: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
    <div className="mb-6">
        {title && <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-4 mb-2">{title}</h3>}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            {children}
        </div>
    </div>
);

const SettingsItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string;
    onClick: () => void;
    isLast?: boolean;
    color?: string;
}> = ({ icon, label, value, onClick, isLast, color = "bg-gray-100" }) => (
    <div
        onClick={onClick}
        className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-white ${color}`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
        </div>
        <div className="flex-1 flex justify-between items-center mr-2">
            <span className="text-[15px] font-medium text-gray-900">{label}</span>
            {value && <span className="text-[14px] text-gray-400">{value}</span>}
        </div>
        <IconChevronRight className="text-gray-300 w-5 h-5" />
    </div>
);

// --- MAIN SETTINGS LIST ---

export const SettingsScreen: React.FC<SettingsProps> = ({ onBack, onNavigate, currentVoice }) => {
    return (
        <div className="flex flex-col h-full bg-[#f3f4f6]">
            <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
                    <IconChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="flex-1 text-center text-[17px] font-semibold text-gray-900 mr-8">
                    Settings
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6">

                <SettingsGroup title="Intelligence">
                    <SettingsItem
                        icon={<IconMic />}
                        label="Voice"
                        value={currentVoice}
                        color="bg-indigo-500"
                        onClick={() => onNavigate(ScreenName.VOICE)}
                    />
                    <SettingsItem
                        icon={<IconSparkles />}
                        label="System Instructions"
                        color="bg-pink-500"
                        onClick={() => onNavigate(ScreenName.INSTRUCTIONS)}
                        isLast
                    />
                </SettingsGroup>

                <SettingsGroup title="General">
                    <SettingsItem
                        icon={<IconUser />}
                        label="Account"
                        color="bg-blue-500"
                        onClick={() => onNavigate(ScreenName.ACCOUNT)}
                    />
                    <SettingsItem
                        icon={<IconClock />}
                        label="History"
                        color="bg-teal-500"
                        onClick={() => onNavigate(ScreenName.HISTORY)}
                    />
                    <SettingsItem
                        icon={<IconBell />}
                        label="Notifications"
                        color="bg-purple-500"
                        onClick={() => onNavigate(ScreenName.NOTIFICATIONS)}
                        isLast
                    />
                </SettingsGroup>

                <SettingsGroup title="Legal & Support">
                    <SettingsItem
                        icon={<IconLock />}
                        label="Privacy"
                        color="bg-green-500"
                        onClick={() => onNavigate(ScreenName.PRIVACY)}
                    />
                    <SettingsItem
                        icon={<IconHelp />}
                        label="Help & Support"
                        color="bg-orange-500"
                        onClick={() => onNavigate(ScreenName.HELP)}
                    />
                    <SettingsItem
                        icon={<IconInfo />}
                        label="About"
                        color="bg-gray-500"
                        onClick={() => onNavigate(ScreenName.ABOUT)}
                        isLast
                    />
                </SettingsGroup>

                <div className="mt-8 text-center pb-8">
                    <button className="text-red-500 text-sm font-semibold py-3 px-8 rounded-xl bg-white shadow-sm border border-gray-100 active:bg-red-50 w-full transition-colors">
                        Log Out
                    </button>
                    <p className="mt-6 text-xs text-gray-400 font-medium tracking-wide">VERSION 1.0.0</p>
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

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'];

// Helper components defined OUTSIDE to prevent re-creation on each render
const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-col h-full bg-[#f3f4f6]">
        {children}
    </div>
);

const DetailHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
    <div className="flex items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 sticky top-0 z-20">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
            <IconChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-gray-900 mr-8">{title}</h1>
    </div>
);

export const SettingsDetailScreen: React.FC<SettingsDetailProps> = ({
    screen, onBack, voiceName, setVoiceName, systemInstruction, setSystemInstruction, apiKey, setApiKey
}) => {
    const [showApiKey, setShowApiKey] = React.useState(false);

    // --- VOICE SCREEN ---
    if (screen === ScreenName.VOICE) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="Voice" />
                <div className="p-6">
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
                        {VOICES.map((v, i) => (
                            <div
                                key={v}
                                onClick={() => setVoiceName(v)}
                                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 ${i !== VOICES.length - 1 ? 'border-b border-gray-100' : ''}`}
                            >
                                <span className="text-[15px] font-medium text-gray-900">{v}</span>
                                {voiceName === v && <div className="text-blue-500 font-bold">✓</div>}
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500 px-2">
                        Select a voice for Gemini to use during your conversations.
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- INSTRUCTIONS SCREEN ---
    if (screen === ScreenName.INSTRUCTIONS) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="System Instructions" />
                <div className="p-6 flex-1 flex flex-col box-border">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex-1 flex flex-col overflow-hidden">
                        <textarea
                            value={systemInstruction}
                            onChange={(e) => setSystemInstruction(e.target.value)}
                            className="flex-1 w-full h-full resize-none outline-none text-[16px] leading-relaxed text-gray-900 placeholder-gray-400 bg-white font-normal p-1"
                            placeholder="e.g. You are a helpful assistant..."
                            style={{ minHeight: '300px' }}
                        />
                    </div>
                    <p className="mt-4 text-xs text-gray-500 px-2">
                        Define the persona and context for the AI. This guides how Gemini behaves during the call.
                    </p>
                </div>
            </ContentWrapper>
        );
    }

    // --- ACCOUNT SCREEN ---
    if (screen === ScreenName.ACCOUNT) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="Account" />
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-4">
                            <IconUser className="w-10 h-10" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900">Demo User</h2>
                        <p className="text-gray-500 text-sm">user_839210@livego.dev</p>
                    </div>

                    {/* API Key Management Section */}
                    <SettingsGroup title="API Key Management">
                        <div className="p-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your Gemini API key"
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                                />
                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {showApiKey ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Your API key is saved locally on this device and is never sent to our servers.
                            </p>
                        </div>
                    </SettingsGroup>

                    <SettingsGroup title="Profile">
                        <div className="p-4 border-b border-gray-100 flex justify-between">
                            <span className="text-gray-600">Plan</span>
                            <span className="font-medium text-blue-600">Free Tier</span>
                        </div>
                        <div className="p-4 flex justify-between">
                            <span className="text-gray-600">Member Since</span>
                            <span className="font-medium text-gray-900">Oct 2024</span>
                        </div>
                    </SettingsGroup>

                    <button className="w-full py-3 text-red-500 bg-white rounded-xl shadow-sm border border-gray-100 font-medium text-sm">
                        Delete Account
                    </button>
                </div>
            </ContentWrapper>
        );
    }

    // --- NOTIFICATIONS SCREEN (FAKE DATA) ---
    if (screen === ScreenName.NOTIFICATIONS) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="Notifications" />
                <div className="p-6">
                    <SettingsGroup title="Alerts">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Push Notifications</span>
                            <div className="w-10 h-6 bg-green-500 rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Email Digest</span>
                            <div className="w-10 h-6 bg-gray-200 rounded-full relative"><div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    // --- PRIVACY SCREEN (FAKE DATA) ---
    if (screen === ScreenName.PRIVACY) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="Privacy" />
                <div className="p-6">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                        <p className="text-sm text-blue-800 leading-relaxed">
                            Your voice data is processed in real-time and is not stored permanently on our servers.
                        </p>
                    </div>

                    <SettingsGroup>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Share Usage Statistics</span>
                            <div className="w-10 h-6 bg-green-500 rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                            <span className="text-gray-900 font-medium">Allow Personalization</span>
                            <div className="w-10 h-6 bg-green-500 rounded-full relative"><div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    // --- HELP & ABOUT SCREENS (FAKE DATA) ---
    if (screen === ScreenName.HELP) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="Help & Support" />
                <div className="p-6">
                    <SettingsGroup title="FAQ">
                        <div className="p-4 border-b border-gray-100"><span className="text-gray-900 font-medium">How to change voice?</span></div>
                        <div className="p-4 border-b border-gray-100"><span className="text-gray-900 font-medium">Is it free?</span></div>
                        <div className="p-4"><span className="text-gray-900 font-medium">Contact Support</span></div>
                    </SettingsGroup>
                </div>
            </ContentWrapper>
        );
    }

    if (screen === ScreenName.ABOUT) {
        return (
            <ContentWrapper>
                <DetailHeader onBack={onBack} title="About" />
                <div className="p-6 flex flex-col items-center pt-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg mb-6">
                        <IconSparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">LIVEGO</h2>
                    <p className="text-gray-400 mb-8">Version 1.0.0 (Beta)</p>

                    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <p className="text-sm text-gray-600 text-center leading-relaxed">
                            Powered by Google Gemini 2.5 Live API.
                            Designed to provide seamless real-time conversational experiences.
                        </p>
                    </div>
                    <p className="mt-8 text-xs text-gray-300">© 2025 LiveGo Inc.</p>
                </div>
            </ContentWrapper>
        );
    }

    return null;
};