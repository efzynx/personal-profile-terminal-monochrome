import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import { validateApiKey } from '../../../lib/apikey';
import { listNews, saveNewsItem } from '../../../lib/news';
import { sanitizeHtml } from '../../../lib/sanitize';

export const GET: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const news = await listNews();
    return new Response(JSON.stringify({ news }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to list news' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, title, summary, content, sourceUrl, sourceName, tags, coverImage, publishedAt, draft } = body;

    const cleanTitle = sanitizeHtml(String(title), { allowedTags: [], allowedAttributes: {} }).trim();
    const cleanSummary = sanitizeHtml(String(summary), { allowedTags: [], allowedAttributes: {} }).trim();
    const cleanSourceName = sanitizeHtml(String(sourceName), { allowedTags: [], allowedAttributes: {} }).trim();

    if (!cleanTitle || !cleanSummary || !content || !sourceUrl || !cleanSourceName) {
      return new Response(
        JSON.stringify({ error: 'title, summary, content, sourceUrl, dan sourceName wajib diisi' }),
        { status: 400 },
      );
    }

    if (cleanSummary.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Summary maksimal 200 karakter' }),
        { status: 400 },
      );
    }

    // Format publishedAt: simpan timestamp ISO penuh untuk membedakan sesi rilis berita
    let finalPublishedAt = publishedAt;
    if (!finalPublishedAt) {
      finalPublishedAt = new Date().toISOString();
    } else if (typeof finalPublishedAt === 'string') {
      const trimmed = finalPublishedAt.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const now = new Date();
        finalPublishedAt = `${trimmed}${now.toISOString().slice(10)}`;
      } else {
        finalPublishedAt = trimmed;
      }
    }

    const result = await saveNewsItem({
      id,
      title: cleanTitle,
      summary: cleanSummary,
      content,
      sourceUrl,
      sourceName: cleanSourceName,
      tags: tags || [],
      coverImage: coverImage || undefined,
      draft: draft !== undefined ? Boolean(draft) : false,
      publishedAt: finalPublishedAt,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: result.message, id: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal menyimpan news' }), { status: 500 });
  }
};
