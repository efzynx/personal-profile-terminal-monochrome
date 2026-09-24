import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { validateApiKey } from '../../../lib/apikey';
import { deleteNewsItem, getNewsItem } from '../../../lib/news';

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
  }

  try {
    const item = await getNewsItem(id);
    if (!item) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400 });
  }

  try {
    const result = await deleteNewsItem(id);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
