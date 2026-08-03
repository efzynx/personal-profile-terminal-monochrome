import type { APIRoute } from 'astro';
import { getSession } from '../../../../lib/auth';

export const GET: APIRoute = async ({ redirect, cookies, url }) => {
  const session = getSession(cookies);
  if (!session) {
    return redirect('/writer');
  }

  const clientId = process.env.CLOUDINARY_CLIENT_ID;

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: 'CLOUDINARY_CLIENT_ID belum dikonfigurasi di environment variables (.env).' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redirectUri = `${url.origin}/api/auth/cloudinary/callback`;
  const state = Math.random().toString(36).substring(2);

  const authUrl = new URL('https://oauth.cloudinary.com/oauth2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'upload asset_management offline_access openid');
  authUrl.searchParams.set('state', state);

  return redirect(authUrl.toString());
};
