import type { APIRoute } from 'astro';
import { getSession } from '../../lib/auth';
import { getProfileData, saveProfileData, saveAvatarImage, saveFaviconImage } from '../../lib/cms';

export const GET: APIRoute = async ({ cookies }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const profile = await getProfileData(session.token);
    return new Response(JSON.stringify({ profile }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal memuat profil' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle Upload Files (Multipart Form Data: Avatar or Favicon)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const avatarFile = formData.get('avatar') as File | null;
      const faviconFile = formData.get('favicon') as File | null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop() || 'png';
        const filename = `avatar-${Date.now()}.${fileExt}`;
        const arrayBuffer = await avatarFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const avatarUrl = await saveAvatarImage(filename, buffer, session.token);

        // Auto-update profile.json with new avatarUrl
        const profile = await getProfileData(session.token);
        profile.avatarUrl = avatarUrl;
        await saveProfileData(profile, session.token);

        return new Response(JSON.stringify({ success: true, avatarUrl }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (faviconFile) {
        const fileExt = faviconFile.name.split('.').pop() || 'svg';
        const filename = `favicon-${Date.now()}.${fileExt}`;
        const arrayBuffer = await faviconFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await saveFaviconImage(filename, buffer, session.token);
        if (result.error) {
          return new Response(JSON.stringify({ error: result.error }), { status: 400 });
        }

        if (result.url) {
          // Auto-update profile.json with new faviconUrl
          const profile = await getProfileData(session.token);
          profile.faviconUrl = result.url;
          await saveProfileData(profile, session.token);
        }

        return new Response(JSON.stringify({ success: true, faviconUrl: result.url }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Tidak ada file yang diunggah' }), { status: 400 });
    }

    // Handle Save Profile Settings (JSON)
    const body = await request.json();
    const { name, title, terminalPrompt, bio, portfolioBio, avatarUrl, faviconUrl, skills } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Nama wajib diisi' }), { status: 400 });
    }

    const currentProfile = await getProfileData(session.token);
    const updatedProfile = {
      ...currentProfile,
      name: name.trim(),
      title: title ? title.trim() : currentProfile.title,
      terminalPrompt: terminalPrompt ? terminalPrompt.trim() : (currentProfile.terminalPrompt || 'user@tux'),
      bio: bio ? bio.trim() : currentProfile.bio,
      portfolioBio: portfolioBio ? portfolioBio.trim() : currentProfile.portfolioBio,
      avatarUrl: avatarUrl || currentProfile.avatarUrl,
      faviconUrl: faviconUrl || currentProfile.faviconUrl || '/favicon.svg',
      skills: Array.isArray(skills) ? skills : currentProfile.skills,
    };


    const result = await saveProfileData(updatedProfile, session.token);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: result.message, profile: updatedProfile }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal menyimpan profil' }), { status: 500 });
  }
};
