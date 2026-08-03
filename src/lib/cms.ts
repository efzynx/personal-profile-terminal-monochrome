import fs from 'fs';
import path from 'path';

export interface PostFrontmatter {
  title: string;
  description: string;
  pubDate: string;
  tags: string[];
  category: string;
  draft: boolean;
  coverImage?: string;
  [key: string]: any;
}

export interface PostItem {
  slug: string;
  frontmatter: PostFrontmatter;
  content: string;
}

export interface SavePostInput {
  slug: string;
  oldSlug?: string;
  frontmatter: PostFrontmatter;
  content: string;
}

export interface ProfileSkill {
  name: string;
  level: 'low' | 'medium' | 'high';
}

export interface ProfileData {
  name: string;
  title: string;
  terminalPrompt?: string;
  bio: string;
  portfolioBio: string;
  avatarUrl: string;
  faviconUrl?: string;
  skills: ProfileSkill[];
}

function isProductionEnv(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function getGithubOwner(): string {
  return process.env.GITHUB_REPO_OWNER || 'efzynx';
}

function getGithubRepo(): string {
  return process.env.GITHUB_REPO_NAME || 'personal-profile-terminal-monochrome';
}

function getLocalPostsDir(): string {
  const p = path.resolve(process.cwd(), 'src/content/posts');
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return p;
}

function getLocalImagesDir(): string {
  const p = path.resolve(process.cwd(), 'public/images/posts');
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return p;
}

function getLocalProfilePath(): string {
  return path.resolve(process.cwd(), 'src/content/profile.json');
}

export function parseFrontmatter(rawContent: string): { frontmatter: PostFrontmatter; content: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {
        title: 'Untitled',
        description: '',
        pubDate: new Date().toISOString().split('T')[0],
        tags: [],
        category: 'General',
        draft: true,
      },
      content: rawContent,
    };
  }

  const yamlStr = match[1];
  const content = match[2];

  const frontmatter: any = {
    title: '',
    description: '',
    pubDate: new Date().toISOString().split('T')[0],
    tags: [],
    category: 'General',
    draft: false,
  };

  const lines = yamlStr.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"');
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1).replace(/\\'/g, "'");
    }

    if (key === 'tags') {
      if (val.startsWith('[') && val.endsWith(']')) {
        frontmatter.tags = val
          .slice(1, -1)
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      } else {
        frontmatter.tags = val ? [val] : [];
      }
    } else if (key === 'draft') {
      frontmatter.draft = val === 'true';
    } else if (key === 'pubDate') {
      frontmatter.pubDate = val;
    } else if (key) {
      frontmatter[key] = val;
    }
  }

  return { frontmatter, content };
}

export function stringifyFrontmatter(frontmatter: PostFrontmatter, content: string): string {
  let yaml = '---\n';
  yaml += `title: ${JSON.stringify(frontmatter.title || 'Untitled')}\n`;
  yaml += `description: ${JSON.stringify(frontmatter.description || '')}\n`;
  yaml += `pubDate: ${frontmatter.pubDate || new Date().toISOString().split('T')[0]}\n`;
  yaml += `category: ${JSON.stringify(frontmatter.category || 'General')}\n`;
  
  const tagsArr = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  yaml += `tags: [${tagsArr.map((t) => JSON.stringify(t)).join(', ')}]\n`;
  yaml += `draft: ${Boolean(frontmatter.draft)}\n`;
  
  if (frontmatter.coverImage) {
    yaml += `coverImage: ${JSON.stringify(frontmatter.coverImage)}\n`;
  }
  yaml += '---\n\n' + content.trim() + '\n';
  return yaml;
}

async function githubFetch(urlPath: string, options: RequestInit = {}, token?: string) {
  const authToken = token || process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: authToken ? `Bearer ${authToken}` : '',
    'User-Agent': 'Writer-App',
    ...options.headers,
  };
  const res = await fetch(`https://api.github.com${urlPath}`, { ...options, headers });
  return res;
}

