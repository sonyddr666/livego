/**
 * Voice configuration for Gemini Live API
 * These are the available voices that can be used during conversations.
 * 
 * Voice list sourced from Google Gemini documentation.
 * Update this file when new voices become available.
 */

export interface VoiceConfig {
    id: string;
    name: string;
    description?: string;
}

export const AVAILABLE_VOICES: VoiceConfig[] = [
    { id: 'Puck', name: 'Puck', description: 'Playful and energetic' },
    { id: 'Charon', name: 'Charon', description: 'Deep and mysterious' },
    { id: 'Kore', name: 'Kore', description: 'Warm and friendly' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Bold and confident' },
    { id: 'Aoede', name: 'Aoede', description: 'Melodic and soothing' },
    { id: 'Zephyr', name: 'Zephyr', description: 'Light and breezy' },
];

export const DEFAULT_VOICE = 'Zephyr';

/**
 * Get voice names as simple string array (for backward compatibility)
 */
export const getVoiceNames = (): string[] => AVAILABLE_VOICES.map(v => v.id);
