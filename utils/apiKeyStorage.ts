const API_KEY_STORAGE_KEY = 'gemini_api_key';

export const readSessionApiKey = (): string => {
  try {
    const sessionKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (sessionKey) return sessionKey;
  } catch {
    // Keep the key in React state when browser storage is unavailable.
  }

  try {
    const legacyKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
    if (!legacyKey) return '';

    try {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, legacyKey);
    } catch {
      // React state still receives the migrated key for this page lifetime.
    }

    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      // Cleanup is best-effort in restricted browser contexts.
    }

    return legacyKey;
  } catch {
    return '';
  }
};

export const writeSessionApiKey = (value: string): void => {
  try {
    if (value) {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // React state remains the source of truth for the current page lifetime.
  }

  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors in restricted browser contexts.
  }
};
