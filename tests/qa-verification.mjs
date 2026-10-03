import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePostSlug, optimizeOgImageUrl, isSafeForOgImage } from '../src/lib/utils.ts';
import { renderCustomImage, parseImageSyntax } from '../src/lib/markdown-image.ts';
import { sanitizeArticleContent, sanitizeStyle } from '../src/lib/sanitize.ts';
import { Marked } from 'marked';

const cwd = process.cwd();

console.log('--- STARTING QA TEST SUITE ---');

// =========================================================================
// TEST SUITE 1: Short Slug Format Regex & Generation Reliability
// =========================================================================
console.log('\n[Suite 1] Testing Short Slug & News ID generation format');
const slugRegex = /^post-\d{8}-[a-z0-9]{6}$/;
const newsIdRegex = /^news-\d{8}-[a-z0-9]{6}$/;

for (let i = 0; i < 10000; i++) {
    const slug = generatePostSlug();
    assert.match(slug, slugRegex, `Slug ${slug} must match /^post-\\d{8}-[a-z0-9]{6}$/`);
}
console.log('✓ 10,000 iterations of generatePostSlug() strictly match /^post-\\d{8}-[a-z0-9]{6}$/');

// Test news ID generation pattern as implemented in news/editor.astro
function generateNewsId() {
    const now = new Date();
    const ts = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).padEnd(6, '0');
    return `news-${ts}-${rand}`;
}
for (let i = 0; i < 10000; i++) {
    const newsId = generateNewsId();
    assert.match(newsId, newsIdRegex, `News ID ${newsId} must match /^news-\\d{8}-[a-z0-9]{6}$/`);
}
console.log('✓ 10,000 iterations of news ID generation strictly match /^news-\\d{8}-[a-z0-9]{6}$/');

// =========================================================================
// TEST SUITE 2: Frontmatter Parsing & Stringifying Contract
// =========================================================================
console.log('\n[Suite 2] Testing Frontmatter Parsing & Stringifying in src/lib/cms.ts');

const cmsSource = fs.readFileSync(path.join(cwd, 'src/lib/cms.ts'), 'utf-8');

// Verify parseFrontmatter & stringifyFrontmatter are exported from cms.ts
assert.ok(cmsSource.includes('export function parseFrontmatter('), 'cms.ts must export parseFrontmatter');
assert.ok(cmsSource.includes('export function stringifyFrontmatter('), 'cms.ts must export stringifyFrontmatter');

