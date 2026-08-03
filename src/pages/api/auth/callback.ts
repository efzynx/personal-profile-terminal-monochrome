import type { APIRoute } from 'astro';
import { setSession } from '../../../lib/auth';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const allowedUser = process.env.GITHUB_ALLOWED_USER || 'efzyn';

  if (!code) {
    return redirect('/writer?error=missing_code');
  }

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

    if (allowedUser && userData.login.toLowerCase() !== allowedUser.toLowerCase()) {
      return redirect('/writer?error=unauthorized_user');
    }

    setSession(cookies, {
      user: userData.login,
      token: accessToken,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
    });

    return redirect('/writer/dashboard');
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    return redirect('/writer?error=server_error');
  }
};
