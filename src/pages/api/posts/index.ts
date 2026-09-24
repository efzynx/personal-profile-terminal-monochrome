import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { listPosts, savePost } from '../../../lib/cms';
import { sanitizeHtml } from '../../../lib/sanitize';

export const GET: APIRoute = async ({ cookies }) => {
  // Auth sudah divalidasi di middleware (session cookie ATAU API key)
  const session = getSession(cookies);

  try {
    const posts = await listPosts(session?.token);
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

    const cleanTitle = sanitizeHtml(String(frontmatter.title), { allowedTags: [], allowedAttributes: {} }).trim();
    const cleanDescription = frontmatter.description
      ? sanitizeHtml(String(frontmatter.description), { allowedTags: [], allowedAttributes: {} }).trim()
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

    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal menyimpan postingan' }), { status: 500 });
  }
};
