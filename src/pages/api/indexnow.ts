import type { APIRoute } from 'astro';
import { getSession } from '../../lib/auth';
import { validateApiKey } from '../../lib/apikey';
import { submitToIndexNow, getIndexNowHost, getIndexNowKey } from '../../lib/indexnow';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Session atau API key diperlukan' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const host = getIndexNowHost();
  const key = getIndexNowKey();

  return new Response(
    JSON.stringify({
      status: 'active',
      host,
      keyLocation: `https://${host}/${key}.txt`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  const apiKeyValid = await validateApiKey(request.headers.get('Authorization'));

  if (!session && !apiKeyValid) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Session atau API key diperlukan' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const rawUrls = body.urls || body.urlList || body.url;

    if (!rawUrls) {
      return new Response(
        JSON.stringify({
          error: 'Field "urls", "urlList", atau "url" wajib disertakan.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await submitToIndexNow(rawUrls);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : result.status >= 400 && result.status < 600 ? result.status : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Gagal memproses request IndexNow',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
