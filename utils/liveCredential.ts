import type { LiveCredential } from '../types';

const TOKEN_TIMEOUT_MS = 8_000;

interface TokenResponse {
  token?: unknown;
  expiresAt?: unknown;
}

export interface CredentialResolution {
  credential: LiveCredential | null;
  source: 'deploy' | 'user' | 'none';
  reason?: 'unavailable' | 'rate-limited' | 'request-failed';
}

export async function resolveLiveCredential(userApiKey: string): Promise<CredentialResolution> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch('/api/gemini/token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });

    if (response.ok) {
      const payload = await response.json() as TokenResponse;
      if (typeof payload.token === 'string' && payload.token.length > 20) {
        return {
          credential: { kind: 'ephemeral', value: payload.token, apiVersion: 'v1alpha' },
          source: 'deploy',
        };
      }
    }

    if (userApiKey.trim()) {
      return {
        credential: { kind: 'user-key', value: userApiKey.trim(), apiVersion: 'v1beta' },
        source: 'user',
        reason: response.status === 429 ? 'rate-limited' : 'unavailable',
      };
    }

    return {
      credential: null,
      source: 'none',
      reason: response.status === 429 ? 'rate-limited' : 'unavailable',
    };
  } catch {
    if (userApiKey.trim()) {
      return {
        credential: { kind: 'user-key', value: userApiKey.trim(), apiVersion: 'v1beta' },
        source: 'user',
        reason: 'request-failed',
      };
    }
    return { credential: null, source: 'none', reason: 'request-failed' };
  } finally {
    window.clearTimeout(timeout);
  }
}
