import React, { useState, useEffect, useCallback } from 'react';

interface OfflineStatus {
    isOnline: boolean;
    wasOffline: boolean;
    lastOnline: Date | null;
}

export function useOfflineStatus(): OfflineStatus {
    const [status, setStatus] = useState<OfflineStatus>({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        wasOffline: false,
        lastOnline: null,
    });

    const handleOnline = useCallback(() => {
        setStatus(prev => ({
            isOnline: true,
            wasOffline: !prev.isOnline,
            lastOnline: new Date(),
        }));
    }, []);

    const handleOffline = useCallback(() => {
        setStatus(prev => ({
            ...prev,
            isOnline: false,
        }));
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [handleOnline, handleOffline]);

    return status;
}

interface OfflineIndicatorProps {
    isOnline: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOnline }) => {
    if (isOnline) return null;

    return React.createElement('div', {
        className: 'fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 text-sm font-medium z-50'
    }, 'You are offline. Some features may be unavailable.');
};

export default useOfflineStatus;
