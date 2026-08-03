import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { listPosts, savePost } from '../../../lib/cms';

export const GET: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const posts = await listPosts(session.token);
    return new Response(JSON.stringify({ posts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to list posts' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, oldSlug, frontmatter, content } = body;

    if (!slug || !frontmatter || !frontmatter.title) {
      return new Response(JSON.stringify({ error: 'Slug dan Judul wajib diisi' }), { status: 400 });
    }

    const result = await savePost({ slug, oldSlug, frontmatter, content: content || '' }, session.token);

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
