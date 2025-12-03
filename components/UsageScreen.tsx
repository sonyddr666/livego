import React, { useEffect, useState, useRef } from 'react';
import { Visualizer } from './Visualizer';
import { IconMic, IconMicOff, IconPhoneOff, IconVolume2, IconSettings } from './Icons';

interface UsageScreenProps {
  onEndCall: () => void;
  onSettings: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  volume: number;
  caption: string;
}

export const UsageScreen: React.FC<UsageScreenProps> = ({
  onEndCall,
  onSettings,
  isMuted,
  toggleMute,
  volume,
  caption
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const captionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to bottom when caption changes
  useEffect(() => {
      if (captionRef.current) {
          captionRef.current.scrollTop = captionRef.current.scrollHeight;
      }
  }, [caption]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white relative overflow-hidden transition-colors duration-500">
      
      {/* Ambient Background */}
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-indigo-900/30 via-black to-blue-900/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center px-8 pt-12 pb-6 relative z-10">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">Live</span>
        </div>
        <div className="flex flex-col items-center">
            <span className="text-gray-400 font-mono text-sm tracking-wider">{formatTime(seconds)}</span>
        </div>
        <button 
            disabled
            className="p-2 rounded-full transition-colors text-gray-600 opacity-30 cursor-not-allowed"
            title="End call to change settings"
        >
          <IconSettings className="w-6 h-6" />
        </button>
      </div>

      {/* Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full mb-20">
        <div className="mb-8 text-center px-8">
             <h2 className="text-2xl font-semibold text-white tracking-tight">Listening...</h2>
             <p className="text-gray-500 mt-2 text-sm">Gemini is active</p>
        </div>
        
        <Visualizer volume={isMuted ? 0 : volume} />
      </div>

      {/* Captions Overlay (Absolute Positioned) */}
      <div className={`absolute bottom-[160px] left-0 right-0 px-6 flex justify-center z-20 pointer-events-none transition-opacity duration-300 ${caption ? 'opacity-100' : 'opacity-0'}`}>
          <div 
              ref={captionRef}
              className="glass-dark rounded-xl px-6 py-4 max-w-[90%] md:max-w-[300px] pointer-events-auto max-h-[130px] overflow-y-auto no-scrollbar scroll-smooth"
          >
              <p className="text-center text-[15px] font-medium leading-relaxed text-gray-100 whitespace-pre-wrap">
                  {caption}
              </p>
          </div>
      </div>

      {/* Controls Dock */}
      <div className="px-8 pb-12 relative z-30">
        <div className="glass-dark rounded-3xl p-6 flex justify-between items-center shadow-2xl">
            
            {/* Mute Toggle */}
            <button 
                onClick={toggleMute}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${isMuted ? 'text-red-400' : 'text-white'}`}
            >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
                    {isMuted ? <IconMicOff className="w-6 h-6" /> : <IconMic className="w-6 h-6" />}
                </div>
                <span className="text-[11px] font-medium tracking-wide uppercase opacity-60">
                    {isMuted ? 'Muted' : 'Mute'}
                </span>
            </button>

            {/* End Call */}
            <button 
                onClick={onEndCall}
                className="flex flex-col items-center gap-2 active:scale-95"
            >
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-500 shadow-lg shadow-red-500/30 text-white transition-transform hover:scale-105">
                    <IconPhoneOff className="w-8 h-8 fill-current" />
                </div>
                <span className="text-[11px] font-medium tracking-wide uppercase opacity-60">End</span>
            </button>

            {/* Speaker Toggle */}
            <button 
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className={`flex flex-col items-center gap-2 transition-all active:scale-95 ${isSpeakerOn ? 'text-blue-400' : 'text-white'}`}
            >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-blue-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
                    <IconVolume2 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium tracking-wide uppercase opacity-60">Speaker</span>
            </button>

        </div>
      </div>

    </div>
  );
};