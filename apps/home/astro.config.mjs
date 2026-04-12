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
  base: env.PUBLIC_HOME_BASE_PATH || '/',
  server: { port: parseInt(env.APP_HOME_PORT || '4321') },
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