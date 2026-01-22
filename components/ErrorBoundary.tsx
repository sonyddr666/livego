import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
                    <div className="w-16 h-16 mb-6 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
                    <p className="text-gray-500 text-center mb-6 max-w-sm">
                        An unexpected error occurred. Please try again.
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                    >
                        Try Again
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre className="mt-6 p-4 bg-gray-100 rounded-lg text-xs text-gray-700 max-w-full overflow-auto">
                            {this.state.error.message}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