// --- PROFILE MANAGEMENT ---
export async function getProfileData(token?: string): Promise<ProfileData> {
  if (!isProductionEnv()) {
    const localPath = getLocalProfilePath();
    if (fs.existsSync(localPath)) {
      try {
        const raw = await fs.promises.readFile(localPath, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.error('Error reading local profile.json:', e);
      }
    }
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/src/content/profile.json`, {}, token);
  if (res.ok) {
    const fileData = await res.json();
    const raw = Buffer.from(fileData.content, 'base64').toString('utf-8');
    return JSON.parse(raw);
  }

  return {
    name: 'Ahmad Fauzan Adiman',
    title: 'Backend Developer & DevOps Enthusiast',
    terminalPrompt: 'fauzan@archLinux',
    bio: 'Backend Developer & DevOps Enthusiast.\nMahasiswa tingkat akhir Univ. Nurul Jadid.',
    portfolioBio: 'Backend Developer & DevOps Enthusiast.\nMembangun sistem yang robust.',
    avatarUrl: '/saya.avif',
    faviconUrl: '/favicon.svg',
    skills: [],
  };
}

export async function saveProfileData(data: ProfileData, token?: string): Promise<{ success: boolean; message: string }> {
  const jsonStr = JSON.stringify(data, null, 2);

  if (!isProductionEnv()) {
    const localPath = getLocalProfilePath();
    await fs.promises.writeFile(localPath, jsonStr, 'utf-8');
    return { success: true, message: 'Profil berhasil diperbarui secara lokal!' };
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = 'src/content/profile.json';

  let sha: string | undefined;
  const existingRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {}, token);
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    sha = existingData.sha;
  }

  const payload = {
    message: 'feat(profile): update site profile settings',
    content: Buffer.from(jsonStr).toString('base64'),
    sha,
  };

  const putRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  if (!putRes.ok) {
    const err = await putRes.json();
    return { success: false, message: `Gagal memperbarui profil ke GitHub: ${err.message || putRes.statusText}` };
  }

  return { success: true, message: 'Profil berhasil di-commit & di-push ke GitHub!' };
}

export async function saveAvatarImage(filename: string, buffer: Buffer, token?: string): Promise<string> {
  if (!isProductionEnv()) {
    const avatarDir = path.resolve(process.cwd(), 'public/images/avatar');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    const destPath = path.join(avatarDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return `/images/avatar/${filename}`;
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = `public/images/avatar/${filename}`;

  const payload = {
    message: `feat(profile): upload avatar image ${filename}`,
    content: buffer.toString('base64'),
  };

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gagal upload foto profil ke GitHub: ${err.message || res.statusText}`);
  }

  return `/images/avatar/${filename}`;
}

