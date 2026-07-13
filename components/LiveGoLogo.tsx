import React, { useId } from 'react';

interface LiveGoLogoMarkProps {
  className?: string;
  title?: string;
}

/** Official LiveGo mark: version 02 from the approved logo comparison. */
export const LiveGoLogoMark: React.FC<LiveGoLogoMarkProps> = ({ className = 'h-9 w-9', title }) => {
  const gradientId = `livego-logo-${useId().replace(/:/g, '')}`;

  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
      <circle cx="20" cy="20" r="6.25" stroke="white" strokeWidth="5.5" />
    </svg>
  );
};

export default LiveGoLogoMark;
