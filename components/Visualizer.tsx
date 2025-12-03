import React from 'react';

interface VisualizerProps {
    volume: number;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume }) => {
    // Smoother volume for visual clarity (0 to 1)
    // We create 3 rings.
    // Ring 1: core, always present, scales slightly.
    // Ring 2: middle, scales more.
    // Ring 3: outer, scales the most, fades out.

    // Amplify volume for visual impact
    const v = Math.min(volume * 2, 1); 
    
    return (
        <div className="relative flex items-center justify-center w-[300px] h-[300px]">
            {/* Outer Glow / Particles */}
            <div 
                className="absolute rounded-full bg-blue-500 blur-3xl opacity-20 transition-all duration-100 ease-out"
                style={{ 
                    width: `${200 + (v * 150)}px`, 
                    height: `${200 + (v * 150)}px`,
                }} 
            />

            {/* Ring 3 (Outer Ripple) */}
            <div 
                className="absolute border border-blue-400/30 rounded-full transition-all duration-300 ease-out"
                style={{ 
                    width: `${160 + (v * 120)}px`, 
                    height: `${160 + (v * 120)}px`,
                    opacity: Math.max(0.1, 0.5 - v * 0.5)
                }} 
            />

            {/* Ring 2 (Mid Pulse) */}
            <div 
                className="absolute border-2 border-indigo-400/50 rounded-full transition-all duration-150 ease-out shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                style={{ 
                    width: `${120 + (v * 60)}px`, 
                    height: `${120 + (v * 60)}px`,
                    opacity: 0.6
                }} 
            />

            {/* Ring 1 (Core) */}
            <div 
                className="absolute w-[80px] h-[80px] rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_0_30px_rgba(79,70,229,0.6)] flex items-center justify-center z-10 transition-transform duration-75"
                style={{ transform: `scale(${1 + v * 0.2})` }}
            >
                <div className="w-[30px] h-[30px] bg-white/20 rounded-full blur-md" />
            </div>
        </div>
    );
};