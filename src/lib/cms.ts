import fs from 'fs';
import path from 'path';
import { getSupabaseClient, isSupabaseConfigured } from './db';


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
  cloudinaryAccessToken?: string;
  cloudinaryRefreshToken?: string;
  cloudinaryTokenExpiresAt?: number;
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

function getGithubDataBranch(): string {
  return 'main';
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

/**
 * READ-ONLY GitHub fetch — boleh fallback ke GITHUB_TOKEN dari env.
 * Hanya untuk operasi GET (membaca konten repo).
 */
async function githubReadFetch(urlPath: string, token?: string) {
  const authToken = token || process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: authToken ? `Bearer ${authToken}` : '',
    'User-Agent': 'Writer-App',
  };
  return fetch(`https://api.github.com${urlPath}`, { headers });
}



// --- PROFILE MANAGEMENT ---
export async function getProfileData(token?: string): Promise<ProfileData> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', 'default').maybeSingle();
      if (data && !error) {
        return {
          name: data.name,
          title: data.title,
          terminalPrompt: data.terminal_prompt || data.terminalPrompt || 'fauzan@archLinux',
          bio: data.bio,
          portfolioBio: data.portfolio_bio || data.portfolioBio,
          avatarUrl: data.avatar_url || data.avatarUrl,
          faviconUrl: data.favicon_url || data.faviconUrl,
          skills: typeof data.skills === 'string' ? JSON.parse(data.skills) : (data.skills || []),
        };
      }
    }
  }

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
  const branch = getGithubDataBranch();
  const res = await githubReadFetch(`/repos/${owner}/${repo}/contents/src/content/profile.json?ref=${branch}`, token);
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
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload = {
        id: 'default',
        name: data.name,
        title: data.title,
        terminal_prompt: data.terminalPrompt,
        bio: data.bio,
        portfolio_bio: data.portfolioBio,
        avatar_url: data.avatarUrl,
        favicon_url: data.faviconUrl,
        skills: data.skills || [],
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(payload);
      if (!error) {
        return { success: true, message: 'Profil berhasil disimpan secara instan di Supabase Database!' };
      } else {
        console.error('Error saving profile to Supabase:', error);
        return { success: false, message: `Gagal menyimpan ke Supabase: ${error.message}` };
      }
    }
  }

  const jsonStr = JSON.stringify(data, null, 2);

  if (!isProductionEnv()) {
    const localPath = getLocalProfilePath();
    await fs.promises.writeFile(localPath, jsonStr, 'utf-8');
    return { success: true, message: 'Profil berhasil diperbarui secara lokal!' };
  }

  return { success: true, message: 'Profil diperbarui!' };
}

