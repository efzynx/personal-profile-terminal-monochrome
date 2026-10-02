import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { listPosts, savePost } from '../../../lib/cms';
import { sanitizeHtml } from '../../../lib/sanitize';
import { submitToIndexNow } from '../../../lib/indexnow';

export const GET: APIRoute = async ({ cookies, request }) => {
  // Auth sudah divalidasi di middleware (session cookie ATAU API key)
  const session = getSession(cookies);
  const url = new URL(request.url);
  const includeDrafts = url.searchParams.get('includeDrafts') === 'true' || Boolean(session);

  try {
    const posts = await listPosts(session?.token, includeDrafts);
    return new Response(JSON.stringify({ posts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to list posts' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  // Auth sudah divalidasi di middleware (session cookie ATAU API key)
  const session = getSession(cookies);

  try {
    const body = await request.json();
    const { slug, oldSlug, frontmatter, content } = body;

    if (!slug || !frontmatter || !frontmatter.title) {
      return new Response(JSON.stringify({ error: 'Slug dan Judul wajib diisi' }), { status: 400 });
    }

    const cleanTitle = sanitizeHtml(String(frontmatter.title), { allowedTags: [] }).trim();
    const cleanDescription = frontmatter.description
      ? sanitizeHtml(String(frontmatter.description), { allowedTags: [] }).trim()
      : '';

    const sanitizedFrontmatter = {
      ...frontmatter,
      title: cleanTitle,
      description: cleanDescription,
    };

    const result = await savePost({ slug, oldSlug, frontmatter: sanitizedFrontmatter, content: content || '' }, session?.token);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }

    // Otomatis kirim URL baru ke protokol IndexNow (asinkron / non-blocking)
    if (!sanitizedFrontmatter.draft && slug) {
      const siteBase = process.env.PUBLIC_SITE_URL && !process.env.PUBLIC_SITE_URL.includes('localhost')
        ? process.env.PUBLIC_SITE_URL.replace(/\/$/, '')
        : 'https://www.efzyn.my.id';
      const postUrl = `${siteBase}/blog/posts/${slug}`;
      submitToIndexNow(postUrl).catch((err) => {
        console.error('[IndexNow] Gagal otomatis submit blog post URL:', err);
      });
    }

    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal menyimpan postingan' }), { status: 500 });
  }
};
