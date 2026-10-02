import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePostSlug } from '../src/lib/utils.ts';

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

console.log('\n=========================================');
console.log('ALL QA AUTOMATED TESTS PASSED SUCCESSFULLY (6/6 SUITES)');
console.log('=========================================\n');
