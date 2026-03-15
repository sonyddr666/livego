import React, { useState, useEffect, useRef } from 'react';

interface ToastData {
  message: string;
  type: 'error' | 'warning' | 'info';
  duration?: number;
  actionLabel?: string;
}

// Helper to show a toast from anywhere
export function showToast(
  message: string,
  type: 'error' | 'warning' | 'info' = 'error',
  duration = 6,
  actionLabel?: string
) {
  window.dispatchEvent(new CustomEvent('livego:toast', {
    detail: { message, type, duration, actionLabel }
  }));
}

const ICONS: Record<string, string> = {
  error: '🔑',
  warning: '⚠️',
  info: 'ℹ️',
};

const COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  error: {
    bg: 'from-red-500/20 to-red-900/30',
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]',
  },
  warning: {
    bg: 'from-amber-500/20 to-amber-900/30',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
  },
  info: {
    bg: 'from-blue-500/20 to-blue-900/30',
    border: 'border-blue-500/30',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.2)]',
  },
};

/**
 * Toast — global overlay notification component.
 * Listens for 'livego:toast' events. Use showToast() to trigger.
 */
export const Toast: React.FC = () => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail as ToastData;
      if (!detail?.message) return;

      // Clear existing timer
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast(detail);
      setIsVisible(true);

      // Auto-hide
      const duration = detail.duration || 6;
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setToast(null), 400);
      }, duration * 1000);
    };

    window.addEventListener('livego:toast', handleToast);
    return () => {
      window.removeEventListener('livego:toast', handleToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  const colors = (COLORS[toast.type] || COLORS['error'])!;

  return (
    <div
      className={`absolute top-0 left-0 right-0 z-[999] flex justify-center p-4 pt-14 transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
    >
      <div
        className={`max-w-[360px] w-full bg-gradient-to-br ${colors.bg} backdrop-blur-2xl rounded-2xl border ${colors.border} ${colors.glow} p-4 cursor-pointer`}
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setIsVisible(false);
          setTimeout(() => setToast(null), 400);
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{ICONS[toast.type]}</span>
          <p className="text-white/90 text-[13px] font-medium leading-relaxed whitespace-pre-line">
            {toast.message}
          </p>
        </div>
        <p
          className="text-white/50 text-[11px] text-center mt-3 tracking-wide font-medium cursor-pointer hover:text-white/80 transition-colors underline underline-offset-2"
          onClick={(e) => {
            e.stopPropagation();
            if (toast.actionLabel) {
              window.dispatchEvent(new CustomEvent('livego:toast_action'));
            }
            if (timerRef.current) clearTimeout(timerRef.current);
            setIsVisible(false);
            setTimeout(() => setToast(null), 400);
          }}
        >
          {toast.actionLabel || 'toque para fechar'}
        </p>
      </div>
    </div>
  );
};
