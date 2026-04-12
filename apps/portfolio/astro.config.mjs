// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = loadEnv(process.env.NODE_ENV || 'development', '../../', '');

// https://astro.build/config
export default defineConfig({
  base: env.PUBLIC_PORTFOLIO_BASE_PATH || '/portfolio',
  server: { port: parseInt(env.APP_PORTFOLIO_PORT || '4322') },
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