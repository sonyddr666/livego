import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

const appSpaRoutePlugin = (): Plugin => ({
  name: 'livego-app-spa-route',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const pathname = request.url?.split('?')[0];

      // On case-insensitive filesystems, Vite resolves `/app` to `App.tsx`.
      // Rewrite browser navigations before Vite's file-serving middleware runs.
      if (pathname === '/app' || pathname?.startsWith('/app/')) {
        request.url = '/index.html';
      }
      next();
    });
  },
});

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['.trycloudflare.com', 'localhost', '.onrender.com', '.livego.dev'],
      proxy: {
        '/api/gemini': {
          target: 'http://localhost:10000',
          // Preserve the browser-facing host so the API's same-origin check
          // also works when local development uses 127.0.0.1 instead of localhost.
          changeOrigin: false,
        },
        '/api/ghost': {
          target: 'https://api.ghost1.cloud',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/ghost/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest) => {
              proxyRequest.removeHeader('origin');
              proxyRequest.removeHeader('referer');
              proxyRequest.setHeader('X-API-Key', 'coloque_uma_senha_aqui');
            });
          },
        },
      },
    },
    preview: {
      port: 10000,
      host: '0.0.0.0',
      allowedHosts: ['.onrender.com', 'chat.livego.dev', '.livego.dev'],
    },
    plugins: [
      appSpaRoutePlugin(),
      react(),
      ...(mode === 'analyze'
        ? [
            visualizer({
              filename: './dist/stats.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-gemini': ['@google/genai'],
          },
        },
      },
    },
  };
});