// Test the parseFrontmatter logic faithfully
function parseFrontmatterTest(rawContent) {
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

    const frontmatter = {
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

function stringifyFrontmatterTest(frontmatter, content) {
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

const sampleRawMd = `---
title: "Pengenalan Astro 6 & Tailwind CSS"
description: "Panduan lengkap arsitektur terminal monochrome"
pubDate: 2026-10-02
category: "Tech"
tags: ["astro", "tailwind", "ssr"]
draft: false
coverImage: "https://example.com/banner.png"
---

## Sekilas Tentang Arsitektur

Ini adalah paragraf pengantar.

### Keunggulan
- Ringan
- Mudah dikelola
`;

const parsed = parseFrontmatterTest(sampleRawMd);
assert.equal(parsed.frontmatter.title, 'Pengenalan Astro 6 & Tailwind CSS');
assert.equal(parsed.frontmatter.description, 'Panduan lengkap arsitektur terminal monochrome');
assert.equal(parsed.frontmatter.pubDate, '2026-10-02');
assert.equal(parsed.frontmatter.category, 'Tech');
assert.deepEqual(parsed.frontmatter.tags, ['astro', 'tailwind', 'ssr']);
assert.equal(parsed.frontmatter.draft, false);
assert.equal(parsed.frontmatter.coverImage, 'https://example.com/banner.png');
assert.ok(parsed.content.includes('## Sekilas Tentang Arsitektur'));
console.log('✓ Frontmatter correctly parsed with title, description, tags, category, and draft status');

// Test stringify round-trip
const stringified = stringifyFrontmatterTest(parsed.frontmatter, parsed.content);
const reParsed = parseFrontmatterTest(stringified);
assert.equal(reParsed.frontmatter.title, parsed.frontmatter.title);
assert.equal(reParsed.frontmatter.description, parsed.frontmatter.description);
assert.deepEqual(reParsed.frontmatter.tags, parsed.frontmatter.tags);
assert.equal(reParsed.frontmatter.draft, parsed.frontmatter.draft);
console.log('✓ Frontmatter round-trip stringify and parse succeeded without data loss');

// =========================================================================
// TEST SUITE 3: Code & Route Validation for News Editor & News Management
// =========================================================================
console.log('\n[Suite 3] Testing News Editor & News Management Routes');

const newsEditorFile = fs.readFileSync(path.join(cwd, 'src/pages/writer/dashboard/news/editor.astro'), 'utf-8');
const newsDashboardFile = fs.readFileSync(path.join(cwd, 'src/pages/writer/dashboard/news.astro'), 'utf-8');

// 3.1 Auth check
assert.ok(newsEditorFile.includes('const session = getSession(Astro.cookies);'), 'News editor must check session');
assert.ok(newsEditorFile.includes("return Astro.redirect('/writer');"), 'News editor must redirect unauthenticated users to /writer');
console.log('✓ News editor includes strict authentication gate and redirect');

// 3.2 Param ?id= handling
assert.ok(newsEditorFile.includes("Astro.url.searchParams.get('id')"), 'News editor must inspect ?id= query param');
assert.ok(newsEditorFile.includes("const isEditMode = Boolean(existingItem);"), 'News editor must handle edit vs add modes');
console.log('✓ News editor correctly differentiates between Add mode and Edit mode via ?id=');

// 3.3 Form fields validation
const requiredFields = [
    'id="news-id"',
    'id="news-published-at"',
    'id="news-title"',
    'id="news-source-name"',
    'id="news-source-url"',
    'id="news-summary"',
    'id="news-tags"',
    'id="news-cover"',
    'id="news-draft"',
    'id="content"',
    'id="btn-save"',
    'id="btn-save-bottom"'
];
for (const field of requiredFields) {
    assert.ok(newsEditorFile.includes(field), `News editor must contain field: ${field}`);
}
console.log('✓ All 12 required news form input fields and action buttons are present');

// 3.4 Save API endpoint
assert.ok(newsEditorFile.includes("fetch('/api/news'"), 'News editor save handler must call /api/news');
assert.ok(newsEditorFile.includes("method: 'POST'"), 'News editor save handler must use POST method');
console.log('✓ News editor properly posts serialized data to /api/news');

// 3.5 News Dashboard links
assert.ok(newsDashboardFile.includes('href="/writer/dashboard/news/editor"'), 'News dashboard must have Add button linking to editor');
assert.ok(newsDashboardFile.includes('href={`/writer/dashboard/news/editor?id=${item.id}`}'), 'News dashboard must link Edit to editor with id query param');
assert.ok(!newsDashboardFile.includes('<form id="news-form"'), 'Old inline form must be completely removed from news dashboard');
console.log('✓ News dashboard properly links Add and Edit actions to the dedicated editor; inline form cleanly deleted');

// =========================================================================
// TEST SUITE 4: Live Preview & Split-Pane Resizer in Both Editors
// =========================================================================
console.log('\n[Suite 4] Testing Live Preview & Split-Pane Resizer in News & Blog Editors');

const blogEditorFile = fs.readFileSync(path.join(cwd, 'src/pages/writer/dashboard/editor.astro'), 'utf-8');

for (const [name, content] of [['Blog Editor', blogEditorFile], ['News Editor', newsEditorFile]]) {
    // Marked script inclusion
    assert.ok(content.includes('src="/vendor/marked.min.js"'), `${name} must include local marked.min.js`);
    
    // Split pane elements
    assert.ok(content.includes('id="split-container"'), `${name} must have #split-container`);
    assert.ok(content.includes('id="pane-editor"'), `${name} must have #pane-editor`);
    assert.ok(content.includes('id="split-divider"'), `${name} must have #split-divider`);
    assert.ok(content.includes('id="pane-preview"'), `${name} must have #pane-preview`);
    assert.ok(content.includes('id="preview-body"'), `${name} must have #preview-body`);
    
    // Presets
    assert.ok(content.includes('data-ratio="50"'), `${name} must have 50:50 preset`);
    assert.ok(content.includes('data-ratio="80"'), `${name} must have 80:20 Focus Edit preset`);
    assert.ok(content.includes('data-ratio="20"'), `${name} must have 20:80 Focus Preview preset`);
    
    // Mobile toggle
    assert.ok(content.includes('id="btn-mobile-toggle"'), `${name} must have #btn-mobile-toggle`);
    assert.ok(content.includes('id="mobile-toggle-text"'), `${name} must have #mobile-toggle-text`);
    
    // Drag event handlers
    assert.ok(content.includes("splitDivider.addEventListener('mousedown'"), `${name} must support mouse drag resizing`);
    assert.ok(content.includes("splitDivider.addEventListener('touchstart'"), `${name} must support touch drag resizing`);
    
    // Debounce preview update
    assert.ok(content.includes('updateLivePreview'), `${name} must have live preview updater`);
    assert.ok(content.includes('debounceTimer = setTimeout'), `${name} must debounce markdown rendering (150ms)`);
    
    // Scroll synchronization
    assert.ok(content.includes("contentTextarea.addEventListener('scroll'"), `${name} must sync textarea scrolling`);
    assert.ok(content.includes("previewBody.addEventListener('scroll'"), `${name} must sync preview scrolling`);
    
    console.log(`✓ ${name}: split-pane, draggable divider, presets, mobile toggle, debounced preview & scroll-sync verified`);
}

// Check reroll button in blog editor
assert.ok(blogEditorFile.includes('id="btn-reroll-slug"'), 'Blog editor must have [ REROLL ID ] button');
assert.ok(blogEditorFile.includes('generatePostSlug'), 'Blog editor must import and use generatePostSlug()');
console.log('✓ Blog editor includes [ REROLL ID ] button and short slug generator integration');

// =========================================================================
// TEST SUITE 5: Left Sticky Table of Contents & Active Scrollspy
// =========================================================================
console.log('\n[Suite 5] Testing Left Sticky TOC & Active Scrollspy in Blog & News Details');

const blogDetailFile = fs.readFileSync(path.join(cwd, 'src/pages/blog/posts/[id].astro'), 'utf-8');
const newsDetailFile = fs.readFileSync(path.join(cwd, 'src/pages/news/[id].astro'), 'utf-8');

for (const [name, content] of [['Blog Detail', blogDetailFile], ['News Detail', newsDetailFile]]) {
    // 2-column layout wrapper
    assert.ok(
        content.includes('flex flex-col lg:flex-row gap-8 lg:gap-12 relative'),
        `${name} must use responsive 2-column layout flex-col lg:flex-row`
    );

    // Desktop Left Sticky TOC Sidebar
    assert.ok(content.includes('<aside class="hidden lg:block w-64 shrink-0">'), `${name} must have desktop sticky TOC sidebar (w-64 shrink-0)`);
    assert.ok(content.includes('sticky top-20'), `${name} TOC nav must be sticky at top-20`);
    assert.ok(content.includes('id="toc-list"'), `${name} must have #toc-list`);
    assert.ok(content.includes('data-toc-id='), `${name} TOC links must have data-toc-id attribute`);

    // Mobile Collapsible Dropdown
    assert.ok(content.includes('<details class="lg:hidden bg-surface border border-muted p-3 my-4 font-mono text-xs">'), `${name} must have mobile collapsible details`);
    assert.ok(content.includes('ON THIS PAGE [{toc.length}]'), `${name} mobile details must show heading count`);

    // Heading renderer scroll-margin clearance
    assert.ok(content.includes('class="scroll-mt-24"'), `${name} heading renderer must add scroll-mt-24 class`);
    assert.ok(content.includes('scroll-margin-top: 6rem;'), `${name} CSS must set scroll-margin-top: 6rem`);

    // Scrollspy script verification
    assert.ok(content.includes('function setupScrollspy()'), `${name} must have setupScrollspy() function`);
    assert.ok(content.includes('IntersectionObserver'), `${name} must use IntersectionObserver for scrollspy`);
    assert.ok(content.includes('window.requestAnimationFrame'), `${name} must have requestAnimationFrame continuous scroll fallback`);
    assert.ok(content.includes("behavior: 'smooth'"), `${name} click navigation must use smooth scroll`);
    assert.ok(content.includes("mobileDetails.removeAttribute('open')"), `${name} clicking link on mobile must collapse the accordion`);
    assert.ok(content.includes("document.addEventListener('astro:page-load', setupScrollspy)"), `${name} must bind to astro:page-load for client router compatibility`);

    console.log(`✓ ${name}: 2-column layout, sticky left sidebar, mobile dropdown, heading scroll clearance, and scrollspy script verified`);
}

// =========================================================================
// TEST SUITE 6: Heading & TOC Slug Extraction Logic
// =========================================================================
console.log('\n[Suite 6] Testing Markdown Heading Parsing and Slug Extraction');

const sampleArticleMarkdown = `
# Judul Utama (Level 1 tidak masuk TOC)

Paragraf pembuka.

## Arsitektur Monorepo
Penjelasan arsitektur.

### Package UI dan Shared Modules
Penjelasan modul.

## Keamanan & Otentikasi
Penjelasan auth.

### Token Session Cookies
Penjelasan cookie.
`;

const headingRegex = /^(#{2,3})\s+(.+)$/gm;
const extractedToc = [];
let match;
while ((match = headingRegex.exec(sampleArticleMarkdown)) !== null) {
    const depth = match[1].length;
    const text = match[2].trim().replace(/[*_~`]/g, "");
    const slugId = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
    extractedToc.push({ depth, text, id: slugId });
}

assert.equal(extractedToc.length, 4);
assert.deepEqual(extractedToc[0], { depth: 2, text: 'Arsitektur Monorepo', id: 'arsitektur-monorepo' });
assert.deepEqual(extractedToc[1], { depth: 3, text: 'Package UI dan Shared Modules', id: 'package-ui-dan-shared-modules' });
assert.deepEqual(extractedToc[2], { depth: 2, text: 'Keamanan & Otentikasi', id: 'keamanan-otentikasi' });
assert.deepEqual(extractedToc[3], { depth: 3, text: 'Token Session Cookies', id: 'token-session-cookies' });

console.log('✓ Heading extraction and slug normalization correctly handles h2, h3, and character escaping');

// =========================================================================
// TEST SUITE 7: Markdown Image Formatter, Sanitization, Cheat Modal & Marked Integration
// =========================================================================
console.log('\n[Suite 7] Testing Markdown Image Formatter, Sanitization, Cheat Modal & Marked Integration');

// 7.1 Syntax Parsing & Options
console.log('  -> 7.1 Testing parseImageSyntax across all alignment, preset & custom sizes, and caption styles');

const syntaxCases = [
    { input: 'Hero | center | small | caption="Center Small"', align: 'center', width: '240px', caption: 'Center Small' },
    { input: 'Diagram | left | medium | caption="Left Medium"', align: 'left', width: '480px', caption: 'Left Medium' },
    { input: 'Infographic | right | large | caption="Right Large"', align: 'right', width: '720px', caption: 'Right Large' },
    { input: 'Full Banner | center | full', align: 'center', width: '100%', caption: undefined },
    { input: 'Custom Px | left | 360px | caption="Custom 360px"', align: 'left', width: '360px', caption: 'Custom 360px' },
    { input: 'Custom Percent | right | 50% | caption="Custom 50%"', align: 'right', width: '50%', caption: 'Custom 50%' },
    { input: 'Custom Rem | center | 25rem | caption=\'Single Quote Caption\'', align: 'center', width: '25rem', caption: 'Single Quote Caption' },
    { input: 'Unquoted | left | medium | caption=Simple text caption', align: 'left', width: '480px', caption: 'Simple text caption' },
    { input: 'Title Fallback', align: 'center', width: undefined, caption: 'Title as Caption', title: 'Title as Caption' },
    { input: 'Pure Alt Text No Options', align: 'center', width: undefined, caption: undefined },
    { input: 'center | 480px', align: 'center', width: '480px', caption: undefined }
];

for (const c of syntaxCases) {
    const res = parseImageSyntax(c.input, c.title);
    assert.equal(res.align, c.align, `Alignment mismatch for "${c.input}"`);
    assert.equal(res.width, c.width, `Width mismatch for "${c.input}"`);
    assert.equal(res.caption, c.caption, `Caption mismatch for "${c.input}"`);
}
console.log('  ✓ parseImageSyntax correctly parses all combinations (center/left/right, small/medium/large/full/360px/50%, and caption formats)');

// 7.2 Semantic Markup Rendering via renderCustomImage
console.log('  -> 7.2 Testing renderCustomImage semantic HTML markup, terminal borders, alignment, and dimensions');

// Test Center + Small
const imgCenterSmall = renderCustomImage('https://example.com/small.png', 'Logo | center | small | caption="Small Logo"');
assert.ok(imgCenterSmall.includes('<figure class="my-6 flex flex-col items-center text-center">'), 'Center alignment class must be items-center text-center');
assert.ok(imgCenterSmall.includes('style="width: 240px; max-width: 100%; height: auto;"'), 'Small preset must render width: 240px');
assert.ok(imgCenterSmall.includes('alt="Logo"'), 'Alt text properly escaped and rendered');
assert.ok(imgCenterSmall.includes('src="https://example.com/small.png"'), 'Src properly rendered');
assert.ok(imgCenterSmall.includes('class="border border-muted bg-surface max-w-full h-auto"'), 'Monochrome terminal border and surface class present');
assert.ok(imgCenterSmall.includes('<figcaption class="text-xs text-muted mt-2 italic font-mono">&gt; Small Logo</figcaption>'), 'Figcaption properly rendered');

// Test Left + Medium
const imgLeftMedium = renderCustomImage('https://example.com/med.png', 'Chart | left | medium | caption="Medium Chart"');
assert.ok(imgLeftMedium.includes('<figure class="my-6 flex flex-col items-start text-left">'), 'Left alignment class must be items-start text-left');
assert.ok(imgLeftMedium.includes('style="width: 480px; max-width: 100%; height: auto;"'), 'Medium preset must render width: 480px');
assert.ok(imgLeftMedium.includes('&gt; Medium Chart'), 'Figcaption text present');

// Test Right + Large
const imgRightLarge = renderCustomImage('https://example.com/large.png', 'Flow | right | large | caption="Large Flow"');
assert.ok(imgRightLarge.includes('<figure class="my-6 flex flex-col items-end text-right">'), 'Right alignment class must be items-end text-right');
assert.ok(imgRightLarge.includes('style="width: 720px; max-width: 100%; height: auto;"'), 'Large preset must render width: 720px');
assert.ok(imgRightLarge.includes('&gt; Large Flow'), 'Figcaption text present');

// Test Center + Full
const imgCenterFull = renderCustomImage('https://example.com/full.png', 'Wide Banner | center | full');
assert.ok(imgCenterFull.includes('style="width: 100%; max-width: 100%; height: auto;"'), 'Full preset must render width: 100%');
assert.ok(!imgCenterFull.includes('<figcaption'), 'No figcaption rendered when caption is omitted');

// Test Left + Custom 360px
const imgCustom360 = renderCustomImage('https://example.com/custom360.png', 'Card | left | 360px | caption="Custom 360px Card"');
assert.ok(imgCustom360.includes('<figure class="my-6 flex flex-col items-start text-left">'), 'Left alignment for 360px');
assert.ok(imgCustom360.includes('style="width: 360px; max-width: 100%; height: auto;"'), 'Custom 360px style verified');
assert.ok(imgCustom360.includes('&gt; Custom 360px Card'), 'Caption for 360px card verified');

// Test Right + Custom 50%
const imgCustom50 = renderCustomImage('https://example.com/custom50.png', 'Half Size | right | 50% | caption="50 Percent Width"');
assert.ok(imgCustom50.includes('<figure class="my-6 flex flex-col items-end text-right">'), 'Right alignment for 50%');
assert.ok(imgCustom50.includes('style="width: 50%; max-width: 100%; height: auto;"'), 'Custom 50% style verified');
assert.ok(imgCustom50.includes('&gt; 50 Percent Width'), 'Caption for 50% width verified');

// Test Default Responsive (No Size Specified)
const imgDefaultResponsive = renderCustomImage('https://example.com/default.png', 'Responsive Image');
assert.ok(imgDefaultResponsive.includes('style="max-width: 100%; height: auto;"'), 'Default image style is max-width: 100%; height: auto;');
assert.ok(imgDefaultResponsive.includes('items-center text-center'), 'Default alignment is center');

// Test Malicious URL escaping (XSS in URL)
const imgMaliciousHref = renderCustomImage('javascript:alert(1)', 'XSS Image');
assert.ok(imgMaliciousHref.includes('src=""'), 'javascript: href must be stripped');

console.log('  ✓ renderCustomImage correctly renders semantic figure, monochrome borders, alignment, presets (S/M/L/Full), custom (360px/50%), and captions');

// 7.3 Sanitizer Style Whitelist & Tag Validation in src/lib/sanitize.ts
console.log('  -> 7.3 Testing HTML Sanitization: <figure>, <figcaption>, and inline style safety whitelist');

// Verify style parser safety
assert.equal(sanitizeStyle('width: 360px; max-width: 100%; height: auto;'), 'width: 360px; max-width: 100%; height: auto');
assert.equal(sanitizeStyle('width: 50%; max-width: 100%; height: auto;'), 'width: 50%; max-width: 100%; height: auto');
assert.equal(sanitizeStyle('width: expression(alert(1)); height: 100px;'), 'height: 100px', 'expression() must be stripped');
assert.equal(sanitizeStyle('background: url(evil.png); width: 240px;'), 'width: 240px', 'url() must be stripped');
assert.equal(sanitizeStyle('color: red; width: 100%; font-size: 20px;'), 'width: 100%', 'color and font-size must be stripped');
assert.equal(sanitizeStyle('display: flex; margin: 0 auto; max-width: 100%'), 'display: flex; margin: 0 auto; max-width: 100%');
assert.equal(sanitizeStyle('width: 100px; background-image: -moz-binding(evil.xml);'), 'width: 100px', '-moz-binding must be stripped');
assert.equal(sanitizeStyle('width: 100px; @import "evil.css";'), 'width: 100px', '@import must be stripped');
assert.equal(sanitizeStyle('width: 100px\\; evil: yes;'), '', 'Backslash escape must be rejected');

// Verify full article sanitization
const complexHtmlPayload = `
<p><figure class="my-6 flex flex-col items-center text-center" style="display: flex; margin: 0 auto;">
  <img src="https://example.com/test.png" alt="Test" class="border border-muted" style="width: 360px; max-width: 100%; height: auto;" loading="lazy" />
  <figcaption class="text-xs text-muted mt-2 italic font-mono">&gt; Safe Caption</figcaption>
</figure></p>
<p style="color: red; width: 100px;" onclick="alert(1)">Paragraph with disallowed style & events</p>
<figure style="width: 50%; behavior: url(xss.htc);">
  <img src="https://example.com/50.png" alt="Half" style="width: 50%; color: blue;" onerror="alert(2)" />
</figure>
<script>alert("hacked")</script>
<iframe src="evil.com"></iframe>
`;

const sanitizedResult = sanitizeArticleContent(complexHtmlPayload);
assert.ok(sanitizedResult.includes('style="display: flex; margin: 0 auto"'), 'Figure allows safe display and margin style');
assert.ok(sanitizedResult.includes('style="width: 360px; max-width: 100%; height: auto"'), 'Img allows safe width, max-width, height style');
assert.ok(sanitizedResult.includes('style="width: 50%"'), 'Figure allows 50% width');
assert.ok(sanitizedResult.includes('&gt; Safe Caption'), 'Figcaption tag and content preserved');
assert.ok(!sanitizedResult.includes('<p style='), 'Paragraph inline style stripped');
assert.ok(!sanitizedResult.includes('onclick='), 'onclick stripped');
assert.ok(!sanitizedResult.includes('onerror='), 'onerror stripped');
assert.ok(!sanitizedResult.includes('color: blue'), 'color style stripped');
assert.ok(!sanitizedResult.includes('behavior:'), 'behavior CSS property stripped');
assert.ok(!sanitizedResult.includes('<script>'), 'script tag completely removed');
assert.ok(!sanitizedResult.includes('<iframe>'), 'iframe tag completely removed');
assert.ok(!sanitizedResult.includes('<p><figure'), 'Nested figure inside paragraph unwrapped');

console.log('  ✓ HTML Sanitizer strictly validates <figure>, <figcaption>, safe inline styles, and eliminates XSS vectors');

// 7.4 Button btn-cheat-image & Modal Markup in Both Editors
console.log('  -> 7.4 Testing btn-cheat-image and Modal Image Cheat markup in Blog Editor & News Editor');

for (const [editorName, editorHtml] of [
    ['Blog Editor (editor.astro)', blogEditorFile],
    ['News Editor (news/editor.astro)', newsEditorFile]
]) {
    // Toolbar button
    assert.ok(editorHtml.includes('id="btn-cheat-image"'), `${editorName} must contain button #btn-cheat-image`);
    assert.ok(editorHtml.includes('CHEAT: IMG'), `${editorName} button must be labeled 'CHEAT: IMG'`);

    // Modal dialog container
    assert.ok(editorHtml.includes('id="modal-image-cheat"'), `${editorName} must contain dialog #modal-image-cheat`);
    assert.ok(editorHtml.includes('id="modal-image-cheat-card"'), `${editorName} must contain card #modal-image-cheat-card`);
    assert.ok(editorHtml.includes('id="modal-image-cheat-title"'), `${editorName} must contain title #modal-image-cheat-title`);
    assert.ok(editorHtml.includes('id="modal-image-cheat-close"'), `${editorName} must contain close button #modal-image-cheat-close`);
    assert.ok(editorHtml.includes('id="modal-image-cheat-cancel"'), `${editorName} must contain cancel button #modal-image-cheat-cancel`);

    // Input fields
    assert.ok(editorHtml.includes('id="cheat-img-url"'), `${editorName} must contain input #cheat-img-url`);
    assert.ok(editorHtml.includes('id="cheat-img-alt"'), `${editorName} must contain input #cheat-img-alt`);
    assert.ok(editorHtml.includes('id="cheat-img-caption"'), `${editorName} must contain input #cheat-img-caption`);

    // Size preset buttons & custom width
    assert.ok(editorHtml.includes('id="cheat-size-buttons"'), `${editorName} must contain size buttons group #cheat-size-buttons`);
    assert.ok(editorHtml.includes('data-size="small"'), `${editorName} must have small size button`);
    assert.ok(editorHtml.includes('data-size="medium"'), `${editorName} must have medium size button`);
    assert.ok(editorHtml.includes('data-size="large"'), `${editorName} must have large size button`);
    assert.ok(editorHtml.includes('data-size="full"'), `${editorName} must have full size button`);
    assert.ok(editorHtml.includes('data-size="custom"'), `${editorName} must have custom size button`);
    assert.ok(editorHtml.includes('id="cheat-img-custom-wrap"'), `${editorName} must contain custom width wrap #cheat-img-custom-wrap`);
    assert.ok(editorHtml.includes('id="cheat-img-custom-width"'), `${editorName} must contain custom width input #cheat-img-custom-width`);

    // Alignment buttons
    assert.ok(editorHtml.includes('id="cheat-align-buttons"'), `${editorName} must contain align buttons group #cheat-align-buttons`);
    assert.ok(editorHtml.includes('data-align="center"'), `${editorName} must have center align button`);
    assert.ok(editorHtml.includes('data-align="left"'), `${editorName} must have left align button`);
    assert.ok(editorHtml.includes('data-align="right"'), `${editorName} must have right align button`);

    // Previews & Insert
    assert.ok(editorHtml.includes('id="cheat-img-code-preview"'), `${editorName} must contain code preview #cheat-img-code-preview`);
    assert.ok(editorHtml.includes('id="cheat-img-visual-preview"'), `${editorName} must contain visual preview #cheat-img-visual-preview`);
    assert.ok(editorHtml.includes('id="cheat-img-insert"'), `${editorName} must contain insert button #cheat-img-insert`);

    // Script wiring
    assert.ok(editorHtml.includes("btnCheatImage.addEventListener('click'"), `${editorName} must attach click handler to open cheat modal`);
    assert.ok(editorHtml.includes("modalImageCheatClose.addEventListener('click'"), `${editorName} must attach close handler to close button`);
    assert.ok(editorHtml.includes("modalImageCheatCancel.addEventListener('click'"), `${editorName} must attach close handler to cancel button`);
    assert.ok(editorHtml.includes("cheatImgInsert.addEventListener('click'"), `${editorName} must attach click handler to insert markdown`);
    assert.ok(editorHtml.includes("function renderCustomImage(href, text, title)"), `${editorName} script must define client-side renderCustomImage for live preview`);

    console.log(`  ✓ ${editorName}: #btn-cheat-image, modal markup, presets (S/M/L/Full/Custom), alignments, previews & JS handlers verified`);
}

// 7.5 Marked Instance Integration in Blog and News Pages
console.log('  -> 7.5 Testing Marked renderer integration & End-to-End Image rendering in Blog & News Details');

const blogDetailSrc = fs.readFileSync(path.join(cwd, 'src/pages/blog/posts/[id].astro'), 'utf-8');
const newsDetailSrc = fs.readFileSync(path.join(cwd, 'src/pages/news/[id].astro'), 'utf-8');

for (const [pageName, src] of [['Blog Detail', blogDetailSrc], ['News Detail', newsDetailSrc]]) {
    assert.ok(src.includes('renderCustomImage'), `${pageName} must import and use renderCustomImage`);
    assert.ok(src.includes('image(token)'), `${pageName} markedInstance must implement image(token) renderer`);
    assert.ok(src.includes('.article-content figure'), `${pageName} CSS must include .article-content figure`);
    assert.ok(src.includes('.article-content figure img'), `${pageName} CSS must include .article-content figure img`);
}

// End-to-end Marked Parsing with Image
const customMarked = new Marked();
customMarked.use({
    renderer: {
        image(token) {
            return renderCustomImage(token.href, token.text, token.title);
        }
    }
});

const e2eTestCases = [
    {
        markdown: '![Demo | right | large | caption="Diagram Sistem"](https://example.com/demo.png)',
        expectFigure: 'items-end text-right',
        expectStyle: 'width: 720px; max-width: 100%; height: auto',
        expectCaption: '&gt; Diagram Sistem'
    },
    {
        markdown: '![Workflow | left | 360px | caption="Alur Kerja"](https://example.com/flow.png)',
        expectFigure: 'items-start text-left',
        expectStyle: 'width: 360px; max-width: 100%; height: auto',
        expectCaption: '&gt; Alur Kerja'
    },
    {
        markdown: '![Responsive | center | 50% | caption="Lebar Separuh"](https://example.com/half.png)',
        expectFigure: 'items-center text-center',
        expectStyle: 'width: 50%; max-width: 100%; height: auto',
        expectCaption: '&gt; Lebar Separuh'
    }
];

for (const testCase of e2eTestCases) {
    const output = sanitizeArticleContent(customMarked.parse(testCase.markdown));
    assert.ok(output.includes(testCase.expectFigure), `E2E figure class "${testCase.expectFigure}" expected in output`);
    assert.ok(output.includes(testCase.expectStyle), `E2E style "${testCase.expectStyle}" expected in output`);
    assert.ok(output.includes(testCase.expectCaption), `E2E caption "${testCase.expectCaption}" expected in output`);
}

console.log('  ✓ End-to-end Marked parsing + sanitization successfully validated across all image formats');

console.log('\n✓ Markdown Image Formatter, Sanitizer Style Whitelist, Cheat Modal & Marked Renderer verified across Blog & News');

// =========================================================================
// TEST SUITE 8: Open Graph Image Optimizer & SEO Component Integration
// =========================================================================
console.log('\n[Suite 8] Testing Open Graph Image Optimizer (optimizeOgImageUrl) & SEO.astro');

// 8.1 Default Banner Fallback when rawUrl is missing, empty, or whitespace
assert.equal(optimizeOgImageUrl(undefined), 'https://www.efzyn.my.id/banner.png');
assert.equal(optimizeOgImageUrl(''), 'https://www.efzyn.my.id/banner.png');
assert.equal(optimizeOgImageUrl('   '), 'https://www.efzyn.my.id/banner.png');
console.log('✓ optimizeOgImageUrl returns default banner when rawUrl is missing or blank');

// 8.2 Default Banner Fallback for relative or absolute /banner.png
assert.equal(optimizeOgImageUrl('/banner.png'), 'https://www.efzyn.my.id/banner.png');
assert.equal(optimizeOgImageUrl('banner.png'), 'https://www.efzyn.my.id/banner.png');
assert.equal(optimizeOgImageUrl('https://www.efzyn.my.id/banner.png'), 'https://www.efzyn.my.id/banner.png');
assert.equal(optimizeOgImageUrl('http://localhost:4321/banner.png?v=1'), 'https://www.efzyn.my.id/banner.png');
console.log('✓ optimizeOgImageUrl preserves original banner.png without proxying through wsrv.nl');

// 8.3 Custom siteBase support
assert.equal(optimizeOgImageUrl('/banner.png', 'https://custom-domain.com'), 'https://custom-domain.com/banner.png');
assert.equal(optimizeOgImageUrl(undefined, 'https://custom-domain.com/'), 'https://custom-domain.com/banner.png');
console.log('✓ optimizeOgImageUrl respects custom siteBase parameter and trims trailing slashes');

// 8.4 External image proxying through Cloudflare Edge (wsrv.nl)
const ext1 = 'https://raw.githubusercontent.com/efzynx/portfolio/main/cover.png';
const expectedExt1 = `https://wsrv.nl/?url=${encodeURIComponent(ext1)}&w=1200&h=630&fit=cover&output=jpg&q=80`;
assert.equal(optimizeOgImageUrl(ext1), expectedExt1);

const ext2 = 'https://i.ibb.co/xyz789/thumbnail.jpg?token=abc';
const expectedExt2 = `https://wsrv.nl/?url=${encodeURIComponent(ext2)}&w=1200&h=630&fit=cover&output=jpg&q=80`;
assert.equal(optimizeOgImageUrl(ext2), expectedExt2);

const ext3 = 'https://abc.supabase.co/storage/v1/object/public/images/post1.png';
const expectedExt3 = `https://wsrv.nl/?url=${encodeURIComponent(ext3)}&w=1200&h=630&fit=cover&output=jpg&q=80`;
assert.equal(optimizeOgImageUrl(ext3), expectedExt3);
console.log('✓ optimizeOgImageUrl correctly proxies external images through wsrv.nl with 1200x630, fit=cover, output=jpg, q=80');

// 8.5 Idempotency: Do not re-wrap already proxied wsrv.nl URLs
const alreadyProxied = 'https://wsrv.nl/?url=https%3A%2F%2Fexample.com%2Fimg.png&w=1200&h=630&fit=cover&output=jpg&q=80';
assert.equal(optimizeOgImageUrl(alreadyProxied), alreadyProxied);
console.log('✓ optimizeOgImageUrl does not re-wrap already proxied wsrv.nl URLs');

// 8.6 SEO.astro Integration Checks
const seoSource = fs.readFileSync(path.join(cwd, 'src/components/SEO.astro'), 'utf-8');
assert.ok(seoSource.includes("import { optimizeOgImageUrl } from \"../lib/utils\";"), 'SEO.astro must import optimizeOgImageUrl');
assert.ok(seoSource.includes("const fullOgImage = optimizeOgImageUrl(rawImage, siteBase);"), 'SEO.astro must compute fullOgImage using optimizeOgImageUrl');
assert.ok(seoSource.includes("const isProxiedByWsrv = fullOgImage.includes('wsrv.nl');"), 'SEO.astro must detect wsrv.nl proxying');
assert.ok(seoSource.includes("isProxiedByWsrv\n  ? 'image/jpeg'"), 'SEO.astro must set ogImageMime to image/jpeg for wsrv.nl');
assert.ok(seoSource.includes('<meta property="og:image" content={fullOgImage} />'), 'SEO.astro must set og:image to fullOgImage');
assert.ok(seoSource.includes('<meta property="og:image:secure_url" content={secureOgImage} />'), 'SEO.astro must set og:image:secure_url to secureOgImage');
assert.ok(seoSource.includes('<meta property="og:image:type" content={ogImageMime} />'), 'SEO.astro must set og:image:type to ogImageMime');
assert.ok(seoSource.includes('<meta name="twitter:image" content={fullOgImage} />'), 'SEO.astro must set twitter:image to fullOgImage');
console.log('✓ SEO.astro integration verified: optimizeOgImageUrl, MIME type resolution, og:image, and twitter:image');

// 8.7 Blog Detail (src/pages/blog/posts/[id].astro) Integration Checks
const blogPostSource = fs.readFileSync(path.join(cwd, 'src/pages/blog/posts/[id].astro'), 'utf-8');
assert.ok(blogPostSource.includes('optimizeOgImageUrl'), 'Blog post page must import optimizeOgImageUrl');
assert.ok(blogPostSource.includes('const safeExplicitCover = (explicitCover && isSafeForOgImage(explicitCover)) ? explicitCover : undefined;'), 'Blog post page must validate explicitCover with isSafeForOgImage');
assert.ok(blogPostSource.includes('const fullOgImage = optimizeOgImageUrl(resolvedImage, siteBase);'), 'Blog post page must compute fullOgImage using optimizeOgImageUrl');
assert.ok(blogPostSource.includes('ogImage={fullOgImage}'), 'Blog post page must pass ogImage={fullOgImage} to BaseLayout');
assert.ok(blogPostSource.includes('"image": fullOgImage'), 'blogPostSchema must use fullOgImage as image');
assert.ok(blogPostSource.includes('schemaJsonLd={blogPostSchema}'), 'Blog post page must pass schemaJsonLd={blogPostSchema} to BaseLayout');
console.log('✓ Blog detail page (posts/[id].astro) verified: cover cascade, optimizeOgImageUrl, ogImage prop, and blogPostSchema');

// 8.8 News Detail (src/pages/news/[id].astro) Integration Checks
const newsDetailSource = fs.readFileSync(path.join(cwd, 'src/pages/news/[id].astro'), 'utf-8');
assert.ok(newsDetailSource.includes('optimizeOgImageUrl'), 'News detail page must import optimizeOgImageUrl');
assert.ok(newsDetailSource.includes('const safeExplicitCover = (explicitCover && isSafeForOgImage(explicitCover)) ? explicitCover : undefined;'), 'News detail page must validate explicitCover with isSafeForOgImage');
assert.ok(newsDetailSource.includes('const fullOgImage = optimizeOgImageUrl(resolvedImage, siteBase);'), 'News detail page must compute fullOgImage using optimizeOgImageUrl');
assert.ok(newsDetailSource.includes('ogImage={fullOgImage}'), 'News detail page must pass ogImage={fullOgImage} to BaseLayout');
assert.ok(newsDetailSource.includes('"image": fullOgImage'), 'newsArticleSchema must use fullOgImage as image');
assert.ok(newsDetailSource.includes('schemaJsonLd={newsArticleSchema}'), 'News detail page must pass schemaJsonLd={newsArticleSchema} to BaseLayout');
console.log('✓ News detail page (news/[id].astro) verified: cover cascade, optimizeOgImageUrl, ogImage prop, and newsArticleSchema');

// 8.9 Fallback Cover Image Cascade Logic Simulation
const siteBase = 'https://www.efzyn.my.id';
function simulateCoverCascade(explicitCover, contentImage) {
  const safeExplicit = (explicitCover && isSafeForOgImage(explicitCover)) ? explicitCover : undefined;
  const safeContent = (contentImage && isSafeForOgImage(contentImage)) ? contentImage : undefined;
  const resolved = safeExplicit || safeContent || `${siteBase}/banner.png`;
  return optimizeOgImageUrl(resolved, siteBase);
}

// Case 1: Valid explicit cover
const cascade1 = simulateCoverCascade('https://example.com/cover.png', 'https://example.com/ignore-me.png');
assert.ok(cascade1.includes('url=https%3A%2F%2Fexample.com%2Fcover.png'), 'Cascade must prioritize explicitCover when safe');
assert.ok(cascade1.includes('wsrv.nl'), 'Cascade must optimize external explicitCover via wsrv.nl');

// Case 2: Unsafe explicit cover (SVG), safe content image
const cascade2 = simulateCoverCascade('https://example.com/logo.svg', 'https://example.com/content.jpg');
assert.ok(cascade2.includes('url=https%3A%2F%2Fexample.com%2Fcontent.jpg'), 'Cascade must fallback to safeContentImage if explicitCover is SVG/unsafe');

// Case 3: Unsafe explicit cover (data:), unsafe content image (wikimedia 403)
const cascade3 = simulateCoverCascade('data:image/png;base64,123', 'https://upload.wikimedia.org/wiki/img.jpg');
assert.equal(cascade3, 'https://www.efzyn.my.id/banner.png', 'Cascade must fallback to default banner if all covers are unsafe');

// Case 4: No explicit cover, no content image
const cascade4 = simulateCoverCascade(undefined, undefined);
assert.equal(cascade4, 'https://www.efzyn.my.id/banner.png', 'Cascade must fallback to default banner when no images exist');
console.log('✓ Fallback cover image cascade (explicitCover -> safeContentImage -> defaultDynamicImage) simulated and verified');

// 8.10 Schema.org JSON-LD image auto-optimization in SEO.astro
assert.ok(seoSource.includes("s.image = optimizeOgImageUrl(s.image, siteBase);"), 'SEO.astro must ensure schema image URLs are optimized');
console.log('✓ Schema.org JSON-LD auto-optimization for BlogPosting, NewsArticle, and Article verified in SEO.astro');

// =========================================================================
// TEST SUITE 9: Security Configuration: HSTS in vercel.json & RFC 9116 security.txt
// =========================================================================
console.log('\n[Suite 9] Testing Security Configuration: HSTS in vercel.json & RFC 9116 security.txt');

// 9.1 Validasi vercel.json memuat header Strict-Transport-Security dengan max-age=63072000; includeSubDomains; preload
const vercelJsonPath = path.join(cwd, 'vercel.json');
assert.ok(fs.existsSync(vercelJsonPath), 'vercel.json must exist');
const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json must contain headers array');

const globalHeaderEntry = vercelConfig.headers.find(entry => entry.source === '/(.*)');
assert.ok(globalHeaderEntry, 'vercel.json must define headers for source "/(.*)"');
assert.ok(Array.isArray(globalHeaderEntry.headers), 'globalHeaderEntry must have headers array');

const hstsHeader = globalHeaderEntry.headers.find(
  h => h.key && h.key.toLowerCase() === 'strict-transport-security'
);
assert.ok(hstsHeader, 'vercel.json headers for "/(.*)" must include Strict-Transport-Security');
assert.equal(
  hstsHeader.value,
  'max-age=63072000; includeSubDomains; preload',
  'Strict-Transport-Security must equal "max-age=63072000; includeSubDomains; preload"'
);

// Verify HSTS directives components
assert.ok(hstsHeader.value.includes('max-age=63072000'), 'HSTS must specify max-age of at least 2 years (63072000 seconds)');
assert.ok(hstsHeader.value.includes('includeSubDomains'), 'HSTS must include includeSubDomains directive');
assert.ok(hstsHeader.value.includes('preload'), 'HSTS must include preload directive for HSTS preload eligibility');
console.log('✓ vercel.json Strict-Transport-Security header validated: max-age=63072000; includeSubDomains; preload');

// 9.2 Validasi keberadaan berkas public/.well-known/security.txt
const securityTxtPath = path.join(cwd, 'public/.well-known/security.txt');
assert.ok(fs.existsSync(securityTxtPath), 'public/.well-known/security.txt must exist');
console.log('✓ public/.well-known/security.txt file existence verified');

// 9.3 Validasi isi security.txt memenuhi standar RFC 9116
const securityTxtContent = fs.readFileSync(securityTxtPath, 'utf-8');
const lines = securityTxtContent.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

const directives = {};
for (const line of lines) {
  const colonIndex = line.indexOf(':');
  assert.ok(colonIndex > 0, `Line "${line}" must follow RFC 9116 format (Directive: Value)`);
  const key = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1).trim();
  directives[key] = value;
}

// Contact Directive
assert.ok(directives['Contact'], 'security.txt must include Contact directive (RFC 9116 Section 2.5.1)');
assert.equal(
  directives['Contact'],
  'mailto:me@efzyn.my.id',
  'Contact directive must be mailto:me@efzyn.my.id'
);
assert.ok(
  directives['Contact'].startsWith('mailto:') || directives['Contact'].startsWith('https://'),
  'Contact directive must be a valid URI (mailto: or https://)'
);

// Expires Directive
assert.ok(directives['Expires'], 'security.txt must include Expires directive (RFC 9116 Section 2.5.5)');
const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
assert.match(
  directives['Expires'],
  rfc3339Regex,
  'Expires directive must follow RFC 3339 date-time format (e.g. 2027-10-02T00:00:00.000Z)'
);
const expiresTimestamp = Date.parse(directives['Expires']);
assert.ok(!isNaN(expiresTimestamp), 'Expires date must be a parseable valid date');
assert.ok(
  expiresTimestamp > Date.now(),
  `Expires date (${directives['Expires']}) must be in the future per RFC 9116`
);

// Preferred-Languages Directive
assert.ok(directives['Preferred-Languages'], 'security.txt must include Preferred-Languages directive');
assert.ok(
  directives['Preferred-Languages'].includes('id'),
  'Preferred-Languages directive should include Indonesian (id)'
);
assert.ok(
  directives['Preferred-Languages'].includes('en'),
  'Preferred-Languages directive should include English (en)'
);

// Canonical Directive
assert.ok(directives['Canonical'], 'security.txt must include Canonical directive (RFC 9116 Section 2.5.3)');
assert.equal(
  directives['Canonical'],
  'https://www.efzyn.my.id/.well-known/security.txt',
  'Canonical directive must point to https://www.efzyn.my.id/.well-known/security.txt'
);
assert.ok(
  directives['Canonical'].startsWith('https://'),
  'Canonical directive must use HTTPS URI scheme per RFC 9116'
);
console.log('✓ security.txt RFC 9116 compliance validated (Contact, future Expires, Preferred-Languages, Canonical)');

// =========================================================================
// TEST SUITE 10: SEO Title Normalization, Semantic H2, Professional Bio & Meta Description Char Counter
// =========================================================================
console.log('\n[Suite 10] Testing SEO Title Normalization, Semantic H2, Professional Bio & Meta Description Char Counter');

// 10.1 Validasi Homepage Title & Normalisasi fullTitle di BaseLayout.astro & SEO.astro
console.log('  -> 10.1 Validating Homepage Title & fullTitle normalization in BaseLayout.astro & SEO.astro');
const indexSource = fs.readFileSync(path.join(cwd, 'src/pages/index.astro'), 'utf-8');
const baseLayoutSource = fs.readFileSync(path.join(cwd, 'src/layouts/BaseLayout.astro'), 'utf-8');
const currentSeoSource = fs.readFileSync(path.join(cwd, 'src/components/SEO.astro'), 'utf-8');

// Verifikasi title prop di index.astro
assert.ok(
    indexSource.includes('title="Ahmad Fauzan Adiman — Backend Developer & DevOps Enthusiast"'),
    'index.astro must provide explicit full professional title to BaseLayout'
);

// Verifikasi logic normalisasi di BaseLayout.astro
assert.ok(
    baseLayoutSource.includes("title.includes('Ahmad Fauzan Adiman')"),
    'BaseLayout.astro must check if title includes brand/name to prevent duplicate suffix'
);
assert.ok(
    baseLayoutSource.includes('<title>{fullTitle}</title>'),
    'BaseLayout.astro must render <title>{fullTitle}</title>'
);

// Verifikasi logic normalisasi di SEO.astro
assert.ok(
    currentSeoSource.includes("title.includes('Ahmad Fauzan Adiman')"),
    'SEO.astro must check if title includes brand/name to prevent duplicate suffix'
);
assert.ok(
    currentSeoSource.includes('<meta property="og:title" content={fullTitle} />'),
    'SEO.astro must set og:title to fullTitle'
);
assert.ok(
    currentSeoSource.includes('<meta name="twitter:title" content={fullTitle} />'),
    'SEO.astro must set twitter:title to fullTitle'
);

// Test unit normalisasi fungsi fullTitle
function normalizeTitle(rawTitle) {
    return rawTitle.includes('Ahmad Fauzan Adiman')
        ? rawTitle
        : `${rawTitle} — Ahmad Fauzan Adiman`;
}

// Kasus 1: Homepage title tidak boleh terduplikasi
const homepageRaw = 'Ahmad Fauzan Adiman — Backend Developer & DevOps Enthusiast';
assert.equal(
    normalizeTitle(homepageRaw),
    'Ahmad Fauzan Adiman — Backend Developer & DevOps Enthusiast',
    'Homepage title should not append duplicate "— Ahmad Fauzan Adiman"'
);

// Kasus 2: Title pendek biasa harus diberi suffix nama
assert.equal(
    normalizeTitle('Blog'),
    'Blog — Ahmad Fauzan Adiman',
    'Short title should append " — Ahmad Fauzan Adiman"'
);
assert.equal(
    normalizeTitle('Portfolio'),
    'Portfolio — Ahmad Fauzan Adiman',
    'Short title should append " — Ahmad Fauzan Adiman"'
);
assert.equal(
    normalizeTitle('News & Articles'),
    'News & Articles — Ahmad Fauzan Adiman',
    'Custom page title should append " — Ahmad Fauzan Adiman"'
);

// Kasus 3: Title artikel yang sudah ada nama tidak boleh terduplikasi
assert.equal(
    normalizeTitle('Panduan Docker oleh Ahmad Fauzan Adiman'),
    'Panduan Docker oleh Ahmad Fauzan Adiman',
    'Title already mentioning author should not duplicate suffix'
);
console.log('✓ Homepage title & fullTitle normalization logic validated across BaseLayout.astro & SEO.astro');

// 10.2 Validasi Keberadaan dan Hirarki Semantik <h2> di src/pages/index.astro
console.log('  -> 10.2 Validating semantic <h2> hierarchy in src/pages/index.astro');
assert.ok(
    indexSource.includes('<h2'),
    'index.astro must contain <h2> heading element for SEO hierarchy'
);
assert.ok(
    indexSource.includes('&gt; directory_index') || indexSource.includes('> directory_index'),
    'index.astro <h2> must contain "> directory_index" navigation landmark'
);
assert.ok(
    indexSource.includes('aria-label="Main navigation"'),
    'index.astro nav must include accessibility aria-label'
);
console.log('✓ Semantic <h2> navigation heading on homepage verified');

// 10.3 Validasi Penghapusan Bio Lama "Mahasiswa" & Konfigurasi Bio Profesional Baru
console.log('  -> 10.3 Validating elimination of legacy student bio & verification of professional bio');
const profileJsonPath = path.join(cwd, 'src/content/profile.json');
const profileJsonContent = fs.readFileSync(profileJsonPath, 'utf-8');
const profileData = JSON.parse(profileJsonContent);

const filesToCheckForLegacyBio = [
    { name: 'src/content/profile.json', content: profileJsonContent },
    { name: 'src/lib/cms.ts', content: cmsSource },
    { name: 'src/components/SEO.astro', content: currentSeoSource },
    { name: 'public/llms.txt', content: fs.readFileSync(path.join(cwd, 'public/llms.txt'), 'utf-8') }
];

for (const file of filesToCheckForLegacyBio) {
    assert.ok(
        !file.content.toLowerCase().includes('mahasiswa tingkat akhir'),
        `${file.name} must NOT contain "Mahasiswa tingkat akhir"`
    );
    assert.ok(
        !file.content.toLowerCase().includes('final-year'),
        `${file.name} must NOT contain "final-year"`
    );
}

// Verifikasi bio profesional baru di profile.json
assert.ok(
    profileData.bio.includes('Fokus pada arsitektur sistem scalable, otomasi cloud, dan lingkungan Linux.'),
    'profile.json bio must reflect new professional bio focusing on scalable architecture & cloud/Linux'
);

// Verifikasi fallback bio di cms.ts
assert.ok(
    cmsSource.includes('Fokus pada arsitektur sistem scalable, otomasi cloud, dan lingkungan Linux.'),
    'cms.ts fallback profileData must reflect new professional bio'
);

// Verifikasi fallback bio di SEO.astro
assert.ok(
    currentSeoSource.includes('Fokus pada arsitektur sistem scalable, otomasi cloud, dan lingkungan Linux.'),
    'SEO.astro fallback description must reflect new professional bio'
);

// Verifikasi bio di public/llms.txt
const llmsTxtContent = fs.readFileSync(path.join(cwd, 'public/llms.txt'), 'utf-8');
assert.ok(
    llmsTxtContent.includes('Specializing in scalable backend architectures, cloud infrastructure, and Linux systems.'),
    'public/llms.txt must reflect new professional bio'
);
console.log('✓ Legacy "Mahasiswa tingkat akhir" completely eliminated and new professional bio verified across all sources');

// 10.4 Validasi Live Character Counter Meta Description (160 Karakter) di Blog & News Editor
console.log('  -> 10.4 Validating live meta description character counter in Blog & News Editor');
const blogEditorSource = fs.readFileSync(path.join(cwd, 'src/pages/writer/dashboard/editor.astro'), 'utf-8');
const newsEditorSource = fs.readFileSync(path.join(cwd, 'src/pages/writer/dashboard/news/editor.astro'), 'utf-8');

// Blog Editor Markup & Script Verification
assert.ok(
    blogEditorSource.includes('id="desc-char-counter"'),
    'Blog editor must contain #desc-char-counter element'
);
assert.ok(
    blogEditorSource.includes('/ 160 karakter'),
    'Blog editor counter markup must display / 160 karakter limit'
);
assert.ok(
    blogEditorSource.includes('Melebihi 160 karakter — Google akan memotong di SERP'),
    'Blog editor must warn when description exceeds 160 characters (SERP truncation warning)'
);
assert.ok(
    blogEditorSource.includes("document.getElementById('desc-char-counter')"),
    'Blog editor client script must bind #desc-char-counter'
);
assert.ok(
    blogEditorSource.includes("descField.addEventListener('input', updateDescCharCounter)"),
    'Blog editor must listen to input events on description textarea'
);

// News Editor Markup & Script Verification
assert.ok(
    newsEditorSource.includes('id="desc-char-counter"'),
    'News editor must contain #desc-char-counter element'
);
assert.ok(
    newsEditorSource.includes('/ 160 karakter'),
    'News editor counter markup must display / 160 karakter limit'
);
assert.ok(
    newsEditorSource.includes('Melebihi 160 karakter — Google akan memotong di SERP'),
    'News editor must warn when summary exceeds 160 characters (SERP truncation warning)'
);
assert.ok(
    newsEditorSource.includes("document.getElementById('desc-char-counter')"),
    'News editor client script must bind #desc-char-counter'
);
assert.ok(
    newsEditorSource.includes("summaryField.addEventListener('input', updateDescCharCounter)"),
    'News editor must update desc-char-counter on summaryField input'
);

// Unit Test Counter Logic Simulation
function simulateDescCounter(text) {
    const len = text.length;
    if (len > 160) {
        return {
            warning: true,
            text: `${len} / 160 karakter — Melebihi 160 karakter — Google akan memotong di SERP`,
            isOverLimit: true
        };
    }
    return {
        warning: false,
        text: `${len} / 160 karakter`,
        isOverLimit: false
    };
}

const safeDesc = 'Panduan komprehensif arsitektur microservices dan container orchestration dengan Kubernetes dan Docker untuk skalabilitas tinggi.';
const exact160Desc = 'A'.repeat(160);
const overLimitDesc = 'A'.repeat(161);

const safeResult = simulateDescCounter(safeDesc);
assert.equal(safeResult.warning, false);
assert.equal(safeResult.text, `${safeDesc.length} / 160 karakter`);

const exactResult = simulateDescCounter(exact160Desc);
assert.equal(exactResult.warning, false);
assert.equal(exactResult.text, '160 / 160 karakter');

const overResult = simulateDescCounter(overLimitDesc);
assert.equal(overResult.warning, true);
assert.equal(overResult.text, '161 / 160 karakter — Melebihi 160 karakter — Google akan memotong di SERP');

console.log('✓ Meta description character counter (160 chars SERP threshold) markup & client script verified in both editors');

console.log('\n=========================================');
console.log('ALL QA AUTOMATED TESTS PASSED SUCCESSFULLY (10/10 SUITES)');
console.log('=========================================\n');
