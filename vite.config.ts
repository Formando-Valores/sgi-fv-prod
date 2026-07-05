import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
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
        minify: 'esbuild',
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            recovery: path.resolve(__dirname, 'recovery.html'),
          },
        },
      },
      plugins: [
        react(),
        {
          name: 'generate-version-json',
          closeBundle() {
            fs.writeFileSync(
              path.resolve(__dirname, 'dist', 'version.json'),
              JSON.stringify({ buildTime: Date.now() }, null, 2)
            );
          },
        },
      ],
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
