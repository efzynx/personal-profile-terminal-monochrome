import type { APIContext } from 'astro';

export interface SessionData {
  user: string;
  token: string;
  avatarUrl?: string;
  name?: string;
}

const COOKIE_NAME = 'big3_writer_session';

export function getSession(cookies: APIContext['cookies']): SessionData | null {
  const cookie = cookies.get(COOKIE_NAME);
  if (!cookie || !cookie.value) return null;
  try {
    const json = Buffer.from(cookie.value, 'base64').toString('utf8');
    const data = JSON.parse(json);
    if (data && data.user && data.token) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

export function setSession(cookies: APIContext['cookies'], data: SessionData) {
  const value = Buffer.from(JSON.stringify(data)).toString('base64');
  cookies.set(COOKIE_NAME, value, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  });
}

export function clearSession(cookies: APIContext['cookies']) {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
