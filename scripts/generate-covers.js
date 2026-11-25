#!/usr/bin/env node
/**
 * Generates the illustrated SVG cover + gallery artwork for the seed projects.
 * Run: node scripts/generate-covers.js   (writes to public/images/seed/)
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'images', 'seed');
const W = 1200;
const H = 800;
const FONT = "font-family=\"Inter, 'Segoe UI', system-ui, -apple-system, sans-serif\"";

// ---------- shared building blocks ----------
function frame({ id, bg, blobs, body, accent = '#fff' }) {
  const blobSvg = blobs.map(([x, y, r, c, o = 0.55]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${FONT}>
<defs>
  <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">${bg.map((c, i) => `<stop offset="${i / (bg.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
  <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
  <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#000" flood-opacity="0.35"/></filter>
  <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.25"/></filter>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1020" stop-opacity="0.42"/><stop offset="1" stop-color="#0b1020" stop-opacity="0.28"/></linearGradient>
  <linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <pattern id="${id}-dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#fff" opacity="0.12"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="url(#${id}-bg)"/>
<g filter="url(#${id}-blur)">${blobSvg}</g>
<rect width="${W}" height="${H}" fill="url(#${id}-dots)"/>
${body}
<rect width="${W}" height="${H}" fill="url(#${id}-shine)"/>
<circle cx="${W - 70}" cy="70" r="4" fill="${accent}" opacity="0.6"/>
</svg>`;
}

/** Browser window with traffic lights and URL bar. Returns {svg, x, y, w, h} of content area. */
function browser(id, x, y, w, h, { theme = 'light', url = '' } = {}) {
  const dark = theme === 'dark';
  const chrome = dark ? '#1e2235' : '#f1f3f9';
  const page = dark ? '#121526' : '#ffffff';
  const bar = dark ? '#2a2f48' : '#ffffff';
  return {
    svg: `<g filter="url(#${id}-shadow)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${page}"/>
  <path d="M${x} ${y + 18}a18 18 0 0 1 18-18h${w - 36}a18 18 0 0 1 18 18v28h-${w}z" fill="${chrome}"/>
  <circle cx="${x + 26}" cy="${y + 23}" r="6" fill="#ff5f57"/><circle cx="${x + 46}" cy="${y + 23}" r="6" fill="#febc2e"/><circle cx="${x + 66}" cy="${y + 23}" r="6" fill="#28c840"/>
  <rect x="${x + w / 2 - 150}" y="${y + 12}" width="300" height="22" rx="11" fill="${bar}"/>
  <text x="${x + w / 2}" y="${y + 27.5}" font-size="11" text-anchor="middle" fill="${dark ? '#8b90b0' : '#8a90a6'}">🔒 ${url}</text>
</g>`,
    x, y: y + 46, w, h: h - 46,
  };
}

/** Phone frame. Returns {svg, x, y, w, h} of the screen area. */
function phone(id, x, y, w, h, screen = '#fff', rotate = 0) {
  const sx = x + 10;
  const sy = y + 10;
  return {
    open: `<g transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})" filter="url(#${id}-shadow)">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="42" fill="#0d0f1a"/>
  <rect x="${sx}" y="${sy}" width="${w - 20}" height="${h - 20}" rx="33" fill="${screen}"/>
  <rect x="${x + w / 2 - 38}" y="${y + 20}" width="76" height="20" rx="10" fill="#0d0f1a"/>`,
    close: '</g>',
    x: sx, y: sy, w: w - 20, h: h - 20,
  };
}

const bars = (x, y, n, gap, w, heights, color, rx = 4, o = 1) =>
  heights.slice(0, n).map((bh, i) => `<rect x="${x + i * (w + gap)}" y="${y - bh}" width="${w}" height="${bh}" rx="${rx}" fill="${color}" opacity="${o}"/>`).join('');

const lines = (x, y, widths, color, gap = 16, h = 8, o = 1) =>
  widths.map((lw, i) => `<rect x="${x}" y="${y + i * gap}" width="${lw}" height="${h}" rx="${h / 2}" fill="${color}" opacity="${o}"/>`).join('');

function smoothPath(points) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

function chart(id, x, y, w, h, values, color, fillId, sw = 4) {
  const max = Math.max(...values);
  const pts = values.map((v, i) => [x + (i / (values.length - 1)) * w, y + h - (v / max) * h * 0.9]);
  const d = smoothPath(pts);
  const last = pts[pts.length - 1];
  return `<path d="${d} L${x + w} ${y + h} L${x} ${y + h}Z" fill="url(#${fillId})"/>
<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
<circle cx="${last[0]}" cy="${last[1]}" r="8" fill="#fff" stroke="${color}" stroke-width="4"/>`;
}

function ring(cx, cy, r, pct, color, track, sw = 14) {
  const c = 2 * Math.PI * r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 ${cx} ${cy})"/>`;
}

const pill = (x, y, w, h, fill, text = '', tc = '#fff', fs = 13, weight = 600) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>${text ? `<text x="${x + w / 2}" y="${y + h / 2 + fs * 0.36}" font-size="${fs}" font-weight="${weight}" text-anchor="middle" fill="${tc}">${text}</text>` : ''}`;

const glassCard = (id, x, y, w, h, inner = '', rx = 20) =>
  `<g filter="url(#${id}-soft)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#${id}-glass)" stroke="#fff" stroke-opacity="0.35"/>${inner}</g>`;

const whiteCard = (id, x, y, w, h, inner = '', rx = 18, fill = '#fff') =>
  `<g filter="url(#${id}-soft)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>${inner}</g>`;

// ---------- scenes ----------
const scenes = {};

