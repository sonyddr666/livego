import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SearchMode = 'google' | 'ghost';

interface SettingsState {
    // Whether to load conversation history as context for new conversations
    useConversationContext: boolean;
    setUseConversationContext: (value: boolean) => void;
    // Search mode: 'google' = Google Search, 'ghost' = Ghost-Search
    searchMode: SearchMode;
    setSearchMode: (mode: SearchMode) => void;
    toggleSearchMode: () => void;
    // Screen vision capture FPS (0.5–5, default 1)
    screenVisionFps: number;
    setScreenVisionFps: (fps: number) => void;
    // Inworld TTS Configuration
    ttsSecretKey: string;
    setTtsSecretKey: (key: string) => void;
    ttsVoiceId: string;
    setTtsVoiceId: (voiceId: string) => void;
    ttsModel: string;
    setTtsModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            useConversationContext: false,
            setUseConversationContext: (value: boolean) => set({ useConversationContext: value }),
            searchMode: 'google' as SearchMode,
            setSearchMode: (mode: SearchMode) => set({ searchMode: mode }),
            toggleSearchMode: () => set((state) => ({
                searchMode: state.searchMode === 'google' ? 'ghost' : 'google'
            })),
            screenVisionFps: 1,
            setScreenVisionFps: (fps: number) => set({ screenVisionFps: fps }),
            // Inworld TTS defaults
            ttsSecretKey: '',
            setTtsSecretKey: (key: string) => set({ ttsSecretKey: key }),
            ttsVoiceId: 'default--pb4bm1oowkem_r9ri2wiw__makoguren2',
            setTtsVoiceId: (voiceId: string) => set({ ttsVoiceId: voiceId }),
            ttsModel: 'inworld-tts-1.5-mini',
            setTtsModel: (model: string) => set({ ttsModel: model }),
        }),
        {
            name: 'livego-settings'
        }
    )
);
