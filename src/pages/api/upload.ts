import type { APIRoute } from 'astro';
import { getSession } from '../../lib/auth';
import { saveImageFile } from '../../lib/cms';

export const POST: APIRoute = async ({ cookies, request }) => {
  const session = getSession(cookies);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'Tidak ada file yang diunggah' }), { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const filename = `${Date.now()}-${cleanName}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const imageUrl = await saveImageFile(filename, buffer, session.token);

    return new Response(JSON.stringify({ success: true, url: imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Gagal mengunggah gambar' }), { status: 500 });
  }
};