scenes.lumen = () => {
  const id = 'lu';
  const b = browser(id, 150, 120, 900, 580, { theme: 'dark', url: 'app.lumen.io/overview' });
  const { x, y } = b;
  const kpi = (kx, label, val, delta, c) => `<rect x="${kx}" y="${y + 70}" width="190" height="96" rx="14" fill="#1b1f36"/>
<text x="${kx + 18}" y="${y + 98}" font-size="12" fill="#8b90b0">${label}</text>
<text x="${kx + 18}" y="${y + 134}" font-size="28" font-weight="700" fill="#fff">${val}</text>
<text x="${kx + 172}" y="${y + 134}" font-size="12" font-weight="700" text-anchor="end" fill="${c}">${delta}</text>`;
  const body = `${b.svg}
<defs>
  <linearGradient id="lu-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5cf6" stop-opacity="0.55"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></linearGradient>
  <linearGradient id="lu-area2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity="0.35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
  <linearGradient id="lu-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
</defs>
<rect x="${x}" y="${y}" width="170" height="${b.h}" fill="#171a2e"/>
<rect x="${x + 22}" y="${y + 24}" width="30" height="30" rx="9" fill="#8b5cf6"/><text x="${x + 62}" y="${y + 45}" font-size="16" font-weight="700" fill="#fff">Lumen</text>
${['Overview', 'Reports', 'Customers', 'Revenue', 'Settings'].map((t, i) => `${i === 0 ? `<rect x="${x + 14}" y="${y + 78 + i * 42}" width="142" height="34" rx="10" fill="#8b5cf6" opacity="0.25"/>` : ''}<rect x="${x + 28}" y="${y + 89 + i * 42}" width="12" height="12" rx="3" fill="${i === 0 ? '#c4b5fd' : '#4b5070'}"/><text x="${x + 50}" y="${y + 100 + i * 42}" font-size="13" fill="${i === 0 ? '#fff' : '#8b90b0'}">${t}</text>`).join('')}
<text x="${x + 200}" y="${y + 46}" font-size="22" font-weight="700" fill="#fff">Good morning, Sarah 👋</text>
${pill(x + 760, y + 26, 110, 30, '#8b5cf6', '+ New report', '#fff', 12)}
${kpi(x + 200, 'Revenue', '$84.2k', '▲ 12.4%', '#34d399')}${kpi(x + 405, 'Active users', '12,480', '▲ 8.1%', '#34d399')}${kpi(x + 610, 'Churn rate', '1.9%', '▼ 0.6%', '#f472b6')}
<rect x="${x + 200}" y="${y + 186}" width="460" height="320" rx="14" fill="#1b1f36"/>
<text x="${x + 222}" y="${y + 218}" font-size="15" font-weight="700" fill="#fff">Revenue growth</text>
${pill(x + 560, y + 202, 80, 24, '#2a2f48', 'Last 30d', '#c4b5fd', 11)}
${[0, 1, 2, 3].map((i) => `<line x1="${x + 222}" x2="${x + 640}" y1="${y + 260 + i * 56}" y2="${y + 260 + i * 56}" stroke="#2a2f48"/>`).join('')}
${chart(id, x + 222, y + 250, 418, 230, [30, 42, 36, 58, 50, 72, 64, 88, 80, 104, 98, 126], '#22d3ee', 'lu-area2', 3)}
${chart(id, x + 222, y + 250, 418, 230, [40, 52, 60, 56, 78, 74, 96, 104, 118, 112, 138, 150], '#a78bfa', 'lu-area', 4)}
<rect x="${x + 680}" y="${y + 186}" width="190" height="320" rx="14" fill="#1b1f36"/>
<text x="${x + 700}" y="${y + 218}" font-size="15" font-weight="700" fill="#fff">Traffic</text>
${ring(x + 775, y + 300, 54, 0.72, '#a78bfa', '#2a2f48', 16)}${ring(x + 775, y + 300, 30, 0.48, '#22d3ee', '#2a2f48', 12)}
<text x="${x + 775}" y="${y + 306}" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">72%</text>
${bars(x + 706, y + 480, 7, 10, 14, [46, 70, 54, 86, 64, 96, 76], 'url(#lu-bar)', 4)}`;
  const floating = glassCard(id, 940, 590, 220, 120, `<text x="962" y="626" font-size="13" fill="#fff" opacity="0.85">Conversion</text><text x="962" y="668" font-size="32" font-weight="800" fill="#fff">4.86%</text>${bars(1076, 688, 4, 8, 12, [24, 38, 30, 52], '#fff', 3, 0.85)}`)
    + glassCard(id, 40, 30, 210, 74, `<circle cx="74" cy="67" r="18" fill="#34d399"/><path d="M66 67l6 6 11-12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><text x="104" y="62" font-size="13" font-weight="700" fill="#fff">Report exported</text><text x="104" y="82" font-size="11" fill="#fff" opacity="0.75">Q3 summary.pdf</text>`, 18);
  return frame({ id, bg: ['#1e1b4b', '#4c1d95', '#7c3aed'], blobs: [[150, 120, 260, '#ec4899', 0.5], [1050, 700, 320, '#06b6d4', 0.45], [700, 100, 220, '#8b5cf6', 0.6]], body: body + floating });
};

scenes['lumen-2'] = () => {
  const id = 'l2';
  const p1 = phone(id, 330, 90, 270, 560, '#121526', -6);
  const p2 = phone(id, 620, 140, 270, 560, '#ffffff', 6);
  const s1 = `${p1.open}
<defs><linearGradient id="l2-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity="0.6"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs>
<text x="${p1.x + 24}" y="${p1.y + 70}" font-size="13" fill="#8b90b0">Total revenue</text>
<text x="${p1.x + 24}" y="${p1.y + 106}" font-size="30" font-weight="800" fill="#fff">$84,210</text>
${pill(p1.x + 24, p1.y + 120, 80, 22, '#34d399', '▲ 12.4%', '#052e16', 11)}
${chart(id, p1.x + 16, p1.y + 170, p1.w - 32, 150, [20, 34, 28, 50, 44, 68, 60, 84], '#a78bfa', 'l2-area', 4)}
${['Subscriptions', 'One-time', 'Add-ons'].map((t, i) => `<rect x="${p1.x + 16}" y="${p1.y + 350 + i * 58}" width="${p1.w - 32}" height="48" rx="12" fill="#1b1f36"/><circle cx="${p1.x + 40}" cy="${p1.y + 374 + i * 58}" r="10" fill="${['#a78bfa', '#22d3ee', '#f472b6'][i]}"/><text x="${p1.x + 60}" y="${p1.y + 379 + i * 58}" font-size="13" fill="#fff">${t}</text><text x="${p1.x + p1.w - 30}" y="${p1.y + 379 + i * 58}" font-size="13" font-weight="700" text-anchor="end" fill="#fff">${['$52k', '$21k', '$11k'][i]}</text>`).join('')}
${p1.close}`;
  const s2 = `${p2.open}
<text x="${p2.x + 24}" y="${p2.y + 74}" font-size="20" font-weight="800" fill="#1e1b4b">Customers</text>
<rect x="${p2.x + 20}" y="${p2.y + 92}" width="${p2.w - 40}" height="38" rx="12" fill="#f1f3f9"/><text x="${p2.x + 38}" y="${p2.y + 116}" font-size="12" fill="#8a90a6">Search customers…</text>
${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${p2.x + 42}" cy="${p2.y + 170 + i * 62}" r="20" fill="${['#c4b5fd', '#a5f3fc', '#fbcfe8', '#bbf7d0', '#fde68a', '#c7d2fe'][i]}"/>${lines(p2.x + 74, p2.y + 160 + i * 62, [90 + (i % 3) * 20, 60], '#cbd0e0', 14, 8)}${pill(p2.x + p2.w - 80, p2.y + 160 + i * 62, 56, 20, i % 2 ? '#ede9fe' : '#dcfce7', i % 2 ? 'Trial' : 'Pro', i % 2 ? '#6d28d9' : '#15803d', 10)}`).join('')}
${p2.close}`;
  return frame({ id, bg: ['#312e81', '#6d28d9', '#a855f7'], blobs: [[200, 650, 300, '#22d3ee', 0.4], [1000, 150, 280, '#ec4899', 0.5]], body: s1 + s2 + glassCard(id, 130, 300, 190, 110, `<text x="152" y="338" font-size="12" fill="#fff" opacity="0.85">Weekly goal</text>${ring(270, 356, 26, 0.8, '#fff', 'rgba(255,255,255,0.25)', 9)}<text x="152" y="380" font-size="26" font-weight="800" fill="#fff">80%</text>`) });
};

scenes['lumen-3'] = () => {
  const id = 'l3';
  const b = browser(id, 120, 110, 960, 600, { theme: 'light', url: 'app.lumen.io/reports' });
  const { x, y } = b;
  const rows = [['Acme Corp', 'Enterprise', '$12,400', 92, '#22c55e'], ['Globex', 'Pro', '$8,210', 74, '#8b5cf6'], ['Initech', 'Pro', '$6,980', 66, '#8b5cf6'], ['Umbrella', 'Starter', '$3,120', 41, '#f59e0b'], ['Hooli', 'Enterprise', '$11,760', 88, '#22c55e'], ['Stark Ind.', 'Pro', '$7,450', 70, '#8b5cf6']];
  const body = `${b.svg}
