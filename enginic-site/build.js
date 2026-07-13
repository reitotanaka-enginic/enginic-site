#!/usr/bin/env node
/**
 * Enginic static site builder — zero external dependencies.
 * Reads src/pages/*.html (static pages) and content/blog/*.md (blog posts),
 * outputs a fully static site into public/.
 *
 * Usage: node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE_URL = 'https://enginic.jp';
const SITE_NAME = '税理士法人Enginic';

const SRC_PAGES = path.join(ROOT, 'src/pages');
const PARTIALS = path.join(ROOT, 'src/partials');
const TEMPLATES = path.join(ROOT, 'src/templates');
const BLOG_SRC = path.join(ROOT, 'content/blog');
const OUT = path.join(ROOT, 'public');

// ---------- small utils ----------
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}
function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- frontmatter parser (--- key: value --- body) ----------
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    val = val.replace(/^["']|["']$/g, '');
    data[key] = val;
  }
  return { data, body: m[2] };
}

// ---------- minimal markdown -> HTML ----------
function renderInline(text) {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;
  let para = [];
  let listBuffer = null; // { type: 'ul'|'ol', items: [] }

  function flushPara() {
    if (para.length) {
      html += `<p>${renderInline(para.join(' '))}</p>\n`;
      para = [];
    }
  }
  function flushList() {
    if (listBuffer) {
      const tag = listBuffer.type;
      html += `<${tag}>\n` + listBuffer.items.map(it => `  <li>${renderInline(it)}</li>`).join('\n') + `\n</${tag}>\n`;
      listBuffer = null;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      flushPara();
      flushList();
      i++;
      continue;
    }
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) {
      flushPara(); flushList();
      html += `<h3>${renderInline(m[1])}</h3>\n`;
      i++; continue;
    }
    if ((m = line.match(/^##\s+(.*)$/))) {
      flushPara(); flushList();
      html += `<h2>${renderInline(m[1])}</h2>\n`;
      i++; continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      const quoteLines = [m[1]];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote><p>${renderInline(quoteLines.join(' '))}</p></blockquote>\n`;
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (!listBuffer || listBuffer.type !== 'ul') { flushList(); listBuffer = { type: 'ul', items: [] }; }
      listBuffer.items.push(m[1]);
      i++; continue;
    }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (!listBuffer || listBuffer.type !== 'ol') { flushList(); listBuffer = { type: 'ol', items: [] }; }
      listBuffer.items.push(m[1]);
      i++; continue;
    }
    // default: paragraph text
    flushList();
    para.push(line.trim());
    i++;
  }
  flushPara();
  flushList();
  return html;
}

// ---------- date formatting ----------
function formatJpDate(iso) {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00+09:00' : ''));
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ---------- layout ----------
const headerPartial = read(path.join(PARTIALS, 'header.html'));
const footerPartial = read(path.join(PARTIALS, 'footer.html'));

function activeAttr(active, key) {
  return active === key ? 'aria-current="page"' : '';
}

function renderHeader(active) {
  return headerPartial
    .replace('{{ACTIVE_ABOUT}}', activeAttr(active, 'about'))
    .replace('{{ACTIVE_SERVICE}}', activeAttr(active, 'service'))
    .replace('{{ACTIVE_PRICING}}', activeAttr(active, 'pricing'))
    .replace('{{ACTIVE_MEMBERS}}', activeAttr(active, 'members'))
    .replace('{{ACTIVE_BLOG}}', activeAttr(active, 'blog'))
    .replace('{{ACTIVE_ACCESS}}', activeAttr(active, 'access'))
    .replace('{{ACTIVE_CONTACT}}', activeAttr(active, 'contact'));
}

function baseLayout({ title, description, canonicalPath, active, body, ogImage, jsonLd }) {
  const canonical = SITE_URL + canonicalPath;
  const img = ogImage || `${SITE_URL}/assets/images/favicon-512.png`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${img}">
<link rel="icon" href="/assets/images/favicon-32.png" sizes="32x32">
<link rel="icon" href="/assets/images/favicon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/images/favicon-180.png">
<link rel="stylesheet" href="/assets/css/style.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
${renderHeader(active)}
<main>
${body}
</main>
${footerPartial}
</body>
</html>
`;
}

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AccountingService',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/assets/images/logo.png`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '鶯谷町７－７ OHビル',
    addressLocality: '渋谷区',
    addressRegion: '東京都',
    addressCountry: 'JP'
  },
  founder: [
    { '@type': 'Person', name: '古山 裕基' },
    { '@type': 'Person', name: '田中 励人' }
  ],
  foundingDate: '2026-01'
};

// ---------- build steps ----------
function buildStaticPages() {
  const files = fs.readdirSync(SRC_PAGES).filter(f => f.endsWith('.html'));
  for (const file of files) {
    const raw = read(path.join(SRC_PAGES, file));
    const { data, body } = parseFrontmatter(raw);
    const name = file.replace(/\.html$/, '');
    let outPath;
    let canonicalPath;
    if (name === 'index') {
      outPath = path.join(OUT, 'index.html');
      canonicalPath = '/';
    } else if (name === '404') {
      outPath = path.join(OUT, '404.html');
      canonicalPath = '/404.html';
    } else {
      outPath = path.join(OUT, name, 'index.html');
      canonicalPath = `/${name}/`;
    }
    const html = baseLayout({
      title: data.title || SITE_NAME,
      description: data.description || '',
      canonicalPath,
      active: data.active || 'none',
      body,
      jsonLd: name === 'index' ? orgJsonLd : null
    });
    write(outPath, html);
    console.log('page:', canonicalPath);
  }
}

function buildBlog() {
  if (!fs.existsSync(BLOG_SRC)) return [];
  const postTemplate = read(path.join(TEMPLATES, 'post.html'));
  const indexTemplate = read(path.join(TEMPLATES, 'blog-index.html'));

  const files = fs.readdirSync(BLOG_SRC).filter(f => f.endsWith('.md'));
  const posts = files.map(file => {
    const raw = read(path.join(BLOG_SRC, file));
    const { data, body } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');
    const dateIso = (data.date || '').slice(0, 10);
    return {
      slug,
      title: data.title || slug,
      date: dateIso,
      tag: data.tag || 'お知らせ',
      excerpt: data.excerpt || '',
      thumbnail: data.thumbnail || '',
      bodyHtml: markdownToHtml(body)
    };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  // individual post pages
  for (const post of posts) {
    const content = postTemplate
      .replace('{{TITLE}}', escapeHtml(post.title))
      .replace('{{TAG}}', escapeHtml(post.tag))
      .replace('{{DATE_ISO}}', post.date)
      .replace('{{DATE_JP}}', formatJpDate(post.date))
      .replace('{{BODY}}', post.bodyHtml);

    const html = baseLayout({
      title: `${post.title} | ${SITE_NAME}`,
      description: post.excerpt || post.title,
      canonicalPath: `/blog/${post.slug}/`,
      active: 'blog',
      body: content
    });
    write(path.join(OUT, 'blog', post.slug, 'index.html'), html);
    console.log('post:', `/blog/${post.slug}/`);
  }

  // blog index page
  const rows = posts.map(post => `
      <a class="post-row" href="/blog/${post.slug}/">
        <time datetime="${post.date}">${formatJpDate(post.date)}</time>
        <div>
          <div class="post-tag">${escapeHtml(post.tag)}</div>
          <h3>${escapeHtml(post.title)}</h3>
          <p class="excerpt">${escapeHtml(post.excerpt)}</p>
        </div>
      </a>`).join('\n');

  const indexBody = indexTemplate.replace('{{POSTS}}', rows || '<p>まだ記事がありません。</p>');
  const indexHtml = baseLayout({
    title: `コラム | ${SITE_NAME}`,
    description: '税務・会計・経営に関する情報を発信しています。',
    canonicalPath: '/blog/',
    active: 'blog',
    body: indexBody
  });
  write(path.join(OUT, 'blog', 'index.html'), indexHtml);
  console.log('page: /blog/');

  return posts;
}

function buildSitemapAndFeed(posts) {
  const staticPaths = ['/', '/about/', '/service/', '/pricing/', '/members/', '/access/', '/contact/', '/blog/'];
  const postPaths = posts.map(p => `/blog/${p.slug}/`);
  const all = [...staticPaths, ...postPaths];
  const urlset = all.map(p => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`;
  write(path.join(OUT, 'sitemap.xml'), sitemap);

  const items = posts.map(p => `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}/</link>
      <guid>${SITE_URL}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeHtml(p.excerpt)}</description>
    </item>`).join('');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n<title>${SITE_NAME}</title>\n<link>${SITE_URL}/blog/</link>\n<description>税務・会計・経営に関する情報</description>\n<language>ja</language>${items}\n</channel></rss>\n`;
  write(path.join(OUT, 'feed.xml'), rss);
}

function buildRobots() {
  const content = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  write(path.join(OUT, 'robots.txt'), content);
}

function main() {
  rimraf(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  if (fs.existsSync(path.join(ROOT, 'admin'))) copyDir(path.join(ROOT, 'admin'), path.join(OUT, 'admin'));

  buildStaticPages();
  const posts = buildBlog();
  buildSitemapAndFeed(posts);
  buildRobots();

  console.log(`\nBuild complete: ${posts.length} blog post(s). Output -> public/`);
}

main();
