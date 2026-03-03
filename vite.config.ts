import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: 'all',
        hmr: isProd ? false : {
          // Use relative protocol to work with any host
          protocol: 'ws',
          host: 'localhost',
        },
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
      },
      build: {
        // Clean build without source maps in production
        sourcemap: !isProd,
        // Remove console logs in production
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: isProd,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
