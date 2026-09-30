/**
 * Utility functions for date formatting, relative time calculation, and reading time estimation.
 */

export function formatDate(d: Date | string): string {
  if (!d) return '';
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) {
      return typeof d === 'string' ? d.slice(0, 10) : '';
    }
    return dateObj.toISOString().slice(0, 10);
  } catch {
    return typeof d === 'string' ? d.slice(0, 10) : '';
  }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function calculateReadTime(content: string): number {
  const wordCount = content?.split(/\s+/).length ?? 0;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Extracts the first image URL from markdown or HTML content,
 * or returns undefined if none found.
 */
export function extractFirstImage(content?: string): string | undefined {
  if (!content || typeof content !== 'string') return undefined;
  // Markdown: ![alt](url)
  const mdMatch = content.match(/!\[.*?\]\(((?:https?:\/\/|\/)[^\s\)]+)\)/);
  if (mdMatch && mdMatch[1]) return mdMatch[1];
  // HTML: <img ... src="..." ...>
  const htmlMatch = content.match(/<img[^>]+src=["']((?:https?:\/\/|\/)[^"']+)["']/i);
  if (htmlMatch && htmlMatch[1]) return htmlMatch[1];
  return undefined;
}

/**
 * Checks if an image URL is safe and valid to be used as Open Graph image (social preview).
 * Rejects domains known to block social crawlers (e.g. Wikimedia 403), data URLs, and SVGs.
 */
export function isSafeForOgImage(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();

  // Reject data URLs and SVGs (WhatsApp/Facebook do not support SVG for og:image)
  if (clean.startsWith('data:') || clean.endsWith('.svg') || clean.includes('.svg?')) {
    return false;
  }

  // Reject domains known to block social crawlers (HTTP 403 Forbidden to facebookexternalhit/WhatsApp)
  if (
    clean.includes('wikimedia.org') ||
    clean.includes('wikipedia.org') ||
    clean.includes('shields.io') ||
    clean.includes('badge.fury.io') ||
    clean.includes('github.com/badges')
  ) {
    return false;
  }

  return true;
}
