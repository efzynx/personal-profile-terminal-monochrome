import sanitizeHtml from 'sanitize-html';

/**
 * Membersihkan HTML hasil parsing markdown untuk mencegah potensi Stored XSS,
 * sembari menjaga elemen tata letak terminal theme (heading id, table container, code block, dll).
 */
export function sanitizeArticleContent(rawHtml: string): string {
  if (!rawHtml) return '';

  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
      'hr',
      'span',
      'details',
      'summary',
      'del',
      's',
      'sub',
      'sup',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'id'],
      a: ['href', 'name', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
      h1: ['id', 'class'],
      h2: ['id', 'class'],
      h3: ['id', 'class'],
      h4: ['id', 'class'],
      h5: ['id', 'class'],
      h6: ['id', 'class'],
      code: ['class'],
      pre: ['class'],
      table: ['class'],
      div: ['class'],
      hr: ['class'],
      span: ['class'],
      th: ['class'],
      td: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