<text x="${x + 40}" y="${y + 56}" font-size="24" font-weight="800" fill="#1e1b4b">Accounts report</text>
<text x="${x + 40}" y="${y + 80}" font-size="13" fill="#8a90a6">Updated 2 minutes ago · 1,284 accounts</text>
${pill(x + 700, y + 36, 100, 34, '#f1f3f9', 'Filter', '#4c1d95', 13)}${pill(x + 812, y + 36, 110, 34, '#7c3aed', 'Export CSV', '#fff', 13)}
<rect x="${x + 40}" y="${y + 110}" width="880" height="44" rx="10" fill="#f5f3ff"/>
${['Account', 'Plan', 'MRR', 'Health score'].map((t, i) => `<text x="${x + 64 + [0, 260, 440, 600][i]}" y="${y + 138}" font-size="12" font-weight="700" fill="#6d28d9">${t.toUpperCase()}</text>`).join('')}
${rows.map(([n, p, m, s, c], i) => {
    const ry = y + 166 + i * 58;
    return `<line x1="${x + 40}" x2="${x + 920}" y1="${ry + 52}" y2="${ry + 52}" stroke="#eef0f6"/>
<rect x="${x + 60}" y="${ry + 10}" width="32" height="32" rx="9" fill="${['#ede9fe', '#cffafe', '#fce7f3', '#fef3c7', '#dcfce7', '#e0e7ff'][i]}"/>
<text x="${x + 106}" y="${ry + 32}" font-size="14" font-weight="600" fill="#1e1b4b">${n}</text>
${pill(x + 324, ry + 14, 90, 24, '#f5f3ff', p, '#6d28d9', 11)}
<text x="${x + 504}" y="${ry + 32}" font-size="14" font-weight="700" fill="#1e1b4b">${m}</text>
<rect x="${x + 664}" y="${ry + 22}" width="180" height="8" rx="4" fill="#eef0f6"/><rect x="${x + 664}" y="${ry + 22}" width="${1.8 * s}" height="8" rx="4" fill="${c}"/>
<text x="${x + 860}" y="${ry + 31}" font-size="12" font-weight="700" fill="#4b5070">${s}</text>`;
  }).join('')}`;
  return frame({ id, bg: ['#4c1d95', '#7c3aed', '#c084fc'], blobs: [[1000, 650, 300, '#22d3ee', 0.4], [150, 100, 260, '#f472b6', 0.5]], body });
};

scenes.verde = () => {
  const id = 've';
  const b = browser(id, 110, 110, 860, 590, { url: 'verde.shop' });
  const { x, y } = b;
  const product = (px, py, name, price, fruit, bg) => `<rect x="${px}" y="${py}" width="190" height="250" rx="16" fill="#f7faf5"/>
