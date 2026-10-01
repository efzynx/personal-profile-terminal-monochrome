/**
 * Helper cache in-memory untuk GitHub API.
 * Menyediakan in-memory caching dengan TTL 30 menit dan fallback data aman saat rate limit.
 */

export interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  topics: string[];
}

export interface FetchReposResult {
  repos: GitHubRepo[];
  error: boolean;
  isFallback: boolean;
  cached: boolean;
}

interface CacheEntry {
  data: GitHubRepo[];
  timestamp: number;
}

// TTL 30 menit (30 * 60 * 1000 ms)
export const GITHUB_CACHE_TTL_MS = 30 * 60 * 1000;

// Curated fallback data untuk repositori publik efzynx saat GitHub rate limit atau offline
export const FALLBACK_REPOS: GitHubRepo[] = [
  {
    id: 1208592152,
    name: 'personal-profile-terminal-monochrome',
    description: 'Personal profile & blog built with Astro, Tailwind CSS, and terminal monochrome aesthetic.',
    html_url: 'https://github.com/efzynx/personal-profile-terminal-monochrome',
    language: 'Astro',
    stargazers_count: 0,
    updated_at: '2026-10-01T04:23:32Z',
    topics: ['astro', 'portfolio', 'terminal', 'monochrome'],
  },
  {
    id: 1376075554,
    name: 'MUPOST',
    description: 'Multiple-Post with just one click to upload your social media feed',
    html_url: 'https://github.com/efzynx/MUPOST',
    language: 'TypeScript',
    stargazers_count: 0,
    updated_at: '2026-09-30T11:05:58Z',
    topics: ['typescript', 'social-media', 'automation'],
  },
  {
    id: 1037274050,
    name: 'swapi',
    description: 'Swap Manager for linux',
    html_url: 'https://github.com/efzynx/swapi',
    language: 'Python',
    stargazers_count: 2,
    updated_at: '2026-09-21T15:52:29Z',
    topics: ['python', 'linux', 'swap'],
  },
  {
    id: 1346704849,
    name: 'anivora',
    description: 'ANIVORA adalah aplikasi streaming anime dan donghua yang dirancang khusus untuk perangkat Android TV dan Android TV Box.',
    html_url: 'https://github.com/efzynx/anivora',
    language: 'Dart',
    stargazers_count: 0,
    updated_at: '2026-08-27T10:56:04Z',
    topics: ['dart', 'android-tv', 'streaming'],
  },
];

// In-memory cache store
const cache = new Map<string, CacheEntry>();

export function clearGithubCache(): void {
  cache.clear();
}

/**
 * Mengambil repositori publik GitHub user dengan TTL 30 menit.
 * Jika terjadi rate limit (HTTP 403/429) atau fetch gagal:
 * 1. Fallback ke stale cache jika ada.
 * 2. Fallback ke static data aman (FALLBACK_REPOS) agar UI tidak rusak.
 */
export async function getGithubRepos(
  username: string = 'efzynx',
  perPage: number = 4
): Promise<FetchReposResult> {
  const cacheKey = `${username}:${perPage}`;
  const now = Date.now();
  const cachedEntry = cache.get(cacheKey);

  // Kembalikan cache jika masih dalam batas TTL 30 menit
  if (cachedEntry && now - cachedEntry.timestamp < GITHUB_CACHE_TTL_MS) {
    return {
      repos: cachedEntry.data,
      error: false,
      isFallback: false,
      cached: true,
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'personal-profile-terminal-monochrome',
  };
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=${perPage}&type=public`,
      {
        headers,
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const rawData = await res.json();
      if (Array.isArray(rawData)) {
        const repos: GitHubRepo[] = rawData.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description ?? null,
          html_url: item.html_url,
          language: item.language ?? null,
          stargazers_count: typeof item.stargazers_count === 'number' ? item.stargazers_count : 0,
          updated_at: item.updated_at,
          topics: Array.isArray(item.topics) ? item.topics : [],
        }));

        cache.set(cacheKey, { data: repos, timestamp: now });
        return {
          repos,
          error: false,
          isFallback: false,
          cached: false,
        };
      }
    }

    console.warn(
      `[GitHub API] Fetch response status ${res.status} (${res.statusText}) for user '${username}'. Menggunakan fallback.`
    );
  } catch (err: any) {
    console.warn(
      `[GitHub API] Fetch error for user '${username}': ${err?.message || err}. Menggunakan fallback.`
    );
  }

  // Fallback 1: Stale cache
  if (cachedEntry && cachedEntry.data.length > 0) {
    return {
      repos: cachedEntry.data,
      error: false,
      isFallback: true,
      cached: true,
    };
  }

  // Fallback 2: Fallback curated repos khusus efzynx
  if (username.toLowerCase() === 'efzynx') {
    const fallbackSlice = FALLBACK_REPOS.slice(0, perPage);
    // Simpan ke cache sementara agar tidak retry berulang kali saat rate limit
    cache.set(cacheKey, { data: fallbackSlice, timestamp: now });
    return {
      repos: fallbackSlice,
      error: false,
      isFallback: true,
      cached: false,
    };
  }

  return {
    repos: [],
    error: true,
    isFallback: false,
    cached: false,
  };
}
