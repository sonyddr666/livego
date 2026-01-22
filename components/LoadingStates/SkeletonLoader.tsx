import React from 'react';

interface SkeletonLoaderProps {
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    variant = 'text',
    width = '100%',
    height,
    className = '',
}) => {
    const baseClasses = 'animate-pulse bg-gray-200 rounded';

    const variantClasses = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    const defaultHeights = {
        text: '1rem',
        circular: width,
        rectangular: '4rem',
    };

    const style: React.CSSProperties = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: height || defaultHeights[variant],
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
            aria-hidden="true"
        />
    );
};

interface SkeletonGroupProps {
    lines?: number;
    spacing?: string;
    className?: string;
}

export const TextSkeletonGroup: React.FC<SkeletonGroupProps> = ({
    lines = 3,
    spacing = 'space-y-2',
    className = '',
}) => (
    <div className={`${spacing} ${className}`} aria-busy="true" aria-label="Loading content">
        {Array.from({ length: lines }).map((_, i) => (
            <SkeletonLoader
                key={i}
                variant="text"
                width={i === lines - 1 ? '75%' : '100%'}
            />
        ))}
    </div>
);

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`p-4 bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
        <div className="flex items-center space-x-4">
            <SkeletonLoader variant="circular" width={48} height={48} />
            <div className="flex-1 space-y-2">
                <SkeletonLoader variant="text" width="60%" />
                <SkeletonLoader variant="text" width="40%" />
            </div>
        </div>
    </div>
);

export default SkeletonLoader;
