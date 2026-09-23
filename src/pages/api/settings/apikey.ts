import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth';
import {
  getApiKeyConfig,
  generateAndSaveApiKey,
  toggleApiKey,
  deleteApiKey,
} from '../../../lib/apikey';

/** GET — ambil status API key (key di-mask untuk keamanan) */
export const GET: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const config = await getApiKeyConfig();
  if (!config) {
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mask key: tampilkan 8 karakter pertama + akhir 4
  const maskedKey =
    config.key.length > 12
      ? config.key.slice(0, 8) + '••••••••' + config.key.slice(-4)
      : '••••••••';

  return new Response(
    JSON.stringify({
      exists: true,
      enabled: config.enabled,
      maskedKey,
      createdAt: config.createdAt,
      isEnvBased: config.createdAt === 'env',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** POST — generate baru, toggle, atau hapus */
export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const action: string = body.action;

  if (action === 'generate') {
    const result = await generateAndSaveApiKey();
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }
    // Kembalikan full key HANYA saat generate (satu-satunya kesempatan melihat key lengkap)
    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        key: result.config!.key,
        createdAt: result.config!.createdAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (action === 'toggle') {
    const enabled = Boolean(body.enabled);
    const result = await toggleApiKey(enabled);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ success: true, message: result.message, enabled }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (action === 'delete') {
    const result = await deleteApiKey();
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Action tidak valid. Gunakan: generate, toggle, delete' }), {
    status: 400,
  });
};
