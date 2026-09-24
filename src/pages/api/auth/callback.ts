import type { APIRoute } from 'astro';
import { setSession } from '../../../lib/auth';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const savedState = cookies.get('oauth_state')?.value;

  // 1. Hapus cookie oauth_state segera setelah dibaca
  cookies.delete('oauth_state', { path: '/' });

  // 2. Validasi Anti-CSRF State: Jika tidak cocok atau kosong, redirect dengan parameter error
  if (!returnedState || !savedState || returnedState !== savedState) {
    return redirect('/writer?error=csrf_failed');
  }

  if (!code) {
    return redirect('/writer?error=missing_code');
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
      return redirect('/writer?error=invalid_token');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Big3-Writer-App',
      },
    });

    if (!userRes.ok) {
      return redirect('/writer?error=user_fetch_failed');
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
      return redirect(`/writer?error=unauthorized_user&user=${encodeURIComponent(userData.login)}`);
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
    return redirect('/writer?error=server_error');
  }
};
