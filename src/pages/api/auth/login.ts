import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
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

  // 1. Generate kriptografis random token untuk parameter state (32 bytes hex)
  const state = crypto.randomBytes(32).toString('hex');

  // 2. Simpan token state ke dalam cookie oauth_state dengan HttpOnly, Secure, SameSite=Lax, max-age 10 menit
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 menit
  });

  const redirectUri = `${url.origin}/api/auth/callback`;
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);

  // 3. Kurangi scope OAuth menjadi read:user user:email (least privilege)
  githubAuthUrl.searchParams.set('scope', 'read:user user:email');
  githubAuthUrl.searchParams.set('state', state);

  return redirect(githubAuthUrl.toString());
};
