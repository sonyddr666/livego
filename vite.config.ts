import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['.trycloudflare.com', 'localhost', '.onrender.com', '.livego.dev'],
      proxy: {
        '/api/gemini': {
          target: 'http://localhost:10000',
          changeOrigin: true,
        },
        '/api/ghost': {
          target: 'https://api.ghost1.cloud',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ghost/, ''),
        },
      },
    },
    preview: {
      port: 10000,
      host: '0.0.0.0',
      allowedHosts: ['.onrender.com', 'chat.livego.dev', '.livego.dev'],
    },
    plugins: [
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
