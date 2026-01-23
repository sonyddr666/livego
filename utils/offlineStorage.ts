const OFFLINE_STORAGE_KEY = 'livego_offline_queue';
const OFFLINE_CONVERSATIONS_KEY = 'livego_offline_conversations';

interface OfflineAction {
    id: string;
    type: 'conversation' | 'setting';
    data: unknown;
    timestamp: number;
}

/**
 * Get all pending offline actions
 */
export function getOfflineQueue(): OfflineAction[] {
    try {
        const data = localStorage.getItem(OFFLINE_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Add an action to the offline queue
 */
export function addToOfflineQueue(type: OfflineAction['type'], data: unknown): string {
    const queue = getOfflineQueue();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    queue.push({
        id,
        type,
        data,
        timestamp: Date.now(),
    });

    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue));
    return id;
}

/**
 * Remove an action from the queue
 */
export function removeFromOfflineQueue(id: string): void {
    const queue = getOfflineQueue().filter(item => item.id !== id);
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Clear the entire offline queue
 */
export function clearOfflineQueue(): void {
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
}

/**
 * Save a conversation transcript for offline access
 */
export function saveOfflineConversation(transcript: string, duration: string): void {
    try {
        const conversations = getOfflineConversations();
        conversations.push({
            id: Date.now().toString(),
            transcript,
            duration,
            savedAt: new Date().toISOString(),
            synced: false,
        });

        // Keep only last 50 conversations
        const trimmed = conversations.slice(-50);
        localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(trimmed));
    } catch (error) {
        console.error('Failed to save offline conversation:', error);
    }
}

interface OfflineConversation {
    id: string;
    transcript: string;
    duration: string;
    savedAt: string;
    synced: boolean;
}

/**
 * Get all offline conversations
 */
export function getOfflineConversations(): OfflineConversation[] {
    try {
        const data = localStorage.getItem(OFFLINE_CONVERSATIONS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Mark conversations as synced
 */
export function markConversationsSynced(ids: string[]): void {
    const conversations = getOfflineConversations().map(conv => ({
        ...conv,
        synced: ids.includes(conv.id) ? true : conv.synced,
    }));
    localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(conversations));
}

/**
 * Check available storage space
 */
export async function checkStorageQuota(): Promise<{ used: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            used: estimate.usage || 0,
            quota: estimate.quota || 0,
        };
    }
    return null;
}

export default {
    getOfflineQueue,
    addToOfflineQueue,
    removeFromOfflineQueue,
    clearOfflineQueue,
    saveOfflineConversation,
    getOfflineConversations,
    markConversationsSynced,
    checkStorageQuota,
};
