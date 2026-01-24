import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    // Whether to load conversation history as context for new conversations
    useConversationContext: boolean;
    setUseConversationContext: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            useConversationContext: false, // Default: OFF
            setUseConversationContext: (value: boolean) => set({ useConversationContext: value }),
        }),
        {
            name: 'livego-settings'
        }
    )
);
