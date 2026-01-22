import React from 'react';

interface ConnectionLoaderProps {
    status: 'idle' | 'connecting' | 'connected' | 'error';
    message?: string;
}

export const ConnectionLoader: React.FC<ConnectionLoaderProps> = ({
    status,
    message
}) => {
    const statusConfig = {
        idle: {
            color: 'bg-gray-400',
            text: 'Ready to connect',
            animate: false,
        },
        connecting: {
            color: 'bg-blue-500',
            text: message || 'Connecting...',
            animate: true,
        },
        connected: {
            color: 'bg-green-500',
            text: 'Connected',
            animate: false,
        },
        error: {
            color: 'bg-red-500',
            text: message || 'Connection failed',
            animate: false,
        },
    };

    const config = statusConfig[status];

    return (
        <div className="flex items-center justify-center space-x-3 py-4">
            {/* Audio wave animation */}
            <div className="flex items-center space-x-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={`w-1 rounded-full ${config.color} transition-all ${config.animate ? 'animate-pulse' : ''
                            }`}
                        style={{
                            height: config.animate ? `${12 + Math.sin(i * 1.2) * 8}px` : '4px',
                            animationDelay: `${i * 0.1}s`,
                        }}
                    />
                ))}
            </div>

            {/* Status text */}
            <span className={`text-sm font-medium ${status === 'error' ? 'text-red-600' :
                    status === 'connected' ? 'text-green-600' :
                        'text-gray-600'
                }`}>
                {config.text}
            </span>
        </div>
    );
};

interface PulseLoaderProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({
    size = 'md',
    color = 'bg-blue-500'
}) => {
    const sizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    return (
        <div className="flex items-center space-x-1" role="status" aria-label="Loading">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className={`${sizes[size]} ${color} rounded-full animate-bounce`}
                    style={{ animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </div>
    );
};

export default ConnectionLoader;
