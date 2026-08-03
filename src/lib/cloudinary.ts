import { getProfileData, saveProfileData } from './cms';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Mendapatkan Access Token OAuth Cloudinary yang valid.
 * Jika token sudah kadaluarsa dan ada refresh token, lakukan refresh otomatis.
 */
export async function getValidCloudinaryOAuthToken(sessionToken?: string): Promise<{ accessToken?: string; cloudName: string; error?: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return { cloudName: '', error: 'CLOUDINARY_CLOUD_NAME belum dikonfigurasi di file .env' };
  }

  const profile = await getProfileData(sessionToken);
  let accessToken = profile.cloudinaryAccessToken;
  const refreshToken = profile.cloudinaryRefreshToken;
  const expiresAt = profile.cloudinaryTokenExpiresAt || 0;

  // Jika token belum pernah ditautkan
  if (!accessToken && !refreshToken) {
    return { cloudName, error: 'Akun Cloudinary belum ditautkan via OAuth. Silakan tautkan akun di Admin Settings.' };
  }

  // Cek apakah token hampir kadaluarsa (buffer 30 detik)
  const now = Date.now();
  if (accessToken && expiresAt > now + 30000) {
    return { accessToken, cloudName };
  }

  // Jika ada refresh token, coba lakukan Refresh Token Flow
  if (refreshToken) {
    const clientId = process.env.CLOUDINARY_CLIENT_ID;
    const clientSecret = process.env.CLOUDINARY_CLIENT_SECRET;

    if (clientId && clientSecret) {
      try {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        });

        const res = await fetch('https://oauth.cloudinary.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.access_token;
          const newRefreshToken = data.refresh_token || refreshToken;
          const expiresInMs = (data.expires_in || 300) * 1000;
          const newExpiresAt = Date.now() + expiresInMs;

          // Simpan token baru ke profile
          await saveProfileData(
            {
              ...profile,
              cloudinaryAccessToken: newAccessToken,
              cloudinaryRefreshToken: newRefreshToken,
              cloudinaryTokenExpiresAt: newExpiresAt,
            },
            sessionToken
          );

          return { accessToken: newAccessToken, cloudName };
        }
      } catch (err: any) {
        console.error('Error refreshing Cloudinary OAuth Token:', err);
      }
    }
  }

  // Fallback jika token masih ada
  if (accessToken) {
    return { accessToken, cloudName };
  }

  return { cloudName, error: 'Sesi OAuth Cloudinary telah kadaluarsa. Silakan tautkan ulang di Admin Settings.' };
}

/**
 * Mengunggah file buffer ke Cloudinary menggunakan OAuth Bearer Token.
 */
export async function uploadToCloudinaryViaOAuth(
  buffer: Buffer,
  folder: string = 'media',
  sessionToken?: string
): Promise<{ url?: string; error?: string }> {
  const { accessToken, cloudName, error } = await getValidCloudinaryOAuthToken(sessionToken);

  if (error || !accessToken) {
    return { error: error || 'Gagal mendapatkan akses token Cloudinary OAuth' };
  }

  try {
    const base64Data = `data:image/png;base64,${buffer.toString('base64')}`;
    const formData = new URLSearchParams();
    formData.append('file', base64Data);
    formData.append('folder', folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: `Gagal mengunggah ke Cloudinary: ${data.error?.message || res.statusText}` };
    }

    return { url: data.secure_url };
  } catch (err: any) {
    return { error: `Terjadi kesalahan jaringan saat unggah ke Cloudinary: ${err.message}` };
  }
}
