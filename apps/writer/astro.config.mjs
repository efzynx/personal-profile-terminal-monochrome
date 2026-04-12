// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import vercel from '@astrojs/vercel';

// Coba baca dari file .env lokal (monorepo root), fallback ke process.env (Vercel)
const fileEnv = loadEnv(process.env.NODE_ENV || 'production', '../../', '');
const env = { ...process.env, ...fileEnv };

// https://astro.build/config
export default defineConfig({
  base: env.PUBLIC_WRITER_BASE_PATH || '/writer',
  server: { port: parseInt(env.APP_WRITER_PORT || '4324') },
  output: 'server',
  adapter: vercel(),
  vite: {
    envDir: '../../',
    plugins: [tailwindcss()],
  },
});