<rect x="${px + 12}" y="${py + 12}" width="166" height="140" rx="12" fill="${bg}"/>${fruit(px + 95, py + 84)}
<text x="${px + 16}" y="${py + 180}" font-size="14" font-weight="700" fill="#14532d">${name}</text>
<text x="${px + 16}" y="${py + 200}" font-size="12" fill="#6b8f71">Organic · 1kg</text>
<text x="${px + 16}" y="${py + 232}" font-size="17" font-weight="800" fill="#14532d">${price}</text>
<circle cx="${px + 160}" cy="${py + 226}" r="16" fill="#16a34a"/><path d="M${px + 153} ${py + 226}h14M${px + 160} ${py + 219}v14" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
  const apple = (cx, cy) => `<circle cx="${cx - 14}" cy="${cy + 6}" r="34" fill="#ef4444"/><circle cx="${cx + 14}" cy="${cy + 6}" r="34" fill="#dc2626"/><ellipse cx="${cx - 18}" cy="${cy - 8}" rx="9" ry="14" fill="#fff" opacity="0.3"/><path d="M${cx} ${cy - 26}q4-18 14-22" stroke="#78350f" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M${cx + 4} ${cy - 30}q22-14 34 0q-18 12-34 0z" fill="#22c55e"/>`;
  const avocado = (cx, cy) => `<ellipse cx="${cx}" cy="${cy + 4}" rx="38" ry="50" fill="#365314"/><ellipse cx="${cx}" cy="${cy + 6}" rx="31" ry="42" fill="#bef264"/><circle cx="${cx}" cy="${cy + 16}" r="17" fill="#92400e"/><circle cx="${cx - 5}" cy="${cy + 11}" r="5" fill="#fff" opacity="0.35"/>`;
  const orange = (cx, cy) => `<circle cx="${cx}" cy="${cy + 6}" r="46" fill="#f97316"/><circle cx="${cx}" cy="${cy + 6}" r="38" fill="#fdba74"/>${[0, 45, 90, 135].map((a) => `<line x1="${cx}" y1="${cy + 6}" x2="${cx + 38 * Math.cos((a * Math.PI) / 180)}" y2="${cy + 6 + 38 * Math.sin((a * Math.PI) / 180)}" stroke="#fb923c" stroke-width="3"/><line x1="${cx}" y1="${cy + 6}" x2="${cx - 38 * Math.cos((a * Math.PI) / 180)}" y2="${cy + 6 - 38 * Math.sin((a * Math.PI) / 180)}" stroke="#fb923c" stroke-width="3"/>`).join('')}<circle cx="${cx}" cy="${cy + 6}" r="6" fill="#fff7ed"/>`;
  const leaf = (lx, ly, s, r, c) => `<path transform="translate(${lx} ${ly}) rotate(${r}) scale(${s})" d="M0 0C30-40 90-40 120 0C90 40 30 40 0 0Z" fill="${c}"/><path transform="translate(${lx} ${ly}) rotate(${r}) scale(${s})" d="M0 0H110" stroke="#fff" stroke-opacity="0.35" stroke-width="3"/>`;
  const body = `${leaf(60, 650, 1.6, -30, '#4ade80')}${leaf(1040, 120, 1.3, 150, '#86efac')}${leaf(1080, 760, 1.1, -60, '#22c55e')}
${b.svg}
<rect x="${x}" y="${y}" width="${b.w}" height="64" fill="#fff"/><line x1="${x}" x2="${x + b.w}" y1="${y + 64}" y2="${y + 64}" stroke="#eef2ea"/>
<path d="M${x + 36} ${y + 40}c6-18 26-22 34-16c-4 14-20 22-34 16z" fill="#16a34a"/><text x="${x + 78}" y="${y + 40}" font-size="20" font-weight="800" fill="#14532d">verde</text>
${['Shop', 'Boxes', 'Recipes', 'About'].map((t, i) => `<text x="${x + 300 + i * 80}" y="${y + 38}" font-size="13" fill="#4b6b50">${t}</text>`).join('')}
<circle cx="${x + b.w - 50}" cy="${y + 33}" r="18" fill="#dcfce7"/><circle cx="${x + b.w - 38}" cy="${y + 20}" r="9" fill="#16a34a"/><text x="${x + b.w - 38}" y="${y + 24}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">3</text>
<rect x="${x + 30}" y="${y + 84}" width="${b.w - 60}" height="140" rx="18" fill="#dcfce7"/>
<text x="${x + 62}" y="${y + 132}" font-size="28" font-weight="800" fill="#14532d">Fresh from the farm,</text>
<text x="${x + 62}" y="${y + 166}" font-size="28" font-weight="800" fill="#16a34a">to your door.</text>
${pill(x + 62, y + 182, 130, 30, '#16a34a', 'Shop now →', '#fff', 13)}
${leaf(x + 560, y + 160, 1.2, -20, '#22c55e')}${leaf(x + 640, y + 140, 1, 25, '#4ade80')}
${product(x + 30, y + 244, 'Crisp Apples', '$4.20', apple, '#fee2e2')}
${product(x + 236, y + 244, 'Hass Avocado', '$6.50', avocado, '#ecfccb')}
${product(x + 442, y + 244, 'Navel Oranges', '$3.90', orange, '#ffedd5')}`;
  const ph = phone(id, 880, 210, 240, 500, '#ffffff', 4);
  const phoneSvg = `${ph.open}
<text x="${ph.x + 20}" y="${ph.y + 72}" font-size="17" font-weight="800" fill="#14532d">Your basket</text>
${[['Apples', '$4.20', '#fee2e2'], ['Avocado', '$6.50', '#ecfccb'], ['Oranges', '$3.90', '#ffedd5'], ['Kale', '$2.80', '#dcfce7']].map(([n, p, c], i) => `<rect x="${ph.x + 16}" y="${ph.y + 92 + i * 64}" width="44" height="44" rx="10" fill="${c}"/><text x="${ph.x + 72}" y="${ph.y + 112 + i * 64}" font-size="13" font-weight="600" fill="#14532d">${n}</text><text x="${ph.x + 72}" y="${ph.y + 130 + i * 64}" font-size="11" fill="#6b8f71">Qty 1</text><text x="${ph.x + ph.w - 20}" y="${ph.y + 118 + i * 64}" font-size="13" font-weight="700" text-anchor="end" fill="#14532d">${p}</text>`).join('')}
<line x1="${ph.x + 16}" x2="${ph.x + ph.w - 16}" y1="${ph.y + 360}" y2="${ph.y + 360}" stroke="#eef2ea"/>
<text x="${ph.x + 20}" y="${ph.y + 390}" font-size="13" fill="#6b8f71">Total</text><text x="${ph.x + ph.w - 20}" y="${ph.y + 390}" font-size="18" font-weight="800" text-anchor="end" fill="#14532d">$17.40</text>
${pill(ph.x + 16, ph.y + 410, ph.w - 32, 44, '#16a34a', 'Checkout', '#fff', 14)}
${ph.close}`;
  return frame({ id, bg: ['#052e16', '#15803d', '#4ade80'], blobs: [[200, 150, 280, '#facc15', 0.35], [1000, 650, 300, '#a3e635', 0.45]], body: body + phoneSvg });
};

