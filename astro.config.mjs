// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
  : true;

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  server: { port: 4321 },
  output: 'server',
  adapter: vercel(),
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: allowedHosts,
    },
    preview: {
      allowedHosts: allowedHosts,
    },
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@lib': path.resolve(__dirname, './src/lib'),
      },
    },
  },
});
