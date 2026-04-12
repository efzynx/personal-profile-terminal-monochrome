import { defineMiddleware } from 'astro:middleware';

/**
 * Proxy request ke upstream URL, strip prefix dari pathname.
 * Contoh: /portfolio/about → https://big3-portfolio.vercel.app/about
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

  // Proxy /portfolio dan /portfolio/* ke portfolio upstream
  const portfolioUrl = import.meta.env.PORTFOLIO_UPSTREAM_URL;
  if (portfolioUrl && (pathname === '/portfolio' || pathname.startsWith('/portfolio/'))) {
    const stripped = pathname.slice('/portfolio'.length) || '/';
    try {
      return await proxyTo(portfolioUrl, context.request, stripped);
    } catch {
      // Jika proxy gagal, lanjutkan ke halaman error default
    }
  }

  // Proxy /blog dan /blog/* ke blog upstream
  const blogUrl = import.meta.env.BLOG_UPSTREAM_URL;
  if (blogUrl && (pathname === '/blog' || pathname.startsWith('/blog/'))) {
    const stripped = pathname.slice('/blog'.length) || '/';
    try {
      return await proxyTo(blogUrl, context.request, stripped);
    } catch {
      // Jika proxy gagal, lanjutkan ke halaman error default
    }
  }

  // Semua route home lainnya dilayani normal (static prerendered)
  return next();
});