export async function saveFaviconImage(filename: string, buffer: Buffer, token?: string): Promise<{ url?: string; error?: string }> {
  // Validasi Ukuran File (Maksimal 500 KB)
  const MAX_SIZE_BYTES = 500 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    return { error: `Ukuran file terlalu besar (${(buffer.length / 1024).toFixed(1)} KB). Maksimal ukuran favicon adalah 500 KB.` };
  }

  // Validasi Format File
  const ext = path.extname(filename).toLowerCase();
  const ALLOWED_EXTS = ['.svg', '.png', '.ico', '.webp'];
  if (!ALLOWED_EXTS.includes(ext)) {
    return { error: `Format file ${ext} tidak diizinkan. Gunakan format SVG, PNG, ICO, atau WEBP.` };
  }

  if (!isProductionEnv()) {
    const faviconDir = path.resolve(process.cwd(), 'public/images/favicon');
    if (!fs.existsSync(faviconDir)) {
      fs.mkdirSync(faviconDir, { recursive: true });
    }
    const destPath = path.join(faviconDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return { url: `/images/favicon/${filename}` };
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = `public/images/favicon/${filename}`;

  const payload = {
    message: `feat(profile): upload favicon icon ${filename}`,
    content: buffer.toString('base64'),
  };

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  if (!res.ok) {
    const err = await res.json();
    return { error: `Gagal upload favicon ke GitHub: ${err.message || res.statusText}` };
  }

  return { url: `/images/favicon/${filename}` };
}

// --- POSTS MANAGEMENT ---

export async function listPosts(token?: string): Promise<PostItem[]> {
  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    if (fs.existsSync(localDir)) {
      const files = await fs.promises.readdir(localDir);
      const posts: PostItem[] = [];
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.mdx')) {
          const filePath = path.join(localDir, file);
          const raw = await fs.promises.readFile(filePath, 'utf-8');
          const { frontmatter, content } = parseFrontmatter(raw);
          const slug = file.replace(/\.(md|mdx)$/, '');
          posts.push({ slug, frontmatter, content });
        }
      }
      return posts.sort((a, b) => new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime());
    }
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/src/content/posts`, {}, token);
  if (!res.ok) return [];
  const items = await res.json();
  const posts: PostItem[] = [];

  for (const item of items) {
    if (item.name.endsWith('.md') || item.name.endsWith('.mdx')) {
      const fileRes = await githubFetch(`/repos/${owner}/${repo}/contents/${item.path}`, {}, token);
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        const raw = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const { frontmatter, content } = parseFrontmatter(raw);
        const slug = item.name.replace(/\.(md|mdx)$/, '');
        posts.push({ slug, frontmatter, content });
      }
    }
  }

  return posts.sort((a, b) => new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime());
}

export async function getPost(slug: string, token?: string): Promise<PostItem | null> {
  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    const extList = ['.md', '.mdx'];
    for (const ext of extList) {
      const filePath = path.join(localDir, `${slug}${ext}`);
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, 'utf-8');
        const { frontmatter, content } = parseFrontmatter(raw);
        return { slug, frontmatter, content };
      }
    }
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const filePath = `src/content/posts/${slug}.md`;
  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {}, token);
  if (!res.ok) return null;

  const data = await res.json();
  const raw = Buffer.from(data.content, 'base64').toString('utf-8');
  const { frontmatter, content } = parseFrontmatter(raw);
  return { slug, frontmatter, content };
}

export async function savePost(input: SavePostInput, token?: string): Promise<{ success: boolean; message: string }> {
  const { slug, oldSlug, frontmatter, content } = input;
  const rawMarkdown = stringifyFrontmatter(frontmatter, content);

  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    if (oldSlug && oldSlug !== slug) {
      const oldPathMd = path.join(localDir, `${oldSlug}.md`);
      const oldPathMdx = path.join(localDir, `${oldSlug}.mdx`);
      if (fs.existsSync(oldPathMd)) await fs.promises.unlink(oldPathMd);
      if (fs.existsSync(oldPathMdx)) await fs.promises.unlink(oldPathMdx);
    }
    const newPath = path.join(localDir, `${slug}.md`);
    await fs.promises.writeFile(newPath, rawMarkdown, 'utf-8');
    return { success: true, message: 'Postingan berhasil disimpan!' };
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = `src/content/posts/${slug}.md`;

  let sha: string | undefined;
  const existingRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {}, token);
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    sha = existingData.sha;
  }

  const payload = {
    message: `feat(blog): ${sha ? 'update' : 'create'} post ${slug}`,
    content: Buffer.from(rawMarkdown).toString('base64'),
    sha,
  };

  const putRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  if (!putRes.ok) {
    const err = await putRes.json();
    return { success: false, message: `Gagal menyimpan ke GitHub: ${err.message || putRes.statusText}` };
  }

  if (oldSlug && oldSlug !== slug) {
    const oldPath = `src/content/posts/${oldSlug}.md`;
    const oldRes = await githubFetch(`/repos/${owner}/${repo}/contents/${oldPath}`, {}, token);
    if (oldRes.ok) {
      const oldData = await oldRes.json();
      await githubFetch(`/repos/${owner}/${repo}/contents/${oldPath}`, {
        method: 'DELETE',
        body: JSON.stringify({
          message: `refactor(blog): delete old post ${oldSlug}`,
          sha: oldData.sha,
        }),
      }, token);
    }
  }

  return { success: true, message: 'Postingan berhasil di-commit ke GitHub!' };
}

export async function deletePost(slug: string, token?: string): Promise<{ success: boolean; message: string }> {
  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    const filePathMd = path.join(localDir, `${slug}.md`);
    const filePathMdx = path.join(localDir, `${slug}.mdx`);
    let deletedLocal = false;
    if (fs.existsSync(filePathMd)) { await fs.promises.unlink(filePathMd); deletedLocal = true; }
    if (fs.existsSync(filePathMdx)) { await fs.promises.unlink(filePathMdx); deletedLocal = true; }

    if (deletedLocal) {
      return { success: true, message: 'Postingan berhasil dihapus secara lokal.' };
    }
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = `src/content/posts/${slug}.md`;

  const existingRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {}, token);
  if (!existingRes.ok) {
    return { success: false, message: 'Postingan tidak ditemukan di GitHub.' };
  }
  const existingData = await existingRes.json();

  const delRes = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `feat(blog): delete post ${slug}`,
      sha: existingData.sha,
    }),
  }, token);

  if (!delRes.ok) {
    return { success: false, message: 'Gagal menghapus postingan di GitHub.' };
  }

  return { success: true, message: 'Postingan berhasil dihapus dari GitHub!' };
}

export async function saveImageFile(filename: string, buffer: Buffer, token?: string): Promise<string> {
  if (!isProductionEnv()) {
    const localImagesDir = getLocalImagesDir();
    const destPath = path.join(localImagesDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return `/images/posts/${filename}`;
  }

  const owner = getGithubOwner();
  const repo = getGithubRepo();
  const targetPath = `public/images/posts/${filename}`;

  const payload = {
    message: `feat(blog): upload image ${filename}`,
    content: buffer.toString('base64'),
  };

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gagal upload gambar ke GitHub: ${err.message || res.statusText}`);
  }

  return `/images/posts/${filename}`;
}
