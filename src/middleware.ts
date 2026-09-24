import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';
import { validateApiKey } from './lib/apikey';

/**
 * Cek CSRF: request non-GET/HEAD dari browser harus punya Origin yang sama.
 * Request dengan API key valid di-skip dari cek ini.
 */
function isUnsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function originMatchesSite(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return origin === url.origin;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;
  const pathname = url.pathname;

  const isDashboardRoute = pathname.startsWith('/writer/dashboard');
  const isProtectedApi =
    pathname.startsWith('/api/posts') ||
    pathname.startsWith('/api/news') ||
    pathname.startsWith('/api/upload');
  const isSettingsApi = pathname.startsWith('/api/settings') || pathname.startsWith('/api/profile');
  const isApiRoute = pathname.startsWith('/api/');

  // --- Auth & CSRF untuk Protected API (posts, upload) ---
  if (isProtectedApi) {
    const session = getSession(cookies);
    const authHeader = request.headers.get('Authorization');
    const isValidApiKey = authHeader ? await validateApiKey(authHeader) : false;

    if (!session && !isValidApiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Session atau API key tidak valid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CSRF check: hanya untuk browser session (bukan API key)
    // Request via API key biasanya dari agent/server, tidak ada Origin header
    if (session && !isValidApiKey && isUnsafeMethod(request.method)) {
      if (!originMatchesSite(request, url)) {
        return new Response(JSON.stringify({ error: 'Forbidden: CSRF check failed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return next();
  }

  // --- Settings API: session cookie wajib (admin only) + CSRF ---
  if (isSettingsApi) {
    const session = getSession(cookies);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Session missing' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isUnsafeMethod(request.method) && !originMatchesSite(request, url)) {
      return new Response(JSON.stringify({ error: 'Forbidden: CSRF check failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return next();
  }

  // --- Dashboard routes: session cookie wajib ---
  if (isDashboardRoute) {
    const session = getSession(cookies);
    if (!session) {
      return redirect('/writer');
    }
  }

  // --- Guard untuk API route yang mengubah data: jangan bergantung hanya pada header Origin ---
  if (isApiRoute && isUnsafeMethod(request.method)) {
    const session = getSession(cookies);
    const authHeader = request.headers.get('Authorization');
    const isValidApiKey = authHeader ? await validateApiKey(authHeader) : false;

    if (!session && !isValidApiKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Autentikasi diperlukan' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (session && !isValidApiKey && !originMatchesSite(request, url)) {
      return new Response(JSON.stringify({ error: 'Forbidden: CSRF check failed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const response = await next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  return response;
});
