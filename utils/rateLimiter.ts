import { useRef, useCallback } from 'react';

interface RateLimiterOptions {
    maxCalls: number;
    windowMs: number;
}

/**
 * Hook for rate limiting function calls
 */
export function useRateLimiter(options: RateLimiterOptions = { maxCalls: 10, windowMs: 1000 }) {
    const callsRef = useRef<number[]>([]);

    const isAllowed = useCallback((): boolean => {
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Remove calls outside the window
        callsRef.current = callsRef.current.filter(time => time > windowStart);

        if (callsRef.current.length >= options.maxCalls) {
            return false;
        }

        callsRef.current.push(now);
        return true;
    }, [options.maxCalls, options.windowMs]);

    const reset = useCallback(() => {
        callsRef.current = [];
    }, []);

    return { isAllowed, reset };
}

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle function for rate limiting
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}
