import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ApiKeyConfig {
  enabled: boolean;
  key: string;
  createdAt: string;
}

const SETTINGS_KEY = 'cms_api_key';

function generateApiKey(): string {
  return `cms_${crypto.randomBytes(32).toString('hex')}`;
}

function getLocalSettingsPath(): string {
  return path.resolve(process.cwd(), 'src/content/site-settings.json');
}

function isProductionEnv(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

/**
 * Cek apakah Supabase terkonfigurasi (lazy, baca ulang tiap panggilan).
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
  if (!url || !key) return null;

  try {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(url, key);
  } catch {
    return null;
  }
}

/**
 * Baca settings dari file lokal.
 */
function readLocalSettings(): Record<string, any> {
  const p = getLocalSettingsPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Tulis settings ke file lokal.
 */
function writeLocalSettings(settings: Record<string, any>): void {
  const p = getLocalSettingsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Ambil konfigurasi API key.
 * Prioritas: Supabase → File lokal (dev) → Env CMS_API_KEY
 */
export async function getApiKeyConfig(): Promise<ApiKeyConfig | null> {
  // 1. Coba Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (data && !error) {
      try {
        return JSON.parse(data.value);
      } catch {
        return null;
      }
    }
  }

  // 2. Fallback: file lokal (development)
  if (!isProductionEnv()) {
    const settings = readLocalSettings();
    if (settings[SETTINGS_KEY]) {
      try {
        return typeof settings[SETTINGS_KEY] === 'string'
          ? JSON.parse(settings[SETTINGS_KEY])
          : settings[SETTINGS_KEY];
      } catch {
        return null;
      }
    }
  }

  // 3. Fallback: env variable (selalu enabled jika di-set)
  const envKey = process.env.CMS_API_KEY;
  if (envKey) {
    return { enabled: true, key: envKey, createdAt: 'env' };
  }

  return null;
}

/**
 * Simpan konfigurasi API key.
 * Supabase jika tersedia, otherwise file lokal di dev.
 */
export async function saveApiKeyConfig(config: ApiKeyConfig): Promise<{ success: boolean; message: string }> {
  // 1. Coba Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(config),
        updated_at: new Date().toISOString(),
      });

    if (!error) {
      return { success: true, message: 'Konfigurasi API key berhasil disimpan ke database.' };
    }
    console.error('Supabase save error:', error.message);
    // Jangan return error, fallback ke lokal
  }

  // 2. Fallback: file lokal (development)
  if (!isProductionEnv()) {
    try {
      const settings = readLocalSettings();
      settings[SETTINGS_KEY] = config;
      writeLocalSettings(settings);
      return { success: true, message: 'Konfigurasi API key berhasil disimpan secara lokal.' };
    } catch (err: any) {
      return { success: false, message: `Gagal menyimpan lokal: ${err.message}` };
    }
  }

  return { success: false, message: 'Tidak ada storage yang tersedia (Supabase atau file lokal).' };
}

/**
 * Generate API key baru dan simpan.
 */
export async function generateAndSaveApiKey(): Promise<{ success: boolean; message: string; config?: ApiKeyConfig }> {
  const config: ApiKeyConfig = {
    enabled: true,
    key: generateApiKey(),
    createdAt: new Date().toISOString(),
  };

  const result = await saveApiKeyConfig(config);
  if (result.success) {
    return { ...result, config };
  }
  return result;
}

/**
 * Toggle aktif/nonaktif API key.
 */
export async function toggleApiKey(enabled: boolean): Promise<{ success: boolean; message: string }> {
  const current = await getApiKeyConfig();
  if (!current || current.createdAt === 'env') {
    return { success: false, message: 'Tidak ada API key tersimpan di database untuk di-toggle.' };
  }

  current.enabled = enabled;
  return saveApiKeyConfig(current);
}

/**
 * Hapus API key.
 */
export async function deleteApiKey(): Promise<{ success: boolean; message: string }> {
  // 1. Coba Supabase
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('site_settings')
      .delete()
      .eq('key', SETTINGS_KEY);

    if (!error) {
      return { success: true, message: 'API key berhasil dihapus dari database.' };
    }
    console.error('Supabase delete error:', error.message);
  }

  // 2. Fallback: file lokal
  if (!isProductionEnv()) {
    try {
      const settings = readLocalSettings();
      delete settings[SETTINGS_KEY];
      writeLocalSettings(settings);
      return { success: true, message: 'API key berhasil dihapus secara lokal.' };
    } catch (err: any) {
      return { success: false, message: `Gagal menghapus lokal: ${err.message}` };
    }
  }

  return { success: false, message: 'Tidak ada storage yang tersedia.' };
}

/**
 * Validasi API key dari request header.
 * Return true jika key valid dan enabled.
 */
export async function validateApiKey(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) return false;

  const config = await getApiKeyConfig();
  if (!config || !config.enabled) return false;

  return config.key === token;
}
