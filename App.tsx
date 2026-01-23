import React, { useState, useRef, useEffect } from 'react';
import { ScreenName, HistoryItem } from './types';
import { HomeScreen } from './components/HomeScreen';
import { UsageScreen } from './components/UsageScreen';
import { SettingsScreen, SettingsDetailScreen } from './components/SettingsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Onboarding, hasCompletedOnboarding } from './components/Onboarding';
import { useLiveAPI } from './hooks/useLiveAPI';
import { useI18n } from './i18n';

const HISTORY_STORAGE_KEY = 'livego_history';
const API_KEY_STORAGE_KEY = 'gemini_api_key';

const App: React.FC = () => {
  const { t, locale } = useI18n();
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());

  // Settings State
  const [voiceName, setVoiceName] = useState<string>('Zephyr');
  const [systemInstruction, setSystemInstruction] = useState<string>(() => t('systemInstruction.default'));

  // API Key State - Load from localStorage on mount
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    } catch (error) {
      console.error('Failed to load API key from localStorage:', error);
      return '';
    }
  });

  // Computed: Check if API key is available (user-configured or environment)
  const hasApiKey = Boolean(apiKey || process.env.API_KEY);

  // History State - Load from localStorage on mount
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
      return [];
    }
  });

  const startTimeRef = useRef<number>(0);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history to localStorage:', error);
    }
  }, [history]);

  // Save API key to localStorage whenever it changes
  const handleApiKeyChange = (newApiKey: string) => {
    setApiKey(newApiKey);
    try {
      if (newApiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEY, newApiKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save API key to localStorage:', error);
    }
  };

  const { connected, isConnecting, connect, disconnect, isMuted, toggleMute, isSpeakerOn, toggleSpeaker, volume, transcript, getAnalysers } = useLiveAPI();

  const handleNavigate = (screen: ScreenName) => {
    setCurrentScreen(screen);
  };

  const handleStartCall = async () => {
    // If no API key is configured, redirect to Account settings
    if (!hasApiKey) {
      setCurrentScreen(ScreenName.ACCOUNT);
      return;
    }
    startTimeRef.current = Date.now();
    await connect({ voiceName, systemInstruction, apiKey, enableAdvancedFeatures: true });
    // Navigation to USAGE happens after connection is established? 
    // Or optimistically?
    // Given we have `isConnecting`, let's wait or show loading on Home.
    // The useLiveAPI sets `connected` to true on open. We can watch that.
  };

  // Watch for connection state to transition screen
  useEffect(() => {
    if (connected && currentScreen === ScreenName.HOME) {
      setCurrentScreen(ScreenName.USAGE);
    }
  }, [connected, currentScreen]);

  const handleEndCall = () => {
    const endTime = Date.now();
    const durationMs = endTime - startTimeRef.current;
    const durationSec = Math.floor(durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (transcript.trim().length > 0) {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleString(locale),
        duration: durationStr,
        transcript: transcript
      };
      setHistory(prev => [newItem, ...prev]);
    }

    disconnect();
    setCurrentScreen(ScreenName.HOME);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <ErrorBoundary>
      <div className="w-full h-[100dvh] md:flex md:justify-center md:items-center md:min-h-screen md:bg-[#e5e5e5] font-sans">
        {/* 
          Responsive Container:
          - Mobile: Full screen, no padding, no border, no radius
          - Desktop (md+): Fixed width/height, rounded corners, black border (phone frame)
        */}
        <div className="w-full h-full md:max-w-[390px] md:h-[844px] relative overflow-hidden md:rounded-[40px] md:shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] md:border-[8px] md:border-black md:bg-black">

          {/* Inner Screen Content */}
          <div className="w-full h-full bg-white overflow-hidden md:rounded-[32px]">
            {/* Onboarding Overlay */}
            {showOnboarding && (
              <Onboarding onComplete={() => setShowOnboarding(false)} />
            )}

            {currentScreen === ScreenName.HOME && (
              <HomeScreen
                onStartCall={handleStartCall}
                onSettings={() => handleNavigate(ScreenName.SETTINGS)}
                hasApiKey={hasApiKey}
                onConfigureApiKey={() => handleNavigate(ScreenName.ACCOUNT)}
                isConnecting={isConnecting}
              />
            )}

            {currentScreen === ScreenName.USAGE && (
              <UsageScreen
                onEndCall={handleEndCall}
                onSettings={() => handleNavigate(ScreenName.SETTINGS)}
                isMuted={isMuted}
                toggleMute={toggleMute}
                isSpeakerOn={isSpeakerOn}
                toggleSpeaker={toggleSpeaker}
                volume={volume}
                caption={transcript}
                getAnalysers={getAnalysers}
              />
            )}

            {currentScreen === ScreenName.SETTINGS && (
              <SettingsScreen
                onBack={() => handleNavigate(connected ? ScreenName.USAGE : ScreenName.HOME)}
                onNavigate={handleNavigate}
                currentVoice={voiceName}
              />
            )}

            {currentScreen === ScreenName.HISTORY && (
              <HistoryScreen
                history={history}
                onBack={() => handleNavigate(ScreenName.SETTINGS)}
                onDelete={deleteHistoryItem}
              />
            )}

            {/* Render Sub-screens */}
            {[
              ScreenName.ACCOUNT,
              ScreenName.NOTIFICATIONS,
              ScreenName.PRIVACY,
              ScreenName.HELP,
              ScreenName.ABOUT,
              ScreenName.VOICE,
              ScreenName.INSTRUCTIONS,
              ScreenName.LANGUAGE
            ].includes(currentScreen) && (
                <SettingsDetailScreen
                  screen={currentScreen}
                  onBack={() => handleNavigate(ScreenName.SETTINGS)}
                  voiceName={voiceName}
                  setVoiceName={setVoiceName}
                  systemInstruction={systemInstruction}
                  setSystemInstruction={setSystemInstruction}
                  apiKey={apiKey}
                  setApiKey={handleApiKeyChange}
                />
              )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
