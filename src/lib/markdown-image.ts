/**
 * markdown-image.ts
 * Modul pemformat gambar Markdown kustom untuk arsitektur terminal monochrome.
 * Mendukung sintaks: ![Alt Text | align | width | caption="..."](url)
 */

export interface ParsedImageOptions {
  cleanAlt: string;
  align: 'center' | 'left' | 'right';
  width?: string;
  caption?: string;
}

const WIDTH_PRESETS: Record<string, string> = {
  small: '240px',
  medium: '480px',
  large: '720px',
  full: '100%',
};

const ALIGN_CLASS_MAP: Record<'center' | 'left' | 'right', string> = {
  center: 'items-center text-center',
  left: 'items-start text-left',
  right: 'items-end text-right',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHref(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    (lower.startsWith('data:') && !lower.startsWith('data:image/'))
  ) {
    return '';
  }
  return escapeAttr(trimmed);
}

/**
 * Mem-parsing teks alt markdown untuk mengekstrak opsi gambar kustom.
 */
export function parseImageSyntax(text: string, title?: string | null): ParsedImageOptions {
  const rawText = (text || '').trim();
  let align: 'center' | 'left' | 'right' = 'center';
  let width: string | undefined = undefined;
  let caption: string | undefined = undefined;

  let textWithoutCaption = rawText;
  // Ekstrak caption="..." atau caption='...' atau caption=...
  const captionRegex = /(?:^|\|)\s*caption=(?:"([^"]*)"|'([^']*)'|([^|]+?))\s*(?=\||$)/i;
  const captionMatch = rawText.match(captionRegex);
  if (captionMatch) {
    const rawCap = (captionMatch[1] ?? captionMatch[2] ?? captionMatch[3] ?? '').trim();
    if (rawCap) {
      caption = rawCap;
    }
    // Ganti bagian caption dengan pipa agar pemisahan token tetap terjaga
    textWithoutCaption = rawText.replace(captionRegex, '|').trim();
  }

  // Jika caption tidak ditemukan di alt, gunakan parameter title
  if (!caption && title && typeof title === 'string' && title.trim()) {
    caption = title.trim();
  }

  // Jika tidak ada karakter pipa '|', seluruh teks adalah alt text murni
  if (!rawText.includes('|')) {
    return {
      cleanAlt: rawText,
      align,
      width,
      caption,
    };
  }

  // Teks memiliki delimiter pipa '|'
  const rawTokens = textWithoutCaption.split('|').map((t) => t.trim());
  let candidateAlt = rawTokens[0] || '';
  const optionTokens = rawTokens.slice(1);

  // Proses token opsi (tokens setelah pipa pertama)
  for (const token of optionTokens) {
    if (!token) continue;
    const lower = token.toLowerCase().replace(/^(?:align|width)\s*=\s*/i, '');

    // Cek alignment
    if (lower === 'left' || lower === 'right' || lower === 'center') {
      align = lower;
      continue;
    }

    // Cek preset width
    if (WIDTH_PRESETS[lower]) {
      width = WIDTH_PRESETS[lower];
      continue;
    }

    // Cek custom width format: ^\d+(?:px|%|rem)$
    if (/^\d+(?:\.\d+)?(?:px|%|rem)$/i.test(lower)) {
      width = lower;
      continue;
    }

    // Cek caption fallback jika tidak tertangkap regex awal
    if (/^caption\s*=/i.test(token)) {
      const capVal = token.replace(/^caption\s*=\s*/i, '').replace(/^["']|["']$/g, '').trim();
      if (capVal && !caption) {
        caption = capVal;
      }
      continue;
    }
  }

  // Kasus khusus: jika candidateAlt sendiri sebenarnya merupakan token opsi (misal ![center | 480px](url))
  // dan alt text memang kosong atau sengaja hanya menulis opsi
  if (candidateAlt) {
    const candidateLower = candidateAlt.toLowerCase().replace(/^(?:align|width)\s*=\s*/i, '');
    if (
      (candidateLower === 'left' || candidateLower === 'right' || candidateLower === 'center') &&
      align === 'center'
    ) {
      align = candidateLower;
      candidateAlt = '';
    } else if (WIDTH_PRESETS[candidateLower] && !width) {
      width = WIDTH_PRESETS[candidateLower];
      candidateAlt = '';
    } else if (/^\d+(?:\.\d+)?(?:px|%|rem)$/i.test(candidateLower) && !width) {
      width = candidateLower;
      candidateAlt = '';
    }
  }

  return {
    cleanAlt: candidateAlt,
    align,
    width,
    caption,
  };
}

/**
 * Merender markup HTML semantik <figure> untuk gambar markdown dengan dukungan
 * alignment, sizing (preset & custom), border terminal monochrome, dan caption.
 */
export function renderCustomImage(href: string, text: string, title?: string | null): string {
  const { cleanAlt, align, width, caption } = parseImageSyntax(text, title);

  const safeHref = sanitizeHref(href);
  const safeAlt = escapeAttr(cleanAlt);
  const safeCaption = caption ? escapeHtml(caption) : '';

  const containerClass = `my-6 flex flex-col ${ALIGN_CLASS_MAP[align] || ALIGN_CLASS_MAP.center}`;
  const imgClass = 'border border-muted bg-surface max-w-full h-auto';

  // Format style CSS: jika ada width gunakan width spesifik dan max-width 100%,
  // jika tidak ada opsi width, render sebagai responsive image (max-width: 100%; height: auto;)
  const style = width
    ? `width: ${width}; max-width: 100%; height: auto;`
    : 'max-width: 100%; height: auto;';

  const figcaptionHtml = safeCaption
    ? `\n  <figcaption class="text-xs text-muted mt-2 italic font-mono">&gt; ${safeCaption}</figcaption>`
    : '';

  return `<figure class="${containerClass}">\n  <img src="${safeHref}" alt="${safeAlt}" class="${imgClass}" style="${style}" loading="lazy" />${figcaptionHtml}\n</figure>`;
}

export default renderCustomImage;
