const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = 'localhost';
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const GHOST_SEARCH_URL = process.env.GHOST_SEARCH_URL || process.env.GHOST_API_URL || 'https://api.ghost1.cloud';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  send(
    res,
    statusCode,
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    JSON.stringify(payload),
  );
}

function safeResolve(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = pathname === '/' ? '/test.html' : pathname;
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const absolute = path.join(ROOT, normalized);

  if (!absolute.startsWith(ROOT)) {
    return null;
  }

  return absolute;
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

  if (pathname === '/api/ghost/search') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { status: 'error', error: 'Method not allowed. Use POST.' });
      return;
    }

    try {
      let rawBody = '';
      for await (const chunk of req) rawBody += chunk;

      const upstreamPath = pathname.replace(/^\/api\/ghost/, '') || '/';
      const upstreamUrl = `${GHOST_SEARCH_URL.replace(/\/$/, '')}${upstreamPath}`;

      const upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      });

      const upstreamText = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8';

      send(
        res,
        upstreamResponse.status,
        {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
        upstreamText,
      );
    } catch (error) {
      sendJson(res, 502, {
        status: 'error',
        error: `Ghost Search proxy failed: ${error.message}`,
      });
    }
    return;
  }

  const filePath = safeResolve(req.url || '/');
  if (!filePath) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal server error');
        return;
      }

      send(res, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      }, data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/test.html`);
});

server.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});
