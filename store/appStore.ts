import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
interface Settings {
    voiceName: string;
    systemInstruction: string;
    apiKey: string;
    language: string;
}

interface ConversationState {
    isConnected: boolean;
    isConnecting: boolean;
    isMuted: boolean;
    isSpeakerOn: boolean;
    transcript: string;
    volume: number;
}

interface HistoryItem {
    id: string;
    date: string;
    duration: string;
    transcript: string;
}

interface AppState {
    // Settings
    settings: Settings;
    updateSettings: (updates: Partial<Settings>) => void;

    // Conversation
    conversation: ConversationState;
    updateConversation: (updates: Partial<ConversationState>) => void;
    resetConversation: () => void;

    // History
    history: HistoryItem[];
    addHistoryItem: (item: HistoryItem) => void;
    deleteHistoryItem: (id: string) => void;
    clearHistory: () => void;
}

const DEFAULT_SETTINGS: Settings = {
    voiceName: 'Zephyr',
    systemInstruction: '',
    apiKey: '',
    language: 'en',
};

const DEFAULT_CONVERSATION: ConversationState = {
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isSpeakerOn: true,
    transcript: '',
    volume: 0,
};

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Settings
            settings: DEFAULT_SETTINGS,
            updateSettings: (updates) =>
                set((state) => ({
                    settings: { ...state.settings, ...updates },
                })),

            // Conversation
            conversation: DEFAULT_CONVERSATION,
            updateConversation: (updates) =>
                set((state) => ({
                    conversation: { ...state.conversation, ...updates },
                })),
            resetConversation: () =>
                set({ conversation: DEFAULT_CONVERSATION }),

            // History
            history: [],
            addHistoryItem: (item) =>
                set((state) => ({
                    history: [item, ...state.history],
                })),
            deleteHistoryItem: (id) =>
                set((state) => ({
                    history: state.history.filter((item) => item.id !== id),
                })),
            clearHistory: () => set({ history: [] }),
        }),
        {
            name: 'livego-storage',
            partialize: (state) => ({
                settings: state.settings,
                history: state.history,
            }),
        }
    )
);

// Selectors for optimized re-renders
export const useSettings = () => useAppStore((state) => state.settings);
export const useConversation = () => useAppStore((state) => state.conversation);
export const useHistory = () => useAppStore((state) => state.history);

export default useAppStore;
