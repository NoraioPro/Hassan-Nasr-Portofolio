// audit-links.mjs: checks every page in dist/ for missing files, missing anchors and external links that fail.
// Links resolve the way the browser does (internal pages use <base href="/">). GitHub links are reported as findings:
// the site links to live work only. Exit code 1 when anything is broken.
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve('dist');
const pages = ['index.html', '404.html'];
for (const d of await readdir(root, { withFileTypes: true })) {
  if (d.isDirectory()) { try { await access(join(root, d.name, 'index.html')); pages.push(`${d.name}/index.html`); } catch {} }
}
const site = 'http://site.local/';
const docs = new Map();
for (const p of pages) {
  const html = await readFile(join(root, p), 'utf8');
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
  const base = html.match(/<base\s+href=["']([^"']+)["']/i)?.[1];
  const url = new URL(p.replace(/index\.html$/, ''), site).href;
  docs.set(url, { page: p, html, ids, base: new URL(base || url, url).href });
}

const findings = [], external = new Map();
for (const [url, doc] of docs) {
  // skip JSON-LD and data blocks; check real href/src attributes
  const body = doc.html.replace(/<script type="application\/(?:ld\+)?json"[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*\brel=["'](?:preconnect|dns-prefetch)["'][^>]*>/g, ''); // connection hints, not links
  for (const [, attr, ref] of body.matchAll(/\b(href|src)=["']([^"']+)["']/g)) {
    if (/^(data:|mailto:|tel:|javascript:)/i.test(ref) || ref === '#') continue;
    if (/github\.com/i.test(ref)) { findings.push({ page: doc.page, ref, status: 'github-link' }); continue; }
    const abs = new URL(ref, doc.base);
    if (abs.origin !== new URL(site).origin) {
      if (attr === 'href' || /^https?:/i.test(ref)) { const list = external.get(abs.href) || []; list.push(doc.page); external.set(abs.href, list); }
      continue;
    }
    const target = new URL(abs.pathname, site).href;
    const targetDoc = docs.get(target) || docs.get(target.endsWith('/') ? target : target + '/');
    if (abs.hash && abs.hash.length > 1) {
      const id = decodeURIComponent(abs.hash.slice(1));
      if (targetDoc && !targetDoc.ids.has(id)) findings.push({ page: doc.page, ref, status: 'missing-anchor', resolvesTo: abs.pathname + abs.hash });
      if (targetDoc) continue;
    }
    if (targetDoc) continue;
    try { await access(join(root, decodeURIComponent(abs.pathname))); }
    catch { findings.push({ page: doc.page, ref, status: 'missing-file' }); }
  }
}

async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 link-audit' } });
    return { ref: url, status: res.status, finalUrl: res.url };
  } catch (error) {
    return { ref: url, status: 'error', error: error.cause?.code || error.message };
  } finally { clearTimeout(timer); }
}
const urls = [...external.keys()], checked = [];
for (let i = 0; i < urls.length; i += 8) checked.push(...await Promise.all(urls.slice(i, i + 8).map(check)));
// 401/403/429/999 usually mean "bots not welcome" (LinkedIn, Cloudflare): reported separately for a manual look
const blocked = s => [401, 403, 429, 999].includes(s);
const bad = checked.filter(c => c.status === 'error' || (c.status >= 400 && !blocked(c.status))).map(c => ({ ...c, pages: external.get(c.ref) }));
const suspect = checked.filter(c => blocked(c.status)).map(c => ({ ...c, pages: external.get(c.ref) }));
console.log(JSON.stringify({ pages: pages.length, externalChecked: checked.length, findings, badExternal: bad, blockedForBots: suspect }, null, 2));
process.exitCode = findings.length || bad.length ? 1 : 0;
