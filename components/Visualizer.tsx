import React, { useRef, useEffect, memo } from 'react';

interface VisualizerProps {
    analysers?: {
        input: AnalyserNode | null;
        output: AnalyserNode | null;
    };
    isMuted: boolean;
}

const VisualizerComponent: React.FC<VisualizerProps> = ({ analysers, isMuted }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            const centerX = width / 2;
            const centerY = height / 2;

            // Clear with a slight fade for trail effect
            ctx.clearRect(0, 0, width, height);

            // Frequency data array
            const freqData = new Uint8Array(128);
            let averageVolume = 0;
            let hasSignal = false;

            // 1. Calculate Volume/Energy

            // Output (Gemini talking) - Always visualize if present
            if (analysers?.output) {
                analysers.output.getByteFrequencyData(freqData);
                const sum = freqData.reduce((a, b) => a + b, 0);
                if (sum > 0) {
                    averageVolume = sum / freqData.length;
                    hasSignal = true;
                }
            }

            // Input (User talking) - Only visualize if NOT muted
            if (!isMuted && analysers?.input) {
                const inputData = new Uint8Array(128);
                analysers.input.getByteFrequencyData(inputData);
                const sum = inputData.reduce((a, b) => a + b, 0);
                const inputAvg = sum / inputData.length;

                // If Gemini is quiet, use user input. If Gemini talking, mix slightly.
                if (inputAvg > 0) {
                    averageVolume = hasSignal ? Math.max(averageVolume, inputAvg * 0.8) : inputAvg;
                }
            }

            // 2. Base Size & Dynamic Pulse
            // Normalize volume (0-255) to a scale factor (0-1)
            const intensity = averageVolume / 255;

            // Smooth "breathing" animation (idle state)
            const time = Date.now() / 1000;
            const breathing = Math.sin(time * 2) * 3;

            const baseRadius = 45;
            const dynamicRadius = baseRadius + (intensity * 50) + breathing;

            // 3. Draw The Glow (Outer Shells)
            const glowColor = `255, 255, 255`; // White core
            const outerColor = `91, 95, 255`; // Gemini Blue/Indigo

            // Outer Glow
            const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, dynamicRadius * 2);
            gradient.addColorStop(0, `rgba(${outerColor}, ${0.1 + intensity * 0.4})`);
            gradient.addColorStop(0.5, `rgba(${outerColor}, ${0.05 + intensity * 0.2})`);
            gradient.addColorStop(1, `rgba(${outerColor}, 0)`);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, dynamicRadius * 2, 0, Math.PI * 2);
            ctx.fill();

            // 4. Draw Core "Ball"
            ctx.fillStyle = `rgba(${glowColor}, ${0.8 + intensity * 0.2})`;
            ctx.shadowBlur = 20 + (intensity * 40);
            ctx.shadowColor = `rgb(${outerColor})`;

            ctx.beginPath();
            ctx.arc(centerX, centerY, dynamicRadius, 0, Math.PI * 2);
            ctx.fill();

            // Reset shadow
            ctx.shadowBlur = 0;

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [analysers, isMuted]); // Re-bind effect when mute state changes

    return (
        <div className="relative flex items-center justify-center w-full h-[300px]">
            <canvas
                ref={canvasRef}
                width={340}
                height={300}
                className="w-full h-full max-w-[340px]"
                aria-label="Audio visualizer"
                role="img"
            />
        </div>
    );
};

export const Visualizer = memo(VisualizerComponent);