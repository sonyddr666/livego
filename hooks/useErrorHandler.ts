import { useState, useCallback } from 'react';

export type ErrorCategory = 'api' | 'network' | 'permission' | 'validation' | 'unknown';

interface AppError {
    message: string;
    category: ErrorCategory;
    originalError?: Error;
    timestamp: number;
}

interface UseErrorHandlerResult {
    error: AppError | null;
    setError: (error: Error | string, category?: ErrorCategory) => void;
    clearError: () => void;
    handleAsyncError: <T>(promise: Promise<T>, category?: ErrorCategory) => Promise<T | null>;
}

const categorizeError = (error: Error): ErrorCategory => {
    const message = error.message.toLowerCase();

    if (message.includes('api') || message.includes('key') || message.includes('unauthorized')) {
        return 'api';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return 'network';
    }
    if (message.includes('permission') || message.includes('denied') || message.includes('microphone')) {
        return 'permission';
    }
    if (message.includes('invalid') || message.includes('required') || message.includes('validation')) {
        return 'validation';
    }
    return 'unknown';
};

export const getErrorMessage = (category: ErrorCategory): string => {
    const messages: Record<ErrorCategory, string> = {
        api: 'API connection error. Please check your API key.',
        network: 'Network error. Please check your internet connection.',
        permission: 'Permission denied. Please grant the required permissions.',
        validation: 'Invalid input. Please check your data.',
        unknown: 'An unexpected error occurred.',
    };
    return messages[category];
};

export function useErrorHandler(): UseErrorHandlerResult {
    const [error, setErrorState] = useState<AppError | null>(null);

    const setError = useCallback((errorInput: Error | string, category?: ErrorCategory) => {
        const isError = errorInput instanceof Error;
        const errorMessage = isError ? errorInput.message : errorInput;
        const detectedCategory = category || (isError ? categorizeError(errorInput) : 'unknown');

        setErrorState({
            message: errorMessage,
            category: detectedCategory,
            originalError: isError ? errorInput : undefined,
            timestamp: Date.now(),
        });
    }, []);

    const clearError = useCallback(() => {
        setErrorState(null);
    }, []);

    const handleAsyncError = useCallback(async <T>(
        promise: Promise<T>,
        category?: ErrorCategory
    ): Promise<T | null> => {
        try {
            return await promise;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error, category);
            return null;
        }
    }, [setError]);

    return { error, setError, clearError, handleAsyncError };
}

export default useErrorHandler;
