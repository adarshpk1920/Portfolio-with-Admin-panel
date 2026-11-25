const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

marked.setOptions({ gfm: true, breaks: true });

/** Render admin-authored Markdown to HTML, then sanitise it so stored content can never inject scripts. */
function renderMarkdown(md) {
  const html = marked.parse(String(md || ''));
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'figure', 'figcaption']),
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function safeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = { slugify, renderMarkdown, splitList, safeUrl, formatDate };
