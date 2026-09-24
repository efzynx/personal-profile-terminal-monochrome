import type { APIRoute } from 'astro';
import { listPosts } from '../lib/cms';
import { listPublishedNews } from '../lib/news';

export const prerender = false;

function getBaseUrl(url: URL): string {
  if (process.env.PUBLIC_SITE_URL && !process.env.PUBLIC_SITE_URL.includes('localhost')) {
    return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (url.origin && !url.origin.includes('localhost')) {
    return url.origin.replace(/\/$/, '');
  }
  return 'https://www.efzyn.my.id';
}

function formatDateIso(d?: string | Date): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return new Date().toISOString().slice(0, 10);
    return dateObj.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const GET: APIRoute = async ({ url }) => {
  const baseUrl = getBaseUrl(url);

  // 1. Halaman Statis
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/blog', priority: '0.9', changefreq: 'daily' },
    { path: '/news', priority: '0.9', changefreq: 'hourly' },
    { path: '/portfolio', priority: '0.8', changefreq: 'monthly' },
    { path: '/project', priority: '0.8', changefreq: 'weekly' },
    { path: '/sosmed', priority: '0.6', changefreq: 'monthly' },
  ];

  // 2. Rute Dinamis Artikel Blog
  let posts: any[] = [];
  try {
    posts = await listPosts();
  } catch (err) {
    console.error('Error listing posts for sitemap:', err);
  }

  // 3. Rute Dinamis Berita
  let news: any[] = [];
  try {
    news = await listPublishedNews();
  } catch (err) {
    console.error('Error listing news for sitemap:', err);
  }

  const urlsXml: string[] = [];

  // Tambahkan halaman statis
  for (const page of staticPages) {
    urlsXml.push(`  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${formatDateIso()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Tambahkan artikel blog
  for (const post of posts) {
    if (post.slug) {
      const lastmod = formatDateIso(post.frontmatter?.pubDate);
      urlsXml.push(`  <url>
    <loc>${baseUrl}/blog/posts/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  // Tambahkan berita
  for (const item of news) {
    if (item.id) {
      const lastmod = formatDateIso(item.publishedAt || item.createdAt);
      urlsXml.push(`  <url>
    <loc>${baseUrl}/news/${item.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate',
    },
  });
};
