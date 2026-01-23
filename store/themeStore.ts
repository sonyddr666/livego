import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light';
    if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
}

function applyTheme(theme: 'light' | 'dark'): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
    }
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'system',
            resolvedTheme: 'light',
            setTheme: (theme: Theme) => {
                const resolved = resolveTheme(theme);
                set({ theme, resolvedTheme: resolved });
                applyTheme(resolved);
            },
        }),
        {
            name: 'livego-theme',
        }
    )
);

// Initialize theme on load
if (typeof window !== 'undefined') {
    const initTheme = () => {
        const stored = localStorage.getItem('livego-theme');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const theme = parsed?.state?.theme || 'system';
                const resolved = resolveTheme(theme);
                applyTheme(resolved);
                useThemeStore.setState({ resolvedTheme: resolved });
            } catch {
                applyTheme(resolveTheme('system'));
            }
        }
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const state = useThemeStore.getState();
        if (state.theme === 'system') {
            const resolved = e.matches ? 'dark' : 'light';
            useThemeStore.setState({ resolvedTheme: resolved });
            applyTheme(resolved);
        }
    });
}
