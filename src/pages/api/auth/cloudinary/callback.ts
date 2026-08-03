import type { APIRoute } from 'astro';
import { getSession } from '../../../../lib/auth';
import { getProfileData, saveProfileData } from '../../../../lib/cms';

export const GET: APIRoute = async ({ redirect, cookies, url }) => {
  const session = getSession(cookies);
  if (!session) {
    return redirect('/writer');
  }

  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');

  if (errorParam || !code) {
    console.error('Cloudinary OAuth Error Callback:', errorParam);
    return redirect('/writer/dashboard/settings?cloudinary=error');
  }

  const clientId = process.env.CLOUDINARY_CLIENT_ID;
  const clientSecret = process.env.CLOUDINARY_CLIENT_SECRET;
  const redirectUri = `${url.origin}/api/auth/cloudinary/callback`;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'Kredensial CLOUDINARY_CLIENT_ID atau CLOUDINARY_CLIENT_SECRET belum dikonfigurasi.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://oauth.cloudinary.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody.toString(),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json();
      console.error('Gagal bertukar token OAuth Cloudinary:', errData);
      return redirect('/writer/dashboard/settings?cloudinary=failed');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';
    const expiresInMs = (tokenData.expires_in || 300) * 1000;
    const expiresAt = Date.now() + expiresInMs;

    // Simpan token OAuth ke profile.json
    const currentProfile = await getProfileData(session.token);
    await saveProfileData(
      {
        ...currentProfile,
        cloudinaryAccessToken: accessToken,
        cloudinaryRefreshToken: refreshToken,
        cloudinaryTokenExpiresAt: expiresAt,
      },
      session.token
    );

    return redirect('/writer/dashboard/settings?cloudinary=connected');
  } catch (err: any) {
    console.error('Error saat menukar token Cloudinary OAuth:', err);
    return redirect('/writer/dashboard/settings?cloudinary=error');
  }
};
