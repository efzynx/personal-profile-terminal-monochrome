# big3 — Personal Web Monorepo

> Monorepo untuk tiga website personal dengan desain **monochrome terminal editorial** yang seragam dan performa tinggi.

[![License: MIT](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-6-orange?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-yellow?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CDN-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)

---

## 📁 Struktur Proyek

```
big3/
├── apps/
│   ├── home/        → Homepage & hub navigasi utama (port 4321)
│   ├── portfolio/   → Halaman portfolio & proyek GitHub (port 4322)
│   ├── blog/        → Blog publik berbasis Markdown/MDX (port 4323)
│   └── writer/      → CMS / admin panel untuk mengelola konten (port 4324)
├── packages/
│   ├── ui/          → Komponen & layout bersama (BaseLayout, dll.)
│   ├── theme/       → Design tokens & konfigurasi Tailwind
│   ├── content/     → Skema konten bersama
│   ├── eslint-config/
│   └── tsconfig/
├── .env             → Single source of truth konfigurasi lokal (tidak di-commit)
├── .env.example     → Template variabel yang diperlukan
└── turbo.json       → Turborepo pipeline config
```

---

## ✨ Fitur

- 🖤 **Desain monochrome terminal** — hitam, abu, putih tanpa warna neon
- ⚡ **Astro 6 + Static Site Generation** — performa sangat cepat, JS minimal
- 🗂️ **pnpm workspaces + Turborepo** — manajemen monorepo efisien
- 🖼️ **Optimasi gambar AVIF/WebP** — via komponen `<Picture>` bawaan Astro
- 🔗 **GitHub API integration** — 4 repo terbaru tampil otomatis di Home & Portfolio
- 📝 **Blog berbasis Markdown** — konten terpisah dari kode
- 🔐 **GitHub Token support** — rate limit 5.000 req/jam vs. 60 tanpa token
- 🚀 **Deploy ready** — setiap app adalah Vercel project terpisah

---

## 🚀 Instalasi & Menjalankan Lokal

### Prasyarat

- **Node.js** >= 18
- **pnpm** >= 9 → `npm install -g pnpm`
- **Git**

### 1. Clone Repository

```bash
git clone https://github.com/efzynx/big3.git
cd big3
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Konfigurasi Environment Variables

Salin file contoh dan isi nilainya:

```bash
cp .env.example .env
```

Edit `.env` sesuai kebutuhan lokal:

```env
# Port development server tiap app
APP_HOME_PORT=4321
APP_PORTFOLIO_PORT=4322
APP_BLOG_PORT=4323
APP_WRITER_PORT=4324

# GitHub Personal Access Token (opsional, tapi sangat direkomendasikan)
# Buat di: https://github.com/settings/tokens — scope: public_repo
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Catatan:** File `.env` sudah ada di `.gitignore` dan **tidak akan pernah ter-commit**. Jangan pernah memasukkan token atau secret ke `.env.example`.

### 4. Jalankan Dev Server

#### Semua app sekaligus (dari root):

```bash
pnpm dev
```

Turborepo akan menjalankan semua app secara paralel:

| App | URL |
|-----|-----|
| Home | http://localhost:4321 |
| Portfolio | http://localhost:4322/portfolio |
| Blog | http://localhost:4323/blog |
| Writer | http://localhost:4324/writer |

#### Satu app saja:

```bash
cd apps/home && pnpm dev
cd apps/portfolio && pnpm dev
cd apps/blog && pnpm dev
cd apps/writer && pnpm dev
```

---

## 🏗️ Build Production

```bash
# Build semua app
pnpm build

# Preview output statis
pnpm preview
```

---

## ☁️ Deployment ke Vercel

Setiap app di dalam `apps/` adalah **Vercel project tersendiri** yang di-deploy secara independen.

### Setup

1. Buat 4 Vercel project terpisah (satu per app):
   - `big3-home` → root dir: `apps/home`
   - `big3-portfolio` → root dir: `apps/portfolio`
   - `big3-blog` → root dir: `apps/blog`
   - `big3-writer` → root dir: `apps/writer`

2. Pada masing-masing Vercel project, daftarkan environment variables yang diperlukan (lihat `.env.example`).

3. Pada project **home** (gateway), wajib isi variabel upstream:

   ```
   PORTFOLIO_UPSTREAM_URL=https://big3-portfolio.vercel.app
   BLOG_UPSTREAM_URL=https://big3-blog.vercel.app
   WRITER_UPSTREAM_URL=https://big3-writer.vercel.app
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. Vercel akan otomatis menjalankan `pnpm build` saat setiap push ke branch utama.

### Target Domain

| Path | App |
|------|-----|
| `/` | apps/home |
| `/portfolio` | apps/portfolio |
| `/blog` | apps/blog |
| `/writer` | apps/writer |

---

## 🧩 Panduan Pengembangan

### Menambah Halaman Baru

1. Putuskan halaman tersebut masuk ke `apps/` mana.
2. Buat file `.astro` di `src/pages/`.
3. Gunakan `BaseLayout` dari `@repo/ui/layouts/BaseLayout.astro`.
4. Ikuti pola terminal: breadcrumb `cd ~/path`, tombol back di bawah.

### Menambah Artikel Blog

Buat file Markdown di `apps/blog/src/content/posts/`:

```md
---
title: "Judul Artikel"
description: "Deskripsi singkat"
pubDate: 2024-01-01
tags: ["devops", "linux"]
draft: false
---

Konten artikel di sini...
```

### Komponen Bersama

Tambahkan komponen reusable ke `packages/ui/src/`:

```bash
packages/ui/src/
├── layouts/
│   └── BaseLayout.astro   ← layout utama
└── components/            ← tambahkan komponen baru di sini
```

---

## 🎨 Design System

| Token | Nilai |
|-------|-------|
| Background | `#000000` |
| Surface | `#0A0A0A` |
| Text | `#E0E0E0` |
| Muted | `#444444` |
| Accent | `#888888` |
| Primary | `#FFFFFF` |
| Font Mono | JetBrains Mono |
| Font Sans | IBM Plex Sans |
| Border radius | `0px` (semua kotak) |

**Aturan desain:**
- ✅ Hanya warna dari tabel di atas (grayscale)
- ✅ Tipografi dan spacing sebagai elemen utama
- ❌ Tidak ada neon, glow, atau gradient blob
- ❌ Tidak ada client-side JS selain Tailwind CDN
- ❌ Tidak ada `localStorage` / `sessionStorage`

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License**.

```
MIT License

Copyright (c) 2024 Ahmad Fauzan Adiman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## ❤️ Support the Project

Jika proyek ini bermanfaat atau menginspirasimu, kamu bisa mendukung pengembangannya:

[![Trakteer](https://img.shields.io/badge/Trakteer-Support%20Me-red?style=flat-square&logo=buymeacoffee&logoColor=white)](https://trakteer.id/efzyn/gift)
[![Saweria](https://img.shields.io/badge/Saweria-Donate-yellow?style=flat-square&logo=ko-fi&logoColor=black)](https://saweria.co/efzynx)

---

<p align="center">
  dibuat dengan ☕ oleh <a href="https://github.com/efzynx">efzynx</a>
</p>
