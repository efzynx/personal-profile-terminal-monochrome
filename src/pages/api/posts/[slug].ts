import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { getPost, deletePost } from '../../../lib/cms';

export const GET: APIRoute = async ({ cookies, params }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { slug } = params;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Slug parameter missing' }), { status: 400 });
  }

  const post = await getPost(slug, session.token);
  if (!post) {
    return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ post }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { slug } = params;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Slug parameter missing' }), { status: 400 });
  }

  const result = await deletePost(slug, session.token);
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, message: result.message }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
