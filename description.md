## Deskripsi

Implementasi fitur **API Key** untuk integrasi agent/bot eksternal pada CMS blog sudah selesai di sisi kode. Fitur ini memungkinkan agent otomatis mengakses endpoint `/api/posts` tanpa perlu login GitHub OAuth, cukup menggunakan API Key yang di-generate dari halaman admin.

## Perubahan Kode (Sudah Dilakukan)

### File Baru:
- `src/lib/apikey.ts` — Library manajemen API key (generate, validate, toggle, delete)
- `src/pages/api/settings/apikey.ts` — Endpoint admin untuk kelola API key

### File Diubah:
- `src/lib/db/schema.ts` — Tambah tabel `site_settings`
- `src/middleware.ts` — Endpoint `/api/posts` & `/api/upload` sekarang menerima session cookie **ATAU** API key via header `Authorization: Bearer <key>`
- `src/pages/api/posts/index.ts` — Session jadi optional (auth di middleware)
- `src/pages/api/posts/[slug].ts` — Session jadi optional (auth di middleware)
- `src/pages/writer/dashboard/settings.astro` — UI card "API Key — Integrasi Eksternal" di halaman Site Settings
- `.env.example` — Dokumentasi env `CMS_API_KEY`

## Action Required: Buat Tabel di Supabase

Jalankan SQL berikut di **Supabase Dashboard → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Cara Penggunaan

1. Login ke admin dashboard → **Site Settings** → section **API Key**
2. Klik **[ GENERATE API KEY ]**
3. **Salin key** (hanya ditampilkan sekali!)
4. Agent/bot mengakses API dengan header:
   ```
   Authorization: Bearer cms_xxxxxxxxxx...
   ```
5. Admin bisa **toggle on/off** atau **hapus** key kapanpun dari UI

## Alternatif: Via Environment Variable

Set `CMS_API_KEY=<key>` di `.env` — selalu aktif, tidak bisa diubah dari UI.
