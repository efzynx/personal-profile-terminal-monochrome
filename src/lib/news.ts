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
  cover_image?: string;
  draft: boolean;
  publishedAt: string;
  createdAt?: string;
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
        .select('id, title, summary, source_url, source_name, tags, cover_image, draft, published_at, created_at')
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (data && !error) {
        return data.map((item: any) => {
          const coverImg = item.cover_image || item.coverImage || undefined;
          return {
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: '',
            sourceUrl: item.source_url || item.sourceUrl,
            sourceName: item.source_name || item.sourceName,
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
            coverImage: coverImg,
            cover_image: coverImg,
            draft: Boolean(item.draft),
            publishedAt: item.published_at || item.publishedAt,
            createdAt: item.created_at || item.createdAt || undefined,
          };
        });
      }
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    return items.map(item => ({ ...item, content: '' })).sort((a, b) => {
      const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      const bCreated = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      const aCreated = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return b.id.localeCompare(a.id);
    });
  }

  return [];
}

export async function listPublishedNews(): Promise<NewsItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('news_items')
        .select('id, title, summary, source_url, source_name, tags, cover_image, published_at, created_at')
        .eq('draft', false)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (data && !error) {
        return data.map((item: any) => {
          const coverImg = item.cover_image || item.coverImage || undefined;
          return {
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: '',
            sourceUrl: item.source_url || item.sourceUrl,
            sourceName: item.source_name || item.sourceName,
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
            coverImage: coverImg,
            cover_image: coverImg,
            draft: false,
            publishedAt: item.published_at || item.publishedAt,
            createdAt: item.created_at || item.createdAt || undefined,
          };
        });
      }
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    return items
      .filter(i => !i.draft)
      .map(item => ({ ...item, content: '' }))
      .sort((a, b) => {
        const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        const bCreated = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        const aCreated = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        if (bCreated !== aCreated) return bCreated - aCreated;
        return b.id.localeCompare(a.id);
      });
  }

  return [];
}

export interface ListNewsOptions {
  page?: number;
  pageSize?: number;
  tag?: string;
  date?: string;
}

