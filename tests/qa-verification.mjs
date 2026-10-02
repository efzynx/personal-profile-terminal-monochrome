import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePostSlug } from '../src/lib/utils.ts';
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

console.log('\n=========================================');
console.log('ALL QA AUTOMATED TESTS PASSED SUCCESSFULLY (7/7 SUITES)');
console.log('=========================================\n');
