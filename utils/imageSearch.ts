/**
 * imageSearch.ts — Busca de imagens via Wikimedia Commons + Openverse
 * Zero API key, zero proxy, CORS nativo
 */

export interface ImageResult {
  title: string;
  url: string;
  thumbnail?: string;
  source: string;
  license: string;
}

/**
 * Search Wikimedia Commons for images
 * Uses 2-step process: search file titles → resolve image URLs
 */
export async function searchWikimediaImages(query: string, limit = 5): Promise<ImageResult[]> {
  try {
    // Step 1: search file titles
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srnamespace', '6'); // namespace 6 = File
    searchUrl.searchParams.set('srlimit', String(limit));
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*'); // CORS

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const titles = (searchData?.query?.search || [])
      .map((r: any) => r.title)
      .join('|');

    if (!titles) return [];

    // Step 2: resolve real image URLs
    const infoUrl = new URL('https://commons.wikimedia.org/w/api.php');
    infoUrl.searchParams.set('action', 'query');
    infoUrl.searchParams.set('titles', titles);
    infoUrl.searchParams.set('prop', 'imageinfo');
    infoUrl.searchParams.set('iiprop', 'url|extmetadata|mime');
    infoUrl.searchParams.set('iiurlwidth', '800');
    infoUrl.searchParams.set('format', 'json');
    infoUrl.searchParams.set('origin', '*');

    const infoRes = await fetch(infoUrl);
    if (!infoRes.ok) return [];
    const infoData = await infoRes.json();

    return Object.values(infoData?.query?.pages || {})
      .map((page: any) => {
        const info = page?.imageinfo?.[0];
        if (!info) return null;
        // Skip SVG, PDF, audio, video
        const mime = info.mime || '';
        if (!mime.startsWith('image/') || mime.includes('svg')) return null;
        return {
          title: info.extmetadata?.ObjectName?.value ?? page.title?.replace('File:', ''),
          url: info.thumburl ?? info.url,
          thumbnail: info.thumburl as string | undefined,
          source: 'Wikimedia Commons',
          license: info.extmetadata?.LicenseShortName?.value ?? 'CC',
        } as ImageResult;
      })
      .filter((img): img is ImageResult => img !== null);
  } catch (e) {
    console.warn('[ImageSearch] Wikimedia Commons error:', e);
    return [];
  }
}

/**
 * Search Openverse for images (Creative Commons catalog)
 * Free, no key required, CORS enabled
 */
export async function searchOpenverseImages(query: string, limit = 5): Promise<ImageResult[]> {
  try {
    const url = new URL('https://api.openverse.org/v1/images/');
    url.searchParams.set('q', query);
    url.searchParams.set('page_size', String(limit));
    url.searchParams.set('format', 'json');

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results ?? []).map((img: any) => ({
      title: img.title || query,
      url: img.url,
      thumbnail: img.thumbnail,
      source: img.source || 'Openverse',
      license: img.license || 'CC',
    }));
  } catch (e) {
    console.warn('[ImageSearch] Openverse error:', e);
    return [];
  }
}

/**
 * Unified image search — tries Wikimedia first, Openverse as fallback
 */
export async function searchImages(query: string): Promise<ImageResult | null> {
  // Strategy 1: both in parallel
  const [wikimedia, openverse] = await Promise.all([
    searchWikimediaImages(query, 3),
    searchOpenverseImages(query, 3),
  ]);

  // Prefer Wikimedia (higher quality thumbnails)
  if (wikimedia.length > 0) return wikimedia[0] ?? null;
  if (openverse.length > 0) return openverse[0] ?? null;

  return null;
}
