import type { APIRoute } from 'astro';
import { setSession } from '../../../lib/auth';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const savedState = cookies.get('oauth_state')?.value;

  // 1. Hapus cookie oauth_state segera setelah dibaca
  cookies.delete('oauth_state', { path: '/' });

  // 2. Validasi Anti-CSRF State: Jika tidak cocok atau kosong, tolak 403 Forbidden
  if (!returnedState || !savedState || returnedState !== savedState) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Parameter state OAuth tidak cocok atau kedaluwarsa (Anti-CSRF)' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Bad Request: Missing authorization code' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Gagal memperoleh access token dari GitHub' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Big3-Writer-App',
      },
    });

    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Bad Gateway: Gagal mengambil profil user dari GitHub' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const userData = await userRes.json();

    // 3. Validasi Whitelist Admin (ALLOWED_GITHUB_IDS atau ALLOWED_GITHUB_LOGINS)
    const allowedUserIds = (process.env.ALLOWED_GITHUB_IDS || '')
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean);

    const allowedUsernames = (
      process.env.ALLOWED_GITHUB_LOGINS ||
      process.env.GITHUB_ALLOWED_USER ||
      'efzyn'
    )
      .split(',')
      .map((u: string) => u.trim().toLowerCase())
      .filter(Boolean);

    const isAuthorized =
      (allowedUserIds.length > 0 && allowedUserIds.includes(String(userData.id))) ||
      (allowedUsernames.length > 0 && allowedUsernames.includes(String(userData.login).toLowerCase()));

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Akun GitHub Anda tidak terdaftar dalam whitelist admin' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    setSession(cookies, {
      user: userData.login,
      token: accessToken,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
    });

    return redirect('/writer/dashboard');
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
