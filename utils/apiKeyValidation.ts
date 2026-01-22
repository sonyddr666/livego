const GEMINI_API_KEY_PREFIX = 'AIza';
const GEMINI_API_KEY_LENGTH = 39;

export interface ApiKeyValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates the format of a Gemini API key
 */
export function validateApiKeyFormat(apiKey: string): ApiKeyValidationResult {
    if (!apiKey || apiKey.trim().length === 0) {
        return { isValid: false, error: 'API key is required' };
    }

    const trimmedKey = apiKey.trim();

    if (!trimmedKey.startsWith(GEMINI_API_KEY_PREFIX)) {
        return { isValid: false, error: 'Invalid API key format' };
    }

    if (trimmedKey.length !== GEMINI_API_KEY_LENGTH) {
        return { isValid: false, error: `API key must be ${GEMINI_API_KEY_LENGTH} characters` };
    }

    return { isValid: true };
}

/**
 * Tests connectivity with the Gemini API
 */
export async function testApiKeyConnectivity(apiKey: string): Promise<ApiKeyValidationResult> {
    const formatValidation = validateApiKeyFormat(apiKey);
    if (!formatValidation.isValid) {
        return formatValidation;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (response.ok) {
            return { isValid: true };
        }

        if (response.status === 400 || response.status === 401) {
            return { isValid: false, error: 'Invalid API key' };
        }

        if (response.status === 403) {
            return { isValid: false, error: 'API key does not have required permissions' };
        }

        return { isValid: false, error: `API error: ${response.status}` };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return { isValid: false, error: 'Network error. Check your connection.' };
        }
        return { isValid: false, error: 'Connection test failed' };
    }
}

export type ApiKeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export default { validateApiKeyFormat, testApiKeyConnectivity };