scenes['verde-2'] = () => {
  const id = 'v2';
  const b = browser(id, 170, 100, 860, 610, { url: 'verde.shop/checkout' });
  const { x, y } = b;
  const step = (i, label, done) => `<circle cx="${x + 120 + i * 210}" cy="${y + 64}" r="16" fill="${done ? '#16a34a' : '#e7efe4'}"/><text x="${x + 120 + i * 210}" y="${y + 69}" font-size="13" font-weight="700" text-anchor="middle" fill="${done ? '#fff' : '#6b8f71'}">${i + 1}</text><text x="${x + 146 + i * 210}" y="${y + 69}" font-size="13" font-weight="600" fill="#14532d">${label}</text>${i < 3 ? `<line x1="${x + 210 + i * 210}" x2="${x + 300 + i * 210}" y1="${y + 64}" y2="${y + 64}" stroke="${done ? '#16a34a' : '#e7efe4'}" stroke-width="3"/>` : ''}`;
  const field = (fx, fy, fw, label, val) => `<text x="${fx}" y="${fy}" font-size="12" font-weight="600" fill="#4b6b50">${label}</text><rect x="${fx}" y="${fy + 10}" width="${fw}" height="42" rx="10" fill="#f7faf5" stroke="#dbe7d6"/><text x="${fx + 14}" y="${fy + 36}" font-size="13" fill="#14532d">${val}</text>`;
  const body = `${b.svg}
${step(0, 'Basket', true)}${step(1, 'Delivery', true)}${step(2, 'Payment', true)}${step(3, 'Done', false)}
<rect x="${x + 40}" y="${y + 110}" width="480" height="430" rx="16" fill="#fff" stroke="#eef2ea"/>
<text x="${x + 68}" y="${y + 152}" font-size="20" font-weight="800" fill="#14532d">Payment details</text>
<rect x="${x + 68}" y="${y + 172}" width="300" height="170" rx="18" fill="#14532d"/><circle cx="${x + 330}" cy="${y + 205}" r="16" fill="#facc15" opacity="0.9"/><circle cx="${x + 310}" cy="${y + 205}" r="16" fill="#f97316" opacity="0.8"/>
<rect x="${x + 92}" y="${y + 200}" width="40" height="30" rx="6" fill="#facc15" opacity="0.85"/>
<text x="${x + 92}" y="${y + 278}" font-size="18" font-weight="600" letter-spacing="3" fill="#fff">•••• •••• •••• 4821</text>
<text x="${x + 92}" y="${y + 316}" font-size="12" fill="#bbf7d0">ADARSH PK</text><text x="${x + 330}" y="${y + 316}" font-size="12" text-anchor="end" fill="#bbf7d0">09/28</text>
${field(x + 68, y + 372, 200, 'Expiry', '09 / 28')}${field(x + 288, y + 372, 200, 'CVC', '•••')}
${pill(x + 68, y + 460, 420, 50, '#16a34a', 'Pay $17.40 securely', '#fff', 15)}
<rect x="${x + 540}" y="${y + 110}" width="280" height="430" rx="16" fill="#f0fdf4"/>
<text x="${x + 564}" y="${y + 152}" font-size="17" font-weight="800" fill="#14532d">Order summary</text>
${[['Apples', '$4.20'], ['Avocado', '$6.50'], ['Oranges', '$3.90'], ['Kale', '$2.80']].map(([n, p], i) => `<circle cx="${x + 580}" cy="${y + 194 + i * 50}" r="14" fill="${['#fca5a5', '#bef264', '#fdba74', '#86efac'][i]}"/><text x="${x + 604}" y="${y + 199 + i * 50}" font-size="13" fill="#14532d">${n}</text><text x="${x + 796}" y="${y + 199 + i * 50}" font-size="13" font-weight="700" text-anchor="end" fill="#14532d">${p}</text>`).join('')}
<line x1="${x + 564}" x2="${x + 796}" y1="${y + 400}" y2="${y + 400}" stroke="#bbf7d0"/>
<text x="${x + 564}" y="${y + 432}" font-size="13" fill="#4b6b50">Delivery</text><text x="${x + 796}" y="${y + 432}" font-size="13" font-weight="700" text-anchor="end" fill="#16a34a">Free</text>
<text x="${x + 564}" y="${y + 472}" font-size="15" font-weight="800" fill="#14532d">Total</text><text x="${x + 796}" y="${y + 472}" font-size="20" font-weight="800" text-anchor="end" fill="#14532d">$17.40</text>`;
  const badge = glassCard(id, 60, 560, 230, 90, `<circle cx="102" cy="605" r="22" fill="#fff"/><path d="M92 605l7 7 13-14" stroke="#16a34a" stroke-width="4" fill="none" stroke-linecap="round"/><text x="136" y="598" font-size="14" font-weight="700" fill="#fff">Carbon-neutral</text><text x="136" y="620" font-size="12" fill="#fff" opacity="0.8">delivery included</text>`);
  return frame({ id, bg: ['#14532d', '#16a34a', '#86efac'], blobs: [[1050, 150, 280, '#facc15', 0.4], [150, 700, 300, '#a3e635', 0.4]], body: body + badge });
};

function pulseScene(id, variant) {
  const p1 = phone(id, 300, 80, 290, 620, '#0f0f1a', -5);
  const p2 = phone(id, 620, 120, 290, 620, '#ffffff', 5);
  const hr = [50, 52, 48, 60, 30, 95, 20, 70, 52, 54, 50, 58, 34, 90, 26, 66, 52, 50];
  const hrPath = hr.map((v, i) => `${i ? 'L' : 'M'}${p1.x + 20 + i * 13.5} ${p1.y + 448 - v * 0.42}`).join(' ');
  const s1 = variant === 1
    ? `${p1.open}
<text x="${p1.x + 24}" y="${p1.y + 76}" font-size="14" fill="#a1a1c2">Today</text>
<text x="${p1.x + 24}" y="${p1.y + 108}" font-size="26" font-weight="800" fill="#fff">Activity</text>
${ring(p1.x + p1.w / 2, p1.y + 230, 92, 0.82, '#fb2c6c', '#2b1724', 20)}${ring(p1.x + p1.w / 2, p1.y + 230, 66, 0.64, '#a3e635', '#1f2a14', 20)}${ring(p1.x + p1.w / 2, p1.y + 230, 40, 0.9, '#22d3ee', '#102a31', 20)}
<text x="${p1.x + 24}" y="${p1.y + 380}" font-size="13" fill="#a1a1c2">Heart rate</text><text x="${p1.x + p1.w - 24}" y="${p1.y + 380}" font-size="16" font-weight="800" text-anchor="end" fill="#fb2c6c">128 bpm</text>
<path d="${hrPath}" fill="none" stroke="#fb2c6c" stroke-width="3.5" stroke-linejoin="round"/>
${[['Move', '612', 'kcal', '#fb2c6c'], ['Steps', '9.4k', '', '#a3e635'], ['Stand', '10', 'hr', '#22d3ee']].map(([l, v, u, c], i) => `<rect x="${p1.x + 16 + i * 86}" y="${p1.y + 460}" width="78" height="96" rx="14" fill="#1a1a2e"/><text x="${p1.x + 28 + i * 86}" y="${p1.y + 486}" font-size="11" fill="${c}">${l}</text><text x="${p1.x + 28 + i * 86}" y="${p1.y + 522}" font-size="22" font-weight="800" fill="#fff">${v}</text><text x="${p1.x + 28 + i * 86}" y="${p1.y + 542}" font-size="11" fill="#a1a1c2">${u}</text>`).join('')}
${p1.close}`
    : `${p1.open}
<defs><linearGradient id="${id}-hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb2c6c"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>
<rect x="${p1.x}" y="${p1.y}" width="${p1.w}" height="300" rx="33" fill="url(#${id}-hero)"/>
<text x="${p1.x + 24}" y="${p1.y + 84}" font-size="13" fill="#fff" opacity="0.85">Workout · 32:14</text>
<text x="${p1.x + 24}" y="${p1.y + 124}" font-size="30" font-weight="800" fill="#fff">HIIT Burn</text>
<circle cx="${p1.x + p1.w / 2}" cy="${p1.y + 210}" r="58" fill="#fff" opacity="0.2"/><circle cx="${p1.x + p1.w / 2}" cy="${p1.y + 210}" r="40" fill="#fff"/>
<rect x="${p1.x + p1.w / 2 - 14}" y="${p1.y + 194}" width="10" height="32" rx="3" fill="#fb2c6c"/><rect x="${p1.x + p1.w / 2 + 4}" y="${p1.y + 194}" width="10" height="32" rx="3" fill="#fb2c6c"/>
${['Jump squats', 'Burpees', 'Mountain climbers', 'Plank hold'].map((t, i) => `<rect x="${p1.x + 16}" y="${p1.y + 320 + i * 64}" width="${p1.w - 32}" height="54" rx="14" fill="${i === 1 ? '#2b1724' : '#1a1a2e'}"/><circle cx="${p1.x + 44}" cy="${p1.y + 347 + i * 64}" r="13" fill="${i < 1 ? '#a3e635' : i === 1 ? '#fb2c6c' : '#33334d'}"/><text x="${p1.x + 68}" y="${p1.y + 352 + i * 64}" font-size="13" font-weight="600" fill="#fff">${t}</text><text x="${p1.x + p1.w - 30}" y="${p1.y + 352 + i * 64}" font-size="12" text-anchor="end" fill="#a1a1c2">${['0:45', '0:40', '0:45', '1:00'][i]}</text>`).join('')}
${p1.close}`;
  const s2 = `${p2.open}
<text x="${p2.x + 24}" y="${p2.y + 76}" font-size="14" fill="#8a8aa6">This week</text>
<text x="${p2.x + 24}" y="${p2.y + 108}" font-size="24" font-weight="800" fill="#1a1a2e">${variant === 1 ? 'Progress' : 'Challenges'}</text>
${variant === 1
    ? `${bars(p2.x + 26, p2.y + 290, 7, 12, 20, [90, 120, 70, 150, 110, 160, 130], '#fb2c6c', 8)}${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => `<text x="${p2.x + 36 + i * 32}" y="${p2.y + 312}" font-size="11" text-anchor="middle" fill="#8a8aa6">${d}</text>`).join('')}
