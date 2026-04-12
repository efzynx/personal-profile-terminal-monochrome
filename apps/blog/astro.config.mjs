// @ts-check
import { defineConfig } from 'astro/config';
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
  base: env.PUBLIC_BLOG_BASE_PATH || '/blog',
  server: { port: parseInt(env.APP_BLOG_PORT || '4323') },
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