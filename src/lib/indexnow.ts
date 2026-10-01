/**
 * IndexNow Protocol Utility
 * Menyerahkan URL baru/diperbarui secara otomatis ke mesin pencari (Bing, Yandex, dll)
 * Dokumentasi: https://www.indexnow.org/documentation
 */

export const DEFAULT_INDEXNOW_KEY = '958177e9cac148e3d776e6f8be548d95';
export const DEFAULT_INDEXNOW_HOST = 'www.efzyn.my.id';

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export interface IndexNowResult {
  success: boolean;
  status: number;
  message: string;
  urlList: string[];
}

/**
 * Mendapatkan host aktif untuk pengiriman IndexNow.
 */
export function getIndexNowHost(): string {
  if (process.env.INDEXNOW_HOST) {
    return process.env.INDEXNOW_HOST;
  }
  const siteUrl = process.env.PUBLIC_SITE_URL;
  if (siteUrl && !siteUrl.includes('localhost')) {
    try {
      const parsed = new URL(siteUrl);
      return parsed.host;
    } catch {
      // Fallback ke default
    }
  }
  return DEFAULT_INDEXNOW_HOST;
}

/**
 * Mendapatkan API key IndexNow aktif.
 */
export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY;
}

/**
 * Memformat daftar URL menjadi absolute URL valid untuk IndexNow.
 */
export function formatIndexNowUrls(urls: string | string[], host = getIndexNowHost()): string[] {
  const urlArray = Array.isArray(urls) ? urls : [urls];
  const formatted: string[] = [];

  for (const rawUrl of urlArray) {
    if (!rawUrl || typeof rawUrl !== 'string') continue;
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;

    let fullUrl = trimmed;
    if (trimmed.startsWith('/')) {
      fullUrl = `https://${host}${trimmed}`;
    } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      fullUrl = `https://${host}/${trimmed}`;
    }

    if (!formatted.includes(fullUrl)) {
      formatted.push(fullUrl);
    }
  }

  return formatted;
}

/**
 * Mengirimkan payload URL ke API IndexNow (https://api.indexnow.org/indexnow).
 */
export async function submitToIndexNow(urls: string | string[]): Promise<IndexNowResult> {
  const host = getIndexNowHost();
  const key = getIndexNowKey();
  const keyLocation = `https://${host}/${key}.txt`;
  const urlList = formatIndexNowUrls(urls, host);

  if (urlList.length === 0) {
    return {
      success: false,
      status: 400,
      message: 'Tidak ada URL valid yang disediakan untuk dikirim ke IndexNow.',
      urlList: [],
    };
  }

  const payload: IndexNowPayload = {
    host,
    key,
    keyLocation,
    urlList,
  };

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;

    // IndexNow merespons dengan:
    // 200: OK
    // 202: Accepted (URL diterima dan dijadwalkan untuk dirayapi)
    if (status === 200 || status === 202) {
      console.log(`[IndexNow] Berhasil menyerahkan ${urlList.length} URL (HTTP ${status}):`, urlList);
      return {
        success: true,
        status,
        message: `Berhasil menyerahkan ${urlList.length} URL ke IndexNow (HTTP ${status}).`,
        urlList,
      };
    }

    const responseText = await response.text().catch(() => '');
    console.warn(`[IndexNow] Respons HTTP ${status}: ${responseText}`);

    let errMessage = `IndexNow gagal merespons dengan status sukses (HTTP ${status})`;
    if (status === 400) errMessage = 'Permintaan tidak valid (Invalid syntax / Format JSON)';
    if (status === 403) errMessage = 'Key IndexNow tidak valid atau keyLocation tidak cocok';
    if (status === 422) errMessage = 'URL tidak valid atau host tidak sesuai dengan domain key';
    if (status === 429) errMessage = 'Terlalu banyak permintaan (Rate limited)';

    return {
      success: false,
      status,
      message: `${errMessage}: ${responseText || 'Tidak ada detail error'}`,
      urlList,
    };
  } catch (err: any) {
    console.error('[IndexNow] Gagal menghubungi endpoint IndexNow:', err);
    return {
      success: false,
      status: 500,
      message: `Gagal mengirim ke IndexNow: ${err.message || 'Koneksi jaringan terputus'}`,
      urlList,
    };
  }
}
