import React, { useState, useRef, useEffect } from 'react';
import { ScreenName, HistoryItem } from './types';
import { HomeScreen } from './components/HomeScreen';
import { UsageScreen } from './components/UsageScreen';
import { SettingsScreen, SettingsDetailScreen } from './components/SettingsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { useLiveAPI } from './hooks/useLiveAPI';

const HISTORY_STORAGE_KEY = 'livego_history';
const API_KEY_STORAGE_KEY = 'gemini_api_key';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);

  // Settings State
  const [voiceName, setVoiceName] = useState<string>('Zephyr');
  const [systemInstruction, setSystemInstruction] = useState<string>('You are a friendly, helpful, and concise conversational partner. Keep your responses relatively short to facilitate a back-and-forth dialogue.');

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
    await connect({ voiceName, systemInstruction, apiKey });
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
        date: new Date().toLocaleString(),
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
    <div className="w-full h-[100dvh] md:flex md:justify-center md:items-center md:min-h-screen md:bg-[#f4f4f5] font-sans">
      {/* 
        Responsive Container:
        - Mobile: Full screen, no padding, no border
        - Desktop (md+): Wider, taller, and optimized for desktop layouts
      */}
      <div className="w-full h-[100dvh] md:max-w-[1120px] md:h-[760px] relative overflow-hidden md:rounded-[32px] md:shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] md:border md:border-white/40 md:bg-white">

        {/* Inner Screen Content */}
        <div className="w-full h-full bg-white overflow-hidden">
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
            ScreenName.INSTRUCTIONS
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
  );
};

export default App;
