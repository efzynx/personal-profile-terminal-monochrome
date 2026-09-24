import fs from 'fs';
import path from 'path';
import { getSupabaseClient, isSupabaseConfigured } from './db';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  sourceUrl: string;
  sourceName: string;
  tags: string[];
  coverImage?: string;
  draft: boolean;
  publishedAt: string;
}

function isProductionEnv(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

function getLocalNewsPath(): string {
  const p = path.resolve(process.cwd(), 'src/content/news.json');
  if (!fs.existsSync(path.dirname(p))) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }
  return p;
}

function readLocalNews(): NewsItem[] {
  const p = getLocalNewsPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

function writeLocalNews(items: NewsItem[]): void {
  const p = getLocalNewsPath();
  fs.writeFileSync(p, JSON.stringify(items, null, 2), 'utf-8');
}

function generateId(): string {
  const now = new Date();
  const ts = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  return `news-${ts}-${rand}`;
}

export async function listNews(): Promise<NewsItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('news_items')
        .select('*')
        .order('published_at', { ascending: false });
      if (data && !error) {
        return data.map((item: any) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          content: item.content || '',
          sourceUrl: item.source_url || item.sourceUrl,
          sourceName: item.source_name || item.sourceName,
          tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
          coverImage: item.cover_image || item.coverImage || undefined,
          draft: Boolean(item.draft),
          publishedAt: item.published_at || item.publishedAt,
        }));
      }
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  return [];
}

export async function listPublishedNews(): Promise<NewsItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('news_items')
        .select('*')
        .eq('draft', false)
        .order('published_at', { ascending: false });
      if (data && !error) {
        return data.map((item: any) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          content: item.content || '',
          sourceUrl: item.source_url || item.sourceUrl,
          sourceName: item.source_name || item.sourceName,
          tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
          coverImage: item.cover_image || item.coverImage || undefined,
          draft: false,
          publishedAt: item.published_at || item.publishedAt,
        }));
      }
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    return items
      .filter(i => !i.draft)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  return [];
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('news_items').select('*').eq('id', id).maybeSingle();
      if (data && !error) {
        return {
          id: data.id,
          title: data.title,
          summary: data.summary,
          content: data.content || '',
          sourceUrl: data.source_url || data.sourceUrl,
          sourceName: data.source_name || data.sourceName,
          tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []),
          coverImage: data.cover_image || data.coverImage || undefined,
          draft: Boolean(data.draft),
          publishedAt: data.published_at || data.publishedAt,
        };
      }
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    return items.find(i => i.id === id) || null;
  }

  return null;
}

export async function saveNewsItem(item: Omit<NewsItem, 'id'> & { id?: string }): Promise<{ success: boolean; message: string; id?: string }> {
  const id = item.id || generateId();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload = {
        id,
        title: item.title,
        summary: item.summary,
        content: item.content || '',
        source_url: item.sourceUrl,
        source_name: item.sourceName,
        tags: item.tags || [],
        cover_image: item.coverImage || null,
        draft: Boolean(item.draft),
        published_at: item.publishedAt,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('news_items').upsert(payload);
      if (!error) {
        return { success: true, message: 'News berhasil disimpan.', id };
      }
      console.error('Error saving news to Supabase:', error);
      return { success: false, message: `Gagal menyimpan: ${error.message}` };
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    const idx = items.findIndex(i => i.id === id);
    const newsItem: NewsItem = {
      id,
      title: item.title,
      summary: item.summary,
      content: item.content || '',
      sourceUrl: item.sourceUrl,
      sourceName: item.sourceName,
      tags: item.tags || [],
      coverImage: item.coverImage || undefined,
      draft: Boolean(item.draft),
      publishedAt: item.publishedAt,
    };
    if (idx >= 0) {
      items[idx] = newsItem;
    } else {
      items.push(newsItem);
    }
    writeLocalNews(items);
    return { success: true, message: 'News berhasil disimpan.', id };
  }

  return { success: false, message: 'Storage tidak tersedia.' };
}

export async function deleteNewsItem(id: string): Promise<{ success: boolean; message: string }> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('news_items').delete().eq('id', id);
      if (!error) {
        return { success: true, message: 'News berhasil dihapus.' };
      }
      console.error('Error deleting news from Supabase:', error);
      return { success: false, message: `Gagal menghapus: ${error.message}` };
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    const filtered = items.filter(i => i.id !== id);
    writeLocalNews(filtered);
    return { success: true, message: 'News berhasil dihapus.' };
  }

  return { success: false, message: 'Storage tidak tersedia.' };
}