export interface PaginatedNewsResult {
  items: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listPublishedNewsPaginated(
  options: ListNewsOptions = {}
): Promise<PaginatedNewsResult> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 15);
  const tag = options.tag && options.tag !== 'all' ? options.tag.trim().toLowerCase() : undefined;
  const date = options.date && options.date !== 'all' ? options.date.trim() : undefined;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      let query = supabase
        .from('news_items')
        .select(
          'id, title, summary, source_url, source_name, tags, cover_image, published_at, created_at',
          { count: 'exact' }
        )
        .eq('draft', false)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (tag) {
        query = query.contains('tags', JSON.stringify([tag]));
      }

      if (date) {
        query = query.gte('published_at', date).lte('published_at', `${date}T23:59:59.999Z`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) {
        console.error('Error fetching paginated news from Supabase:', error);
      }

      const total = count || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const items: NewsItem[] = (data || []).map((item: any) => {
        const coverImg = item.cover_image || item.coverImage || undefined;
        return {
          id: item.id,
          title: item.title,
          summary: item.summary,
          content: '',
          sourceUrl: item.source_url || item.sourceUrl,
          sourceName: item.source_name || item.sourceName,
          tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
          coverImage: coverImg,
          cover_image: coverImg,
          draft: false,
          publishedAt: item.published_at || item.publishedAt,
          createdAt: item.created_at || item.createdAt || undefined,
        };
      });

      return {
        items,
        total,
        page,
        pageSize,
        totalPages,
      };
    }
  }

  // Local JSON fallback
  if (!isProductionEnv()) {
    let items = readLocalNews().filter(i => !i.draft);
    if (tag) {
      items = items.filter(i => (i.tags || []).some(t => t.toLowerCase().trim() === tag));
    }
    if (date) {
      items = items.filter(i => (i.publishedAt || '').startsWith(date));
    }
    items.sort((a, b) => {
      const timeDiff = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      const bCreated = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
      const aCreated = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return b.id.localeCompare(a.id);
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = (page - 1) * pageSize;
    const pagedItems = items.slice(from, from + pageSize).map(item => ({
      ...item,
      content: '',
    }));

    return {
      items: pagedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
  };
}

export interface NewsFilterMetadata {
  dates: { date: string; count: number }[];
  tags: { tag: string; count: number }[];
  total: number;
}

let cachedFilterMetadata: {
  data: NewsFilterMetadata;
  timestamp: number;
} | null = null;

const METADATA_CACHE_TTL_MS = 60 * 1000;

export async function getNewsFilterMetadata(): Promise<NewsFilterMetadata> {
  const now = Date.now();
  if (cachedFilterMetadata && (now - cachedFilterMetadata.timestamp < METADATA_CACHE_TTL_MS)) {
    return cachedFilterMetadata.data;
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('news_items')
        .select('published_at, tags')
        .eq('draft', false);

      if (data && !error) {
        const dateCountMap = new Map<string, number>();
        const tagCountMap = new Map<string, number>();

        data.forEach((item: any) => {
          const rawDate = item.published_at;
          const d = rawDate ? rawDate.slice(0, 10) : '';
          if (d) {
            dateCountMap.set(d, (dateCountMap.get(d) || 0) + 1);
          }

          const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []);
          (tags || []).forEach((t: string) => {
            const lower = t.trim().toLowerCase();
            if (lower) {
              tagCountMap.set(lower, (tagCountMap.get(lower) || 0) + 1);
            }
          });
        });

        const dates = Array.from(dateCountMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => b.date.localeCompare(a.date));

        const tags = Array.from(tagCountMap.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => a.tag.localeCompare(b.tag));

        const result: NewsFilterMetadata = {
          dates,
          tags,
          total: data.length,
        };

        cachedFilterMetadata = {
          data: result,
          timestamp: now,
        };

        return result;
      }
    }
  }

  // Local JSON fallback
  if (!isProductionEnv()) {
    const items = readLocalNews().filter(i => !i.draft);
    const dateCountMap = new Map<string, number>();
    const tagCountMap = new Map<string, number>();

    items.forEach((item) => {
      const d = item.publishedAt ? item.publishedAt.slice(0, 10) : '';
      if (d) {
        dateCountMap.set(d, (dateCountMap.get(d) || 0) + 1);
      }
      (item.tags || []).forEach((t: string) => {
        const lower = t.trim().toLowerCase();
        if (lower) {
          tagCountMap.set(lower, (tagCountMap.get(lower) || 0) + 1);
        }
      });
    });

    const dates = Array.from(dateCountMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const tags = Array.from(tagCountMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));

    return {
      dates,
      tags,
      total: items.length,
    };
  }

  return { dates: [], tags: [], total: 0 };
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('news_items').select('*').eq('id', id).maybeSingle();
      if (data && !error) {
        const coverImg = data.cover_image || data.coverImage || undefined;
        return {
          id: data.id,
          title: data.title,
          summary: data.summary,
          content: data.content || '',
          sourceUrl: data.source_url || data.sourceUrl,
          sourceName: data.source_name || data.sourceName,
          tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || []),
          coverImage: coverImg,
          cover_image: coverImg,
          draft: Boolean(data.draft),
          publishedAt: data.published_at || data.publishedAt,
          createdAt: data.created_at || data.createdAt || undefined,
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
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload: any = {
        id,
        title: item.title,
        summary: item.summary,
        content: item.content || '',
        source_url: item.sourceUrl,
        source_name: item.sourceName,
        tags: item.tags || [],
        cover_image: item.coverImage || item.cover_image || null,
        draft: Boolean(item.draft),
        published_at: item.publishedAt,
        updated_at: nowIso,
      };
      if (item.createdAt) {
        payload.created_at = item.createdAt;
      }
      const { error } = await supabase.from('news_items').upsert(payload);
      if (!error) {
        cachedFilterMetadata = null;
        return { success: true, message: 'News berhasil disimpan.', id };
      }
      console.error('Error saving news to Supabase:', error);
      return { success: false, message: `Gagal menyimpan: ${error.message}` };
    }
  }

  if (!isProductionEnv()) {
    const items = readLocalNews();
    const idx = items.findIndex(i => i.id === id);
    const existing = idx >= 0 ? items[idx] : null;
    const coverVal = item.coverImage || item.cover_image || undefined;
    const newsItem: NewsItem = {
      id,
      title: item.title,
      summary: item.summary,
      content: item.content || '',
      sourceUrl: item.sourceUrl,
      sourceName: item.sourceName,
      tags: item.tags || [],
      coverImage: coverVal,
      cover_image: coverVal,
      draft: Boolean(item.draft),
      publishedAt: item.publishedAt,
      createdAt: item.createdAt || existing?.createdAt || nowIso,
    };
    if (idx >= 0) {
      items[idx] = newsItem;
    } else {
      items.push(newsItem);
    }
    writeLocalNews(items);
    cachedFilterMetadata = null;
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
        cachedFilterMetadata = null;
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
    cachedFilterMetadata = null;
    return { success: true, message: 'News berhasil dihapus.' };
  }

  return { success: false, message: 'Storage tidak tersedia.' };
}