export async function saveAvatarImage(filename: string, buffer: Buffer, token?: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: bData } = await supabase.storage.getBucket('media');
        if (!bData) {
          await supabase.storage.createBucket('media', { public: true });
        }
        const ext = filename.split('.').pop()?.toLowerCase() || 'png';
        const storagePath = `avatars/${filename}`;
        const { data, error } = await supabase.storage.from('media').upload(storagePath, buffer, {
          contentType: `image/${ext === 'svg' ? 'svg+xml' : ext}`,
          upsert: true,
        });
        if (!error && data) {
          const { data: pubUrlData } = supabase.storage.from('media').getPublicUrl(storagePath);
          if (pubUrlData?.publicUrl) return pubUrlData.publicUrl;
        } else if (error) {
          console.error('Supabase avatar storage error:', error);
        }
      } catch (err) {
        console.error('Error uploading avatar to Supabase Storage:', err);
      }
    }
  }

  if (!isProductionEnv()) {
    const avatarDir = path.resolve(process.cwd(), 'public/images/avatar');
    if (!fs.existsSync(avatarDir)) {
      fs.mkdirSync(avatarDir, { recursive: true });
    }
    const destPath = path.join(avatarDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return `/images/avatar/${filename}`;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${buffer.toString('base64')}`;
}

export async function saveFaviconImage(filename: string, buffer: Buffer, token?: string): Promise<{ url?: string; error?: string }> {
  const MAX_SIZE_BYTES = 500 * 1024;
  if (buffer.length > MAX_SIZE_BYTES) {
    return { error: `Ukuran file terlalu besar (${(buffer.length / 1024).toFixed(1)} KB). Maksimal ukuran favicon adalah 500 KB.` };
  }

  const ext = path.extname(filename).toLowerCase();
  const ALLOWED_EXTS = ['.svg', '.png', '.ico', '.webp'];
  if (!ALLOWED_EXTS.includes(ext)) {
    return { error: `Format file ${ext} tidak diizinkan. Gunakan format SVG, PNG, ICO, atau WEBP.` };
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: bData } = await supabase.storage.getBucket('media');
        if (!bData) {
          await supabase.storage.createBucket('media', { public: true });
        }
        const cleanExt = ext.replace('.', '');
        const storagePath = `favicons/${filename}`;
        const { data, error } = await supabase.storage.from('media').upload(storagePath, buffer, {
          contentType: cleanExt === 'svg' ? 'image/svg+xml' : `image/${cleanExt}`,
          upsert: true,
        });
        if (!error && data) {
          const { data: pubUrlData } = supabase.storage.from('media').getPublicUrl(storagePath);
          if (pubUrlData?.publicUrl) return { url: pubUrlData.publicUrl };
        } else if (error) {
          console.error('Supabase favicon storage error:', error);
        }
      } catch (err) {
        console.error('Error uploading favicon to Supabase Storage:', err);
      }
    }
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

  const cleanExt = ext.replace('.', '');
  return { url: `data:image/${cleanExt === 'svg' ? 'svg+xml' : cleanExt};base64,${buffer.toString('base64')}` };
}


// --- POSTS MANAGEMENT ---

export async function listPosts(token?: string): Promise<PostItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('draft', false)
        .order('pub_date', { ascending: false });
      if (data && !error) {
        return data.map((item: any) => ({
          slug: item.slug,
          frontmatter: {
            title: item.title,
            description: item.description,
            pubDate: item.pub_date || item.pubDate,
            category: item.category || 'General',
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
            draft: Boolean(item.draft),
            coverImage: item.cover_image || item.coverImage,
          },
          content: item.content || '',
        }));
      }
    }
  }

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

  return [];
}

export async function getPost(slug: string, token?: string): Promise<PostItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle();
      if (data && !error) {
        return {
          slug: data.slug,
          frontmatter: {
            title: data.title,
            description: data.description,
            pubDate: data.pub_date || data.pubDate,
            category: data.category || 'General',
            tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []),
            draft: Boolean(data.draft),
            coverImage: data.cover_image || data.coverImage,
          },
          content: data.content || '',
        };
      }
    }
  }

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

  return null;
}

export async function savePost(input: SavePostInput, token?: string): Promise<{ success: boolean; message: string }> {
  const { slug, oldSlug, frontmatter, content } = input;
  const rawMarkdown = stringifyFrontmatter(frontmatter, content);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      if (oldSlug && oldSlug !== slug) {
        await supabase.from('posts').delete().eq('slug', oldSlug);
      }
      const payload = {
        id: slug,
        slug,
        title: frontmatter.title,
        description: frontmatter.description,
        content,
        category: frontmatter.category || 'General',
        tags: frontmatter.tags || [],
        draft: Boolean(frontmatter.draft),
        pub_date: frontmatter.pubDate,
        cover_image: frontmatter.coverImage || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('posts').upsert(payload, { onConflict: 'slug' });
      if (!error) {
        return { success: true, message: 'Postingan berhasil disimpan ke Supabase Database!' };
      } else {
        console.error('Error saving post to Supabase:', error);
        return { success: false, message: `Gagal menyimpan ke Supabase: ${error.message}` };
      }
    }
  }

  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    if (oldSlug && oldSlug !== slug) {
      const oldPathMd = path.join(localDir, `${oldSlug}.md`);
      const oldPathMdx = path.join(localDir, `${oldSlug}.mdx`);
      if (fs.existsSync(oldPathMd)) await fs.promises.unlink(oldPathMd).catch(() => {});
      if (fs.existsSync(oldPathMdx)) await fs.promises.unlink(oldPathMdx).catch(() => {});
    }
    const newPath = path.join(localDir, `${slug}.md`);
    await fs.promises.writeFile(newPath, rawMarkdown, 'utf-8');
    return { success: true, message: 'Postingan berhasil disimpan!' };
  }

  return { success: true, message: 'Postingan disimpan!' };
}

export async function deletePost(slug: string, token?: string): Promise<{ success: boolean; message: string }> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('posts').delete().eq('slug', slug);
      if (!error) {
        return { success: true, message: 'Postingan berhasil dihapus dari Supabase Database!' };
      } else {
        console.error('Error deleting post from Supabase:', error);
        return { success: false, message: `Gagal menghapus dari Supabase: ${error.message}` };
      }
    }
  }

  if (!isProductionEnv()) {
    const localDir = getLocalPostsDir();
    const filePathMd = path.join(localDir, `${slug}.md`);
    const filePathMdx = path.join(localDir, `${slug}.mdx`);
    if (fs.existsSync(filePathMd)) await fs.promises.unlink(filePathMd).catch(() => {});
    if (fs.existsSync(filePathMdx)) await fs.promises.unlink(filePathMdx).catch(() => {});
    return { success: true, message: 'Postingan berhasil dihapus secara lokal.' };
  }

  return { success: true, message: 'Postingan berhasil dihapus!' };
}

export async function saveImageFile(filename: string, buffer: Buffer, token?: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'svg') contentType = 'image/svg+xml';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'gif') contentType = 'image/gif';

        const storagePath = `posts/${filename}`;
        const { data, error } = await supabase.storage.from('media').upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });

        if (!error && data) {
          const { data: pubUrlData } = supabase.storage.from('media').getPublicUrl(storagePath);
          if (pubUrlData?.publicUrl) {
            return pubUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.error('Supabase storage upload error:', err);
      }
    }
  }

  if (!isProductionEnv()) {
    const localImagesDir = getLocalImagesDir();
    const destPath = path.join(localImagesDir, filename);
    await fs.promises.writeFile(destPath, buffer);
    return `/images/posts/${filename}`;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  let mimeType = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
  else if (ext === 'svg') mimeType = 'image/svg+xml';
  else if (ext === 'webp') mimeType = 'image/webp';
  else if (ext === 'gif') mimeType = 'image/gif';

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
