/**
 * sanitize.ts
 * Utilitas sanitasi HTML murni (zero-dependency) untuk mencegah Stored XSS
 * pada konten markdown artikel dan payload API, dirancang optimal dan aman untuk
 * runtime serverless Vercel (Edge & Node.js).
 */

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'a', 'img', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'hr', 'div', 'span', 'strong', 'b', 'em', 'i', 's', 'del', 'sub', 'sup',
  'details', 'summary', 'br', 'wbr', 'figure', 'figcaption', 'section', 'article',
]);

const GLOBAL_ALLOWED_ATTRS = new Set(['class', 'id', 'title']);

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'class', 'id', 'title']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'class', 'id', 'style']),
  figure: new Set(['class', 'id', 'title', 'style']),
  th: new Set(['colspan', 'rowspan', 'align', 'class', 'id']),
  td: new Set(['colspan', 'rowspan', 'align', 'class', 'id']),
};

const ALLOWED_CSS_PROPERTIES = new Set([
  'width',
  'max-width',
  'min-width',
  'height',
  'max-height',
  'min-height',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'display',
  'text-align',
  'float',
  'clear',
  'object-fit',
  'object-position',
]);

/**
 * Membersihkan deklarasi inline CSS style agar hanya memuat properti aman
 * (seperti width, max-width, height, margin, display) dan memblokir keyword berbahaya
 * (javascript:, expression, behavior, url, dsb).
 */
export function sanitizeStyle(rawStyle: string): string {
  if (!rawStyle || typeof rawStyle !== 'string') return '';

  // Hapus komentar CSS
  const cleaned = rawStyle.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = cleaned.split(';');
  const safeDeclarations: string[] = [];

  for (const decl of declarations) {
    const trimmedDecl = decl.trim();
    if (!trimmedDecl) continue;

    const colonIdx = trimmedDecl.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = trimmedDecl.slice(0, colonIdx).trim().toLowerCase();
    const val = trimmedDecl.slice(colonIdx + 1).trim();

    if (!ALLOWED_CSS_PROPERTIES.has(prop)) {
      continue;
    }

    const lowerVal = val.toLowerCase();
    // Blokir keyword berbahaya dan karakter escape yang dapat mem-bypass filter
    if (
      lowerVal.includes('javascript:') ||
      lowerVal.includes('expression') ||
      lowerVal.includes('behavior') ||
      lowerVal.includes('url') ||
      lowerVal.includes('@import') ||
      lowerVal.includes('-moz-binding') ||
      lowerVal.includes('vbscript:') ||
      lowerVal.includes('\\')
    ) {
      continue;
    }

    // Hanya izinkan karakter CSS standar yang aman
    if (!/^[a-zA-Z0-9\s.,%_#()+-]+$/.test(val)) {
      continue;
    }

    safeDeclarations.push(`${prop}: ${val}`);
  }

  return safeDeclarations.join('; ');
}

/**
 * Membersihkan konten HTML hasil render Markdown dari potensi serangan Stored XSS.
 * Menghapus tag berbahaya (<script>, <iframe>, <object>, <embed>, <form>, dll),
 * membersihkan inline event handlers (onload, onerror, dll), serta memvalidasi URI protocol.
 */
export function sanitizeArticleContent(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // 1. Hapus tag berbahaya berserta seluruh isi di dalamnya
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // 2. Hapus sisa tag berbahaya yang tidak berpasangan / self-closing
  cleaned = cleaned.replace(
    /<\/?(?:script|style|iframe|object|embed|applet|form|input|button|textarea|select|base|meta|link)\b[^>]*>/gi,
    ''
  );

  // 3. Filter setiap tag dan atributnya
  let sanitized = cleaned.replace(/<\/?([a-zA-Z0-9]+)(\s+[^>]*?)?(\/?)>/g, (fullMatch, tagName, rawAttrs, selfClose) => {
    const lowerTag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) {
      return '';
    }

    if (fullMatch.startsWith('</')) {
      return `</${lowerTag}>`;
    }

    if (!rawAttrs || !rawAttrs.trim()) {
      return `<${lowerTag}${selfClose ? ' /' : ''}>`;
    }

    const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attrMatch: RegExpExecArray | null;
    const sanitizedAttrs: string[] = [];
    const allowedAttrsForTag = TAG_ALLOWED_ATTRS[lowerTag] || GLOBAL_ALLOWED_ATTRS;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      // Blokir seluruh inline event handler (onclick, onload, onerror, dll)
      if (attrName.startsWith('on')) continue;

      // Blokir atribut yang tidak terdaftar dalam allowlist
      if (!allowedAttrsForTag.has(attrName) && !GLOBAL_ALLOWED_ATTRS.has(attrName)) continue;

      // Penanganan khusus untuk atribut style pada tag figure dan img
      if (attrName === 'style') {
        if (lowerTag !== 'figure' && lowerTag !== 'img') {
          continue;
        }
        const safeStyle = sanitizeStyle(attrVal);
        if (!safeStyle) {
          continue;
        }
        const escapedStyle = safeStyle
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        sanitizedAttrs.push(`style="${escapedStyle}"`);
        continue;
      }

      // Validasi protokol URL pada atribut href dan src
      if (attrName === 'href' || attrName === 'src') {
        const trimmedVal = attrVal.trim().toLowerCase();
        if (
          trimmedVal.startsWith('javascript:') ||
          trimmedVal.startsWith('vbscript:') ||
          (trimmedVal.startsWith('data:') && !trimmedVal.startsWith('data:image/'))
        ) {
          continue;
        }
      }

      // Escape karakter khusus pada nilai atribut
      const safeVal = attrVal
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      sanitizedAttrs.push(`${attrName}="${safeVal}"`);
    }

    // Pastikan rel="noopener noreferrer" terpasang pada anchor tag
    if (lowerTag === 'a') {
      const hasRel = sanitizedAttrs.some((a) => a.startsWith('rel='));
      if (!hasRel) {
        sanitizedAttrs.push('rel="noopener noreferrer"');
      }
    }

    const attrStr = sanitizedAttrs.length > 0 ? ' ' + sanitizedAttrs.join(' ') : '';
    return `<${lowerTag}${attrStr}${selfClose ? ' /' : ''}>`;
  });

  // 4. Bersihkan pembungkus <p> otomatis di sekitar blok <figure> agar markup tetap semantik
  sanitized = sanitized.replace(/<p>\s*((?:<figure\b[\s\S]*?<\/figure>\s*)+)<\/p>/gi, '$1');

  return sanitized;
}

/**
 * Menghapus seluruh tag HTML dari string (menghasilkan plain text).
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Kompatibilitas pengganti sanitizeHtml() bawaan untuk pembersihan teks sederhana.
 */
export function sanitizeHtml(input: string, options?: { allowedTags?: string[] }): string {
  if (!input || typeof input !== 'string') return '';
  if (!options || (options.allowedTags && options.allowedTags.length === 0)) {
    return stripHtml(input);
  }
  return sanitizeArticleContent(input);
}

export default sanitizeHtml;
