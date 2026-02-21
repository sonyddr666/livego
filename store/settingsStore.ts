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
        }),
        {
            name: 'livego-settings'
        }
    )
);
