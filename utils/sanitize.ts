/**
 * Sanitize user input to prevent XSS attacks
 * Based on OWASP recommendations
 */

const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
    return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from string
 */
export function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize string for safe display
 * Removes dangerous patterns and escapes HTML
 */
export function sanitize(input: string): string {
    if (typeof input !== 'string') return '';

    let clean = input;

    // Remove javascript: and data: URLs
    clean = clean.replace(/javascript:/gi, '');
    clean = clean.replace(/data:/gi, '');

    // Remove on* event handlers
    clean = clean.replace(/\s*on\w+\s*=/gi, ' ');

    // Remove script tags
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Escape remaining HTML
    clean = escapeHtml(clean);

    return clean.trim();
}

/**
 * Sanitize API key format (alphanumeric and hyphens only)
 */
export function sanitizeApiKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9\-_]/g, '');
}

/**
 * Sanitize system instruction (allow basic formatting)
 */
export function sanitizeSystemInstruction(instruction: string): string {
    if (typeof instruction !== 'string') return '';

    // Remove potential injection patterns but keep newlines/formatting
    let clean = instruction;

    // Remove HTML/script content
    clean = stripHtml(clean);

    // Remove javascript protocol
    clean = clean.replace(/javascript:/gi, '');

    // Limit length
    const MAX_LENGTH = 10000;
    if (clean.length > MAX_LENGTH) {
        clean = clean.substring(0, MAX_LENGTH);
    }

    return clean.trim();
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
    try {
        const parsed = new URL(url);

        // Only allow http and https
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }

        return parsed.href;
    } catch {
        return null;
    }
}

export default {
    escapeHtml,
    stripHtml,
    sanitize,
    sanitizeApiKey,
    sanitizeSystemInstruction,
    sanitizeUrl,
};
