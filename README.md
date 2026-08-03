# 🖤 Personal Profile Terminal Monochrome

> Website Personal Portfolio, Blog, & CMS Admin dengan desain **Terminal Monochrome Editorial**, performa super cepat berbasis **Astro 6**, serta sistem manajemen konten otomatis terintegrasi ke **GitHub REST API**.

[![License: MIT](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-6-orange?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)

---

## ✨ Fitur Utama

- 🖤 **Estetika Terminal Monochrome**: Tampilan minimalis hitam-putih ala CLI/Terminal dengan font *JetBrains Mono* & *IBM Plex Sans*.
- ⚡ **Super Cepat (Astro 6 SSG + SSR)**: Halaman publik (`/`, `/portfolio`, `/blog`) di-render statis (SSG) agar loading kilat, sementara area Admin (`/writer`) di-render serverless (SSR).
- 🔐 **Autentikasi GitHub OAuth**: Login admin aman menggunakan akun GitHub Anda sendiri tanpa perlu database terpisah.
- 📝 **Writer CMS & Blog Markdown**: Dasbor admin interaktif untuk membuat, mengedit, mengunggah gambar, dan menghapus artikel blog Markdown/MDX.
- ⚙️ **Site Settings & Profile Admin**: Mengatur Nama Lengkap, Bio "Who Am I", Foto Profil, dan Daftar Tech Skill secara langsung via web.
- 🔄 **Dual-Sync Storage Engine**:
  - **Local Dev**: Perubahan artikel & profil langsung tersimpan di komputer lokal.
  - **Production (Vercel)**: Perubahan otomatis di-commit ke repositori GitHub via GitHub REST API, memicu Vercel auto-deploy otomatis.

---

## 📁 Struktur Folder

```text
personal-profile-terminal-monochrome/
├── public/
│   ├── favicon.svg
│   ├── saya.avif
│   └── images/
│       ├── avatar/           # Foto profil pengguna
│       └── posts/            # Gambar unggahan artikel blog
├── src/
│   ├── components/           # Komponen UI bersama
│   ├── content/
│   │   ├── config.ts         # Astro Content Collections
│   │   ├── profile.json      # Data profil situs (nama, bio, avatar, skills)
│   │   └── posts/            # Artikel blog Markdown (.md, .mdx)
│   ├── layouts/
│   │   └── BaseLayout.astro  # Layout utama dengan Terminal Theme & Theme Switcher
│   ├── lib/
│   │   ├── auth.ts           # GitHub OAuth Session Helpers
│   │   └── cms.ts            # Local & GitHub API CRUD Engine
│   ├── pages/
│   │   ├── index.astro       # Homepage (/)
│   │   ├── portfolio/        # Portfolio & Skills (/portfolio)
│   │   ├── blog/             # Blog index & detail (/blog & /blog/posts/[id])
│   │   ├── project/          # Projects & GitHub Repositories (/project)
│   │   ├── sosmed/           # Tautan Sosial Media (/sosmed)
│   │   ├── writer/           # Login & Admin CMS (/writer, /writer/dashboard)
│   │   └── api/              # OAuth Callback, Posts CRUD, Upload & Profile API
│   └── middleware.ts         # Proteksi route Admin & API
├── .env.example              # Template variabel lingkungan
├── astro.config.mjs          # Konfigurasi Astro + Vercel Adapter
└── package.json              # Dependensi proyek
```

---

## 🚀 Panduan Penggunaan (Quick Start)

### 1. Gunakan Template Repositori Ini
Klik tombol **[ Use this template ]** pada bagian atas repositori GitHub ini untuk membuat repositori baru Anda.

### 2. Clone Repositori & Install Dependensi

```bash
git clone https://github.com/USERNAME/NAMA_REPO_ANDA.git
cd NAMA_REPO_ANDA
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi variabel `.env` sesuai kredensial Anda:

```env
PORT=4321

# GitHub OAuth (Buat di https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_ALLOWED_USER=username_github_anda
GITHUB_REPO_OWNER=username_github_anda
GITHUB_REPO_NAME=nama_repo_anda
SESSION_SECRET=kunci_rahasia_acak_min_32_karakter

# GitHub Personal Access Token (Buat di https://github.com/settings/tokens)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Jalankan Server Lokal

```bash
npm run dev
# atau
pnpm dev
```

Buka `http://localhost:4321` di browser Anda!

---

## ☁️ Deployment ke Vercel

1. Push repositori Anda ke GitHub.
2. Impor repositori di **Vercel Dashboard**.
3. Masukkan seluruh Environment Variables dari file `.env` ke **Settings -> Environment Variables** di Vercel Dashboard.
4. Klik **Deploy**!

---

## 📄 Lisensi

Proyek ini menggunakan lisensi [MIT](LICENSE). Bebas digunakan, dimodifikasi, dan didistribusikan untuk kebutuhan pribadi maupun komersial.
