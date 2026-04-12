// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import vercel from '@astrojs/vercel';

const env = loadEnv(process.env.NODE_ENV || 'development', '../../', '');

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