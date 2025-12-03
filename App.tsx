import React, { useState, useRef, useEffect } from 'react';
import { ScreenName, HistoryItem } from './types';
import { HomeScreen } from './components/HomeScreen';
import { UsageScreen } from './components/UsageScreen';
import { SettingsScreen, SettingsDetailScreen } from './components/SettingsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { useLiveAPI } from './hooks/useLiveAPI';
import { IconChevronLeft } from './components/Icons';

const HISTORY_STORAGE_KEY = 'livego_history';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>(ScreenName.HOME);
  
  // Settings State
  const [voiceName, setVoiceName] = useState<string>('Zephyr');
  const [systemInstruction, setSystemInstruction] = useState<string>('You are a friendly, helpful, and concise conversational partner. Keep your responses relatively short to facilitate a back-and-forth dialogue.');

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

  const { connected, connect, disconnect, isMuted, toggleMute, volume, transcript } = useLiveAPI();

  const handleNavigate = (screen: ScreenName) => {
    setCurrentScreen(screen);
  };

  const handleStartCall = async () => {
    startTimeRef.current = Date.now();
    await connect({ voiceName, systemInstruction });
    setCurrentScreen(ScreenName.USAGE);
  };

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
    <div className="w-full h-[100dvh] md:flex md:justify-center md:items-center md:min-h-screen md:bg-[#e5e5e5] font-sans">
      {/* 
        Responsive Container:
        - Mobile: Full screen, no padding, no border, no radius
        - Desktop (md+): Fixed width/height, rounded corners, black border (phone frame)
      */}
      <div className="w-full h-full md:max-w-[390px] md:h-[844px] relative overflow-hidden md:rounded-[40px] md:shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] md:border-[8px] md:border-black md:bg-black">

        {/* Inner Screen Content */}
        <div className="w-full h-full bg-white overflow-hidden md:rounded-[32px]">
            {currentScreen === ScreenName.HOME && (
            <HomeScreen 
                onStartCall={handleStartCall} 
                onSettings={() => handleNavigate(ScreenName.SETTINGS)} 
            />
            )}

            {currentScreen === ScreenName.USAGE && (
            <UsageScreen 
                onEndCall={handleEndCall}
                onSettings={() => handleNavigate(ScreenName.SETTINGS)}
                isMuted={isMuted}
                toggleMute={toggleMute}
                volume={volume}
                caption={transcript}
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
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default App;