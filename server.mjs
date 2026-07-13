import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 10000);
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((request, response, next) => {
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  next();
});

app.use(express.json({ limit: '2kb' }));

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many token requests. Use a personal Gemini API key or try again later.',
    });
  },
});

function isAllowedOrigin(request) {
  const origin = request.get('origin');
  if (!origin) return true;

  const forwardedProto = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.protocol;
  const currentOrigin = `${protocol}://${request.get('host')}`;
  const configuredOrigins = (process.env.APP_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return origin === currentOrigin || configuredOrigins.includes(origin);
}

app.get('/health', (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post('/api/gemini/token', tokenLimiter, async (request, response) => {
  if (!isAllowedOrigin(request)) {
    response.status(403).json({ code: 'ORIGIN_NOT_ALLOWED', message: 'Cross-origin token requests are not allowed.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    response.status(503).json({ code: 'DEPLOY_KEY_UNAVAILABLE', message: 'Shared Gemini access is not configured.' });
    return;
  }

  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    if (!token.name) throw new Error('Gemini returned an empty ephemeral token.');

    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({ token: token.name, expiresAt: expireTime });
  } catch (error) {
    console.error('[server] Gemini token provisioning failed:', error instanceof Error ? error.message : error);
    response.status(502).json({ code: 'TOKEN_PROVISION_FAILED', message: 'Could not provision a Gemini Live token.' });
  }
});

app.use('/api/ghost', async (request, response) => {
  const upstreamPath = request.originalUrl.replace(/^\/api\/ghost/, '') || '/';
  const upstreamUrl = `https://api.ghost1.cloud${upstreamPath}`;
  const headers = {
    Accept: request.get('accept') || 'application/json',
    'Content-Type': request.get('content-type') || 'application/json',
    'X-API-Key': 'coloque_uma_senha_aqui',
  };

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(request.body ?? {}),
      signal: AbortSignal.timeout(65_000),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.status(upstream.status);
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    response.send(body);
  } catch (error) {
    console.error('[server] Ghost proxy failed:', error instanceof Error ? error.message : error);
    response.status(502).json({ code: 'GHOST_PROXY_FAILED', message: 'Ghost Search is unavailable.' });
  }
});

app.use(express.static(distPath, {
  index: false,
  setHeaders: (response, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
      response.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.use((request, response, next) => {
  if (request.path.startsWith('/api/')) {
    response.status(404).json({ code: 'NOT_FOUND', message: 'API route not found.' });
    return;
  }
  if (request.method !== 'GET' || !request.accepts('html')) {
    next();
    return;
  }
  response.setHeader('Cache-Control', 'no-cache');
  response.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[server] LiveGo listening on port ${port}`);
});
