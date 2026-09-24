# Personal Profile Terminal Monochrome

Website personal portfolio, blog, dan news feed dengan antarmuka terminal monochrome berbasis Astro 6. Dilengkapi dashboard writer untuk manajemen konten, integrasi database Supabase, otentikasi GitHub OAuth, serta API untuk integrasi bot/agent eksternal.

---

## Fitur Utama

- **Antarmuka Terminal Monokrom**: Desain minimalis berbasis tipografi monospaced (*JetBrains Mono* dan *IBM Plex Sans*) dengan dukungan tema Dark, Light, dan System.
- **Arsitektur Hybrid Astro 6**: Render statis (SSG) pada halaman publik untuk performa optimal, serta serverless SSR pada area dashboard writer dan API endpoints.
- **Halaman Blog & News Terpisah**:
  - `/blog`: Artikel opini, tutorial, dan catatan teknis dalam format Markdown.
  - `/news`: Ringkasan kurasi berita teknologi harian dengan tautan ke sumber asli.
- **Writer Dashboard (CMS)**: Antarmuka pengelolaan artikel, berita, unggah gambar/avatar, dan pengaturan profil.
- **Otentikasi GitHub OAuth yang Diperketat**:
  - Menggunakan parameter `state` kriptografis (anti-CSRF) via cookie `HttpOnly` dan `SameSite=Lax`.
  - Menggunakan scope minimal (`read:user user:email`).
  - Whitelist admin berbasis ID numerik atau username GitHub (`ALLOWED_GITHUB_IDS` / `ALLOWED_GITHUB_LOGINS`).
- **Integrasi Database & Storage**:
  - Mendukung Supabase (PostgreSQL & Storage) untuk penyimpanan artikel, berita, pengaturan situs, dan aset media.
  - Fallback otomatis ke filesystem lokal pada mode development offline.
- **API Key untuk Agent / Otomasi**: Endpoint `/api/posts` dan `/api/news` mendukung autentikasi Bearer API Key dengan validasi timing-safe (`crypto.timingSafeEqual`).
- **Hardening Keamanan**:
  - HTTP Security Headers global via `vercel.json` (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).
  - Sanitasi konten dinamis menggunakan `sanitize-html` untuk mencegah Stored XSS.
  - Kompilasi CSS lokal menggunakan Tailwind CSS v4 via PostCSS (tanpa ketergantungan runtime CDN).

---

## Struktur Proyek

```text
personal-profile-terminal-monochrome/
├── public/
│   ├── favicon.svg
│   └── images/
├── src/
│   ├── components/           # Komponen UI bersama
│   ├── content/
│   │   ├── posts/            # Markdown artikel blog lokal
│   │   ├── news.json         # Penyimpanan lokal berita (fallback)
│   │   ├── profile.json      # Data profil situs lokal (fallback)
│   │   └── site-settings.json# Konfigurasi situs & API key lokal
│   ├── layouts/
│   │   └── BaseLayout.astro  # Layout utama dengan tema terminal & theme toggle
│   ├── lib/
│   │   ├── apikey.ts         # Manajemen dan validasi timing-safe API Key
│   │   ├── auth.ts           # Helper session cookie
│   │   ├── cms.ts            # Handler data blog, profil, dan media
│   │   ├── db/               # Inisialisasi Supabase & skema database
│   │   ├── news.ts           # Handler data news feed
│   │   ├── sanitize.ts       # Sanitasi HTML / Markdown untuk proteksi XSS
│   │   └── utils.ts          # Utilitas format tanggal dan read time
│   ├── pages/
│   │   ├── index.astro       # Halaman utama
│   │   ├── blog/             # Index dan detail artikel blog (/blog, /blog/posts/[id])
│   │   ├── news/             # Index dan detail berita (/news, /news/[id])
│   │   ├── portfolio/        # Halaman portofolio (/portfolio)
│   │   ├── project/          # Halaman repositori GitHub (/project)
│   │   ├── sosmed/           # Tautan media sosial (/sosmed)
│   │   ├── writer/           # Login dan dashboard CMS (/writer, /writer/dashboard/*)
│   │   └── api/              # Endpoint auth, posts, news, settings, dan upload
│   ├── styles/
│   │   └── global.css        # Konfigurasi CSS Tailwind v4 & variabel tema
│   └── middleware.ts         # Middleware proteksi route dashboard, API, dan security headers
├── .env.example              # Template variabel lingkungan
├── astro.config.mjs          # Konfigurasi Astro & adapter Vercel
├── postcss.config.mjs        # Konfigurasi PostCSS untuk Tailwind CSS v4
├── tailwind.config.mjs       # Konfigurasi token warna, font, dan plugin Tailwind
├── vercel.json               # Konfigurasi HTTP Security Headers untuk deployment Vercel
└── package.json              # Dependensi proyek
```

---

## Panduan Instalasi Lokal

### 1. Clone Repositori dan Pasang Dependensi

```bash
git clone https://github.com/efzynx/personal-profile-terminal-monochrome.git
cd personal-profile-terminal-monochrome
pnpm install
```

### 2. Konfigurasi Environment Variables

Salin template variabel lingkungan:

```bash
cp .env.example .env
```

Sesuaikan nilai di dalam `.env`:

```env
PORT=4321
PUBLIC_SITE_URL=http://localhost:4321
ALLOWED_HOSTS=localhost,127.0.0.1,.vercel.app

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_ALLOWED_USER=efzynx
ALLOWED_GITHUB_IDS=12345678
ALLOWED_GITHUB_LOGINS=efzyn,efzynx
GITHUB_REPO_OWNER=efzynx
GITHUB_REPO_NAME=personal-profile-terminal-monochrome
SESSION_SECRET=kunci_rahasia_acak_minimal_32_karakter

# GitHub Personal Access Token (opsional untuk sinkronisasi commit)
GITHUB_TOKEN=your_github_personal_access_token

# Supabase (Database & Storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# CMS API Key (opsional, jika ingin dikonfigurasi via env)
CMS_API_KEY=
```

### 3. Jalankan Server Development

```bash
pnpm dev
```

Buka `http://localhost:4321` di browser.

### 4. Build dan Uji Produksi

```bash
pnpm run build
pnpm run preview
```

---

## Skema Database Supabase (Opsional)

Jika menggunakan Supabase, siapkan tabel berikut melalui SQL Editor:

```sql
-- Tabel konfigurasi API Key dan setting situs
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel artikel blog
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  tags JSONB DEFAULT '[]'::jsonb,
  draft BOOLEAN DEFAULT false,
  pub_date TEXT NOT NULL,
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel berita
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  cover_image TEXT,
  draft BOOLEAN DEFAULT false,
  published_at TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Deployment ke Vercel

1. Hubungkan repositori ke dashboard Vercel.
2. Tambahkan seluruh variabel lingkungan dari file `.env` pada menu **Settings → Environment Variables**.
3. Pastikan `ALLOWED_GITHUB_IDS` atau `ALLOWED_GITHUB_LOGINS` diisi sesuai akun admin Anda.
4. Lakukan deployment. Pengaturan header keamanan dari `vercel.json` akan diterapkan secara otomatis.

---

## Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).