<rect x="${p2.x + 16}" y="${p2.y + 340}" width="${p2.w - 32}" height="90" rx="16" fill="#fff1f4"/><text x="${p2.x + 36}" y="${p2.y + 374}" font-size="12" fill="#be123c">Streak</text><text x="${p2.x + 36}" y="${p2.y + 410}" font-size="28" font-weight="800" fill="#1a1a2e">21 days 🔥</text>
<rect x="${p2.x + 16}" y="${p2.y + 446}" width="${p2.w - 32}" height="90" rx="16" fill="#f0fdf4"/><text x="${p2.x + 36}" y="${p2.y + 480}" font-size="12" fill="#15803d">Personal best</text><text x="${p2.x + 36}" y="${p2.y + 516}" font-size="28" font-weight="800" fill="#1a1a2e">5k · 24:12</text>`
    : `${[['Sam', 92, '#fb2c6c'], ['You', 84, '#f97316'], ['Priya', 71, '#a855f7'], ['Leo', 58, '#22d3ee'], ['Mia', 44, '#a3e635']].map(([n, v, c], i) => `<text x="${p2.x + 24}" y="${p2.y + 160 + i * 74}" font-size="13" font-weight="700" fill="#8a8aa6">${i + 1}</text><circle cx="${p2.x + 60}" cy="${p2.y + 156 + i * 74}" r="18" fill="${c}" opacity="0.25"/><text x="${p2.x + 60}" y="${p2.y + 161 + i * 74}" font-size="13" font-weight="800" text-anchor="middle" fill="${c}">${n[0]}</text><text x="${p2.x + 90}" y="${p2.y + 152 + i * 74}" font-size="13" font-weight="700" fill="#1a1a2e">${n}</text><rect x="${p2.x + 90}" y="${p2.y + 162 + i * 74}" width="150" height="7" rx="3.5" fill="#f1f1f6"/><rect x="${p2.x + 90}" y="${p2.y + 162 + i * 74}" width="${1.5 * v}" height="7" rx="3.5" fill="${c}"/>`).join('')}`}
${p2.close}`;
  const badge = glassCard(id, 945, 90, 220, 96, `<text x="969" y="128" font-size="13" fill="#fff" opacity="0.85">Calories burned</text><text x="969" y="168" font-size="32" font-weight="800" fill="#fff">612 kcal</text>`)
    + glassCard(id, 90, 540, 200, 96, `<circle cx="130" cy="588" r="22" fill="#fff"/><path d="M130 600s-14-9-14-18a7 7 0 0 1 14-3a7 7 0 0 1 14 3c0 9-14 18-14 18z" fill="#fb2c6c"/><text x="164" y="582" font-size="12" fill="#fff" opacity="0.8">Avg heart rate</text><text x="164" y="606" font-size="20" font-weight="800" fill="#fff">128 bpm</text>`);
  return frame({ id, bg: ['#4a044e', '#be123c', '#fb923c'], blobs: [[150, 150, 280, '#f472b6', 0.5], [1050, 650, 300, '#facc15', 0.4], [700, 400, 200, '#e11d48', 0.4]], body: s1 + s2 + badge });
}
scenes.pulse = () => pulseScene('pu', 1);
scenes['pulse-2'] = () => pulseScene('p2', 2);

