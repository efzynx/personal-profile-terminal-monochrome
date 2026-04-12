// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Coba baca dari file .env lokal (monorepo root), fallback ke process.env (Vercel)
const fileEnv = loadEnv(process.env.NODE_ENV || 'production', '../../', '');
const env = { ...process.env, ...fileEnv };

// https://astro.build/config
export default defineConfig({
  base: '/portfolio/',
  server: { port: parseInt(env.APP_PORTFOLIO_PORT || '4322') },
  image: { service: passthroughImageService() },
  vite: {
    envDir: '../../',
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@repo/ui': path.resolve(__dirname, '../../packages/ui/src'),
      },
    },
  },
});