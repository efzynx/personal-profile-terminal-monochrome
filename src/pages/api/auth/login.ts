import type { APIRoute } from 'astro';
import { setSession } from '../../../lib/auth';

export const GET: APIRoute = async ({ redirect, cookies, url }) => {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId && process.env.NODE_ENV !== 'production') {
    setSession(cookies, {
      user: process.env.GITHUB_ALLOWED_USER || 'efzyn',
      token: process.env.GITHUB_TOKEN || 'dev-token',
      name: 'Local Developer',
      avatarUrl: 'https://github.com/github.png',
    });
    return redirect('/writer/dashboard');
  }

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_CLIENT_ID belum dikonfigurasi di environment variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redirectUri = `${url.origin}/api/auth/callback`;
  const state = Math.random().toString(36).substring(2);

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'repo user');
  githubAuthUrl.searchParams.set('state', state);

  return redirect(githubAuthUrl.toString());
};