scenes.nimbus = () => {
  const id = 'ni';
  const tile = (x, y, w, h, inner) => whiteCard(id, x, y, w, h, inner, 20);
  const toggle = (x, y, on) => `<rect x="${x}" y="${y}" width="52" height="30" rx="15" fill="${on ? '#3b82f6' : '#dbe3f0'}"/><circle cx="${on ? x + 37 : x + 15}" cy="${y + 15}" r="11" fill="#fff"/>`;
  const swatches = ['#1e3a8a', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'];
  const body = `
${tile(90, 90, 340, 250, `<text x="120" y="136" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">TYPOGRAPHY</text><text x="116" y="250" font-size="120" font-weight="800" fill="#0f172a">Aa</text><text x="290" y="200" font-size="13" fill="#64748b">Inter Display</text>${lines(290, 216, [100, 80, 110], '#cbd5e1', 18, 8)}<text x="120" y="310" font-size="13" font-weight="600" fill="#3b82f6">48 · 32 · 24 · 16 · 14</text>`)}
${tile(450, 90, 360, 250, `<text x="480" y="136" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">COLOUR</text>${swatches.map((c, i) => `<rect x="${480 + (i % 3) * 102}" y="${156 + Math.floor(i / 3) * 86}" width="92" height="74" rx="14" fill="${c}"/><text x="${492 + (i % 3) * 102}" y="${218 + Math.floor(i / 3) * 86}" font-size="11" font-weight="600" fill="${i < 3 ? '#fff' : '#1e3a8a'}">${[900, 700, 500, 400, 300, 100][i]}</text>`).join('')}`)}
${tile(830, 90, 280, 250, `<text x="860" y="136" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">BUTTONS</text>${pill(860, 158, 220, 44, '#3b82f6', 'Primary action', '#fff', 14)}<rect x="860" y="216" width="220" height="44" rx="22" fill="#fff" stroke="#3b82f6" stroke-width="2"/><text x="970" y="243" font-size="14" font-weight="600" text-anchor="middle" fill="#3b82f6">Secondary</text>${pill(860, 274, 220, 44, '#eff6ff', 'Ghost button', '#1d4ed8', 14)}`)}
${tile(90, 360, 300, 340, `<text x="120" y="406" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">CONTROLS</text>${['Notifications', 'Dark mode', 'Auto-save', 'Analytics'].map((t, i) => `<text x="120" y="${455 + i * 60}" font-size="14" fill="#0f172a">${t}</text>${toggle(310, 435 + i * 60, i !== 1)}`).join('')}`)}
${tile(410, 360, 420, 340, `<text x="440" y="406" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">CARD</text><defs><linearGradient id="ni-img" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><rect x="440" y="424" width="360" height="140" rx="14" fill="url(#ni-img)"/><path d="M470 540l70-60 50 40 40-30 80 50z" fill="#fff" opacity="0.4"/><circle cx="740" cy="465" r="18" fill="#fff" opacity="0.6"/><text x="440" y="598" font-size="17" font-weight="800" fill="#0f172a">Component card</text>${lines(440, 614, [320, 240], '#cbd5e1', 18, 8)}${pill(440, 652, 90, 28, '#dbeafe', 'Design', '#1d4ed8', 12)}${pill(540, 652, 70, 28, '#ede9fe', 'Docs', '#6d28d9', 12)}`)}
${tile(850, 360, 260, 340, `<text x="880" y="406" font-size="12" font-weight="700" letter-spacing="2" fill="#64748b">INPUTS</text><text x="880" y="442" font-size="12" font-weight="600" fill="#334155">Email</text><rect x="880" y="452" width="200" height="44" rx="12" fill="#fff" stroke="#3b82f6" stroke-width="2"/><text x="896" y="479" font-size="13" fill="#0f172a">you@nimbus.design</text><text x="880" y="530" font-size="12" font-weight="600" fill="#334155">Checkbox</text>${[0, 1].map((i) => `<rect x="880" y="${546 + i * 40}" width="24" height="24" rx="7" fill="${i ? '#fff' : '#3b82f6'}" stroke="${i ? '#cbd5e1' : '#3b82f6'}" stroke-width="2"/>${i ? '' : `<path d="M886 ${558 + i * 40}l5 5 8-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`}<text x="916" y="${563 + i * 40}" font-size="13" fill="#0f172a">${i ? 'Remember me' : 'Accept terms'}</text>`).join('')}<rect x="880" y="640" width="200" height="8" rx="4" fill="#dbe3f0"/><rect x="880" y="640" width="130" height="8" rx="4" fill="#3b82f6"/><circle cx="1010" cy="644" r="11" fill="#fff" stroke="#3b82f6" stroke-width="3"/>`)}`;
  return frame({ id, bg: ['#0c4a6e', '#2563eb', '#7dd3fc'], blobs: [[200, 200, 280, '#a78bfa', 0.5], [1000, 600, 320, '#22d3ee', 0.45]], body });
};

scenes.atlas = () => {
  const id = 'at';
  const b = browser(id, 120, 100, 960, 610, { url: 'atlas.travel/search' });
  const { x, y } = b;
  const body = `${b.svg}
<defs>
  <linearGradient id="at-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cffafe"/><stop offset="1" stop-color="#a5f3fc"/></linearGradient>
  <clipPath id="at-clip"><rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" rx="0"/></clipPath>
</defs>
<g clip-path="url(#at-clip)">
<rect x="${x}" y="${y}" width="${b.w}" height="${b.h}" fill="url(#at-sea)"/>
<path d="M${x - 20} ${y + 120}c80-40 160 10 230-20s120-60 200-10 60 90 140 80 120-60 200-30v220c-90 40-170-30-260 10s-140 90-230 50-160-60-280-20z" fill="#bbf7d0"/>
<path d="M${x + 520} ${y + 360}c60-30 140-10 200 30s110 40 170 10 80 20 90 60v120h-500c-30-80-10-180 40-220z" fill="#bbf7d0"/>
<path d="M${x + 60} ${y + 470}c40-30 100-20 130 10s20 70-30 80-140-40-100-90z" fill="#d9f99d"/>
${Array.from({ length: 9 }, (_, i) => `<line x1="${x + i * 120}" y1="${y}" x2="${x + i * 120}" y2="${y + b.h}" stroke="#0891b2" stroke-opacity="0.08"/>`).join('')}
${Array.from({ length: 6 }, (_, i) => `<line x1="${x}" y1="${y + i * 110}" x2="${x + b.w}" y2="${y + i * 110}" stroke="#0891b2" stroke-opacity="0.08"/>`).join('')}
<path d="M${x + 210} ${y + 430}C${x + 330} ${y + 170}, ${x + 560} ${y + 120}, ${x + 740} ${y + 240}" fill="none" stroke="#0e7490" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
<g transform="translate(${x + 520} ${y + 168}) rotate(14)"><path d="M-26 0l18-4 8-22h8l-4 22 22-2 6-8h6l-2 14 2 14h-6l-6-8-22-2 4 22h-8l-8-22-18-4z" fill="#0e7490"/></g>
${[[x + 210, y + 430, '#f43f5e'], [x + 740, y + 240, '#0e7490']].map(([px, py, c]) => `<circle cx="${px}" cy="${py}" r="30" fill="${c}" opacity="0.18"/><path d="M${px} ${py}c-18-22-24-32-24-42a24 24 0 0 1 48 0c0 10-6 20-24 42z" fill="${c}"/><circle cx="${px}" cy="${py - 42}" r="9" fill="#fff"/>`).join('')}
</g>
<rect x="${x + 40}" y="${y + 30}" width="${b.w - 80}" height="72" rx="18" fill="#fff" filter="url(#at-soft)"/>
${[['From', 'Lisbon (LIS)'], ['To', 'Kyoto (KIX)'], ['Dates', '12 – 26 Oct'], ['Guests', '2 adults']].map(([l, v], i) => `<text x="${x + 70 + i * 190}" y="${y + 60}" font-size="11" font-weight="700" fill="#64748b">${l.toUpperCase()}</text><text x="${x + 70 + i * 190}" y="${y + 84}" font-size="15" font-weight="700" fill="#0f172a">${v}</text>${i < 3 ? `<line x1="${x + 240 + i * 190}" x2="${x + 240 + i * 190}" y1="${y + 46}" y2="${y + 88}" stroke="#e2e8f0"/>` : ''}`).join('')}
${pill(x + b.w - 180, y + 46, 120, 40, '#0891b2', 'Search', '#fff', 14)}`;
  const card = whiteCard(id, 760, 430, 360, 220, `<defs><linearGradient id="at-photo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f472b6"/><stop offset="0.5" stop-color="#fb923c"/><stop offset="1" stop-color="#facc15"/></linearGradient></defs>
<rect x="776" y="446" width="130" height="188" rx="14" fill="url(#at-photo)"/><circle cx="841" cy="520" r="26" fill="#fff" opacity="0.6"/><path d="M786 634l40-60 30 34 20-20 30 46z" fill="#7c2d12" opacity="0.55"/><path d="M820 600h40l-6-24h-28z M814 600h52v6h-52z" fill="#7c2d12" opacity="0.7"/>
<text x="924" y="476" font-size="12" font-weight="700" fill="#0891b2">FLIGHT + HOTEL</text><text x="924" y="502" font-size="18" font-weight="800" fill="#0f172a">Kyoto, Japan</text><text x="924" y="524" font-size="12" fill="#64748b">14 nights · Ryokan stay</text>
<text x="924" y="552" font-size="13" fill="#f59e0b">★★★★★ <tspan fill="#64748b">4.9</tspan></text>
<text x="924" y="596" font-size="24" font-weight="800" fill="#0f172a">$1,840</text><text x="924" y="616" font-size="11" fill="#64748b">per person</text>
${pill(1040, 582, 64, 32, '#0891b2', 'Book', '#fff', 13)}`, 20)
    + glassCard(id, 70, 560, 230, 92, `<circle cx="110" cy="606" r="22" fill="#fff"/><text x="110" y="613" font-size="20" text-anchor="middle">✈</text><text x="144" y="598" font-size="14" font-weight="700" fill="#fff">LIS → KIX</text><text x="144" y="620" font-size="12" fill="#fff" opacity="0.8">Departs 08:40 · 1 stop</text>`);
  return frame({ id, bg: ['#083344', '#0891b2', '#5eead4'], blobs: [[150, 150, 260, '#38bdf8', 0.5], [1050, 650, 300, '#fbbf24', 0.35]], body: body + card });
};

scenes.ember = () => {
  const id = 'em';
  const cup = (cx, cy, s = 1, body = '#fff7ed') => `<g transform="translate(${cx} ${cy}) scale(${s})">
<path d="M-40 -58c-8-16 8-24 0-40M0 -58c-8-16 8-24 0-40M40 -58c-8-16 8-24 0-40" stroke="#fde68a" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M-80 -40h160l-16 110a30 30 0 0 1-30 26h-68a30 30 0 0 1-30-26z" fill="${body}"/>
<path d="M78 -16h16a28 28 0 0 1 0 56h-24" stroke="${body}" stroke-width="14" fill="none"/>
<path d="M-60 0h120" stroke="#ea580c" stroke-width="10" stroke-linecap="round"/>
<ellipse cx="0" cy="-40" rx="80" ry="12" fill="#7c2d12"/></g>`;
  const body = `
<circle cx="390" cy="400" r="220" fill="#fff" opacity="0.08"/><circle cx="390" cy="400" r="160" fill="#fff" opacity="0.08"/>
${cup(390, 410, 1.5)}
<text x="390" y="640" font-size="56" font-weight="800" text-anchor="middle" letter-spacing="10" fill="#fff7ed">EMBER</text>
<text x="390" y="676" font-size="14" font-weight="600" text-anchor="middle" letter-spacing="8" fill="#fed7aa">COFFEE ROASTERS · EST. 2014</text>
<defs><linearGradient id="em-bag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c0f0a"/><stop offset="0.5" stop-color="#3b1d12"/><stop offset="1" stop-color="#1c0f0a"/></linearGradient></defs>
<g filter="url(#em-shadow)" transform="rotate(6 830 420)">
  <path d="M700 200h260l20 40v400a20 20 0 0 1-20 20h-260a20 20 0 0 1-20-20v-400z" fill="url(#em-bag)"/>
  <path d="M700 200h260l20 40h-300z" fill="#4a2617"/>
  <rect x="720" y="300" width="220" height="240" rx="12" fill="#fff7ed"/>
  ${cup(830, 400, 0.55, '#7c2d12')}
  <text x="830" y="476" font-size="24" font-weight="800" text-anchor="middle" letter-spacing="4" fill="#7c2d12">EMBER</text>
  <text x="830" y="500" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="3" fill="#c2410c">HOUSE BLEND · 250G</text>
  <text x="830" y="522" font-size="10" text-anchor="middle" fill="#9a3412">Notes of cocoa, cherry &amp; caramel</text>
</g>
${glassCard(id, 930, 100, 220, 170, `<text x="952" y="134" font-size="12" font-weight="700" letter-spacing="2" fill="#fff">PALETTE</text>${['#7c2d12', '#ea580c', '#fdba74', '#fff7ed'].map((c, i) => `<circle cx="${976 + i * 46}" cy="${180}" r="20" fill="${c}" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/>`).join('')}<text x="952" y="238" font-size="13" fill="#fff" opacity="0.85">Roast · Flame · Crema · Milk</text>`)}
${glassCard(id, 980, 560, 180, 140, `<text x="1002" y="594" font-size="12" font-weight="700" letter-spacing="2" fill="#fff">TYPE</text><text x="1000" y="664" font-size="64" font-weight="800" fill="#fff7ed">Ag</text><text x="1100" y="664" font-size="12" fill="#fed7aa">Bold</text>`)}
${glassCard(id, 70, 90, 200, 80, `<text x="92" y="124" font-size="12" fill="#fff" opacity="0.85">Brand recognition</text><text x="92" y="154" font-size="24" font-weight="800" fill="#fff">+48%</text>${bars(200, 156, 4, 6, 10, [14, 22, 18, 34], '#fde68a', 3)}`)}`;
  return frame({ id, bg: ['#431407', '#9a3412', '#f59e0b'], blobs: [[300, 300, 300, '#fb923c', 0.45], [1000, 700, 300, '#7c2d12', 0.6], [1050, 120, 220, '#fde047', 0.35]], body, accent: '#fde68a' });
};

// ---------- write ----------
fs.mkdirSync(OUT, { recursive: true });
for (const [name, fn] of Object.entries(scenes)) {
  const svg = fn().replace(/\n\s*/g, '\n');
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  console.log(`✓ ${name}.svg  (${(svg.length / 1024).toFixed(1)} KB)`);
}
