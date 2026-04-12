// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import vercel from '@astrojs/vercel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Coba baca dari file .env lokal (monorepo root), fallback ke process.env (Vercel)
const fileEnv = loadEnv(process.env.NODE_ENV || 'production', '../../', '');
const env = { ...process.env, ...fileEnv };

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: vercel({
    middlewareMode: 'edge',
  }),
  base: env.PUBLIC_HOME_BASE_PATH || '/',
  server: { port: parseInt(env.APP_HOME_PORT || '4321') },
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