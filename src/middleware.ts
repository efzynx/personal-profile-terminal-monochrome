import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  const pathname = url.pathname;

  const isDashboardRoute = pathname.startsWith('/writer/dashboard');
  const isProtectedApi = pathname.startsWith('/api/posts') || pathname.startsWith('/api/upload');

  if (isDashboardRoute || isProtectedApi) {
    const session = getSession(cookies);

    if (!session) {
      if (isProtectedApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Session missing' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return redirect('/writer');
    }
  }

  return next();
});
