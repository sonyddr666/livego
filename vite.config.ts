import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    preview: {
      port: 10000,
      host: '0.0.0.0',
      allowedHosts: ['.onrender.com', 'chat.livego.dev', '.livego.dev'],
    },
    plugins: [
      react(),
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY
      ),
    },
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
