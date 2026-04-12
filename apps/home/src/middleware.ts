import { defineMiddleware } from 'astro:middleware';

/**
 * Proxy request ke upstream URL, strip prefix sebelum forwarding.
 *
 * Blog dan portfolio di-deploy sebagai standalone app di Vercel.
 * Middleware ini men-strip prefix /blog dan /portfolio sebelum
 * proxy ke upstream domain masing-masing.
 *
 * Contoh:
 *   /blog                      → big3-blog.vercel.app/
 *   /blog/posts/hello-world    → big3-blog.vercel.app/posts/hello-world
 *   /portfolio                 → big3-portfolio.vercel.app/
 *   /portfolio/some-page       → big3-portfolio.vercel.app/some-page
 *
 * CATATAN: env var dibaca dari process.env di runtime (bukan import.meta.env
 * yang dikompilasi saat build). Ini penting agar env var dari Vercel dashboard
 * bisa dibaca oleh serverless function.
 */
async function proxyTo(
  upstreamBase: string,
  request: Request,
  strippedPath: string
): Promise<Response> {
  const originalUrl = new URL(request.url);
  const targetUrl = new URL(strippedPath || '/', upstreamBase);
  targetUrl.search = originalUrl.search;

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers: request.headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Proxy /portfolio dan /portfolio/* ke portfolio upstream (strip prefix)
  // Gunakan process.env agar bisa dibaca dari Vercel env vars di runtime
  const portfolioUrl =
    process.env.PORTFOLIO_UPSTREAM_URL ||
    import.meta.env.PORTFOLIO_UPSTREAM_URL ||
    'https://big3-portfolio.vercel.app';

  if (pathname === '/portfolio' || pathname.startsWith('/portfolio/')) {
    const stripped = pathname.slice('/portfolio'.length) || '/';
    try {
      return await proxyTo(portfolioUrl, context.request, stripped);
    } catch {
      // Jika proxy gagal, lanjutkan ke halaman error default
    }
  }

  // Proxy /blog dan /blog/* ke blog upstream (strip prefix)
  const blogUrl =
    process.env.BLOG_UPSTREAM_URL ||
    import.meta.env.BLOG_UPSTREAM_URL ||
    'https://big3-blog.vercel.app';

  if (pathname === '/blog' || pathname.startsWith('/blog/')) {
    const stripped = pathname.slice('/blog'.length) || '/';
    try {
      return await proxyTo(blogUrl, context.request, stripped);
    } catch {
      // Jika proxy gagal, lanjutkan ke halaman error default
    }
  }

  // Semua route home lainnya dilayani normal (prerendered)
  return next();
});
