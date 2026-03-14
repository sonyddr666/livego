import React, { useState, useEffect, useRef } from 'react';
import { searchImages } from '../utils/imageSearch';

interface ImageData {
  url: string;
  caption: string;
  query: string;
}

/**
 * ImageOverlay — listens for 'livego:show_image' / 'livego:hide_image' events
 * and displays a real image fetched via Wikimedia Commons + Openverse.
 */
export const ImageOverlay: React.FC = () => {
  const [image, setImage] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch image using the unified search (Wikimedia + Openverse)
  const fetchImageForQuery = async (query: string): Promise<string | null> => {
    const result = await searchImages(query);
    return result?.url || result?.thumbnail || null;
  };

  useEffect(() => {
    const handleShow = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const query: string = detail.query || '';
      const caption: string = detail.caption || '';
      const duration: number = detail.duration || 6;

      if (!query) return;

      // Clear existing timer
      if (timerRef.current) clearTimeout(timerRef.current);

      setIsLoading(true);
      setHasError(false);
      setIsVisible(true);

      let imageUrl: string | null = null;

      // Check if query is already a URL
      if (query.startsWith('http://') || query.startsWith('https://')) {
        imageUrl = query;
      } else {
        // Search for an image
        imageUrl = await fetchImageForQuery(query);
      }

      if (imageUrl) {
        setImage({ url: imageUrl, caption: caption || query, query });
        setHasError(false);
      } else {
        setImage({ url: '', caption: caption || query, query });
        setHasError(true);
      }
      setIsLoading(false);

      // Auto-hide after duration
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setImage(null);
          setHasError(false);
        }, 400); // Wait for exit animation
      }, duration * 1000);
    };

    const handleHide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsVisible(false);
      setTimeout(() => {
        setImage(null);
        setIsLoading(false);
        setHasError(false);
      }, 400);
    };

    window.addEventListener('livego:show_image', handleShow);
    window.addEventListener('livego:hide_image', handleHide);

    return () => {
      window.removeEventListener('livego:show_image', handleShow);
      window.removeEventListener('livego:hide_image', handleHide);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!image && !isLoading) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop — strong blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setIsVisible(false);
          setTimeout(() => { setImage(null); setHasError(false); }, 500);
        }}
      />

      {/* Image Card */}
      <div className={`relative z-10 max-w-[340px] w-full transform transition-all duration-500 ease-out
        ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}>
        
        {/* Glow effect behind card */}
        <div className="absolute -inset-2 bg-gradient-to-b from-indigo-500/20 via-purple-500/10 to-transparent rounded-[28px] blur-xl pointer-events-none" />
        
        {/* Glass card */}
        <div className="relative bg-white/[0.08] backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/[0.15] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          
          {/* Image container — adapts to image size */}
          <div className="relative w-full bg-black/40 overflow-hidden flex items-center justify-center" style={{ minHeight: '120px', maxHeight: '60vh' }}>
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                <span className="text-white/40 text-xs">Buscando imagem...</span>
              </div>
            )}

            {hasError && !isLoading && (
              <div className="flex flex-col items-center justify-center text-white/50 px-6 py-12">
                <span className="text-4xl mb-3">🖼️</span>
                <span className="text-sm text-center font-medium">Imagem não encontrada</span>
                <span className="text-xs text-white/30 mt-1 text-center">"{image?.query}"</span>
              </div>
            )}

            {image?.url && !hasError && (
              <>
                <img
                  src={image.url}
                  alt={image.caption}
                  className="w-full max-h-[60vh] object-contain transition-opacity duration-300"
                  onError={() => setHasError(true)}
                />
                {/* Gradient overlay on bottom for caption readability */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </>
            )}
          </div>

          {/* Caption bar */}
          {image?.caption && (
            <div className="px-5 py-3.5 bg-black/30">
              <p className="text-white/90 text-[13px] font-semibold text-center tracking-wide">
                {image.caption}
              </p>
            </div>
          )}
        </div>

        {/* Dismiss hint */}
        <p className="text-white/30 text-[10px] text-center mt-3 tracking-widest uppercase">
          toque para fechar
        </p>
      </div>
    </div>
  );
};
