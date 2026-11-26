// build.mjs: minifies CSS into one bundle (dist/app.min.css) and each script into dist/min/*.js with esbuild (via npx),
// then points every HTML page at the minified files. Sources stay untouched; idempotent; safe to rerun after update-portfolio.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIST = 'dist';
const CSS = ['fonts.css', 'site.css', 'enhance.css', 'extra.css', 'contact.css', 'portrait.css', 'certs.css', 'workshops.css', 'pages.css', 'focus.css', 'alive.css', 'chat.css', 'ux.css', 'theme-light.css'];
const JS = ['site.js', 'health.js', 'enhance.js', 'portrait.js', 'thinking.js', 'contact.js', 'certs.js', 'workshops.js', 'space3d.js', 'robot3d.js', 'focus.js', 'alive.js', 'chat.js'];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const esbuild = args => execFileSync(npx, ['--yes', 'esbuild@0.24.0', ...args], { stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' });

fs.mkdirSync(`${DIST}/min`, { recursive: true });
fs.writeFileSync(`${DIST}/min/_bundle.css`, CSS.filter(f => fs.existsSync(`${DIST}/${f}`)).map(f => `/* ${f} */\n` + fs.readFileSync(`${DIST}/${f}`, 'utf8')).join('\n'));
esbuild([`${DIST}/min/_bundle.css`, '--minify', '--loader:.css=css', `--outfile=${DIST}/app.min.css`, '--log-level=warning']);
fs.rmSync(`${DIST}/min/_bundle.css`);
esbuild([...JS.map(f => `${DIST}/${f}`), '--minify', `--outdir=${DIST}/min`, '--target=es2020', '--log-level=warning', '--format=esm']
  .filter(a => a !== '--format=esm'));

// Small critical CSS so the first paint has the right colours before the bundle arrives.
const FONT_PRELOADS = ['inter-tight-latin', 'instrument-serif-italic-latin', 'jetbrains-mono-latin']
  .map(f => `<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/${f}.woff2" crossorigin>`).join('\n  ');
// the saved light-theme choice is applied before first paint (no dark flash); site.js runs the button
const THEME_EARLY = '<script id="theme-early">try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}</script>';
const CRITICAL = '<style id="critical">html{background:#0b0c0e;color:#edeae3;color-scheme:dark}html[data-theme=light]{background:#f6f4ef;color:#17161a;color-scheme:light}body{margin:0;font-family:"Inter Tight","Inter Tight Fallback",system-ui,sans-serif}</style>';
const pages = [`${DIST}/index.html`, ...(fs.existsSync(`${DIST}/404.html`) ? [`${DIST}/404.html`] : []), ...fs.readdirSync(DIST, { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(`${DIST}/${d.name}/index.html`)).map(d => `${DIST}/${d.name}/index.html`)];
for (const file of pages) {
  let h = fs.readFileSync(file, 'utf8');
  // one bundle link instead of the individual stylesheets
  h = h.replace(/\s*<link rel="stylesheet" href="(?:min\/)?(?:[a-z]+\.css|app\.min\.css)">/g, '');
  h = h.replace(/\s*<style id="critical">[\s\S]*?<\/style>/, '');
  h = h.replace(/\s*<script id="theme-early">[\s\S]*?<\/script>/, '');
  h = h.replace(/(\s*)<\/head>/, `\n  ${h.includes('data-theme-toggle') ? THEME_EARLY + '\n  ' : ''}${CRITICAL}\n  <link rel="stylesheet" href="app.min.css">$1</head>`);
  // scripts -> minified copies, drop duplicates and unused scripts
  h = h.replace(/<script src="portfolio\.js" defer><\/script>\n?/g, '');
  for (const f of JS) h = h.replaceAll(`src="${f}"`, `src="min/${f}"`);
  const seen = new Set();
  h = h.replace(/<script (?:type="module" )?src="min\/[^"]+"(?: defer)?><\/script>\n?/g, m => { const k = m.match(/min\/[^"]+/)[0]; if (seen.has(k)) return ''; seen.add(k); return m; });
  // below-the-fold images: lazy + async decode (the LCP hero image keeps fetchpriority=high)
  h = h.replace(/<img(?![^>]*\bloading=)(?![^>]*fetchpriority)([^>]*)>/g, (m, rest) => `<img loading="lazy"${/\bdecoding=/.test(rest) ? '' : ' decoding="async"'}${rest}>`);
  h = h.replace(/(<img\b[^>]*?\sdecoding="async")([^>]*?)\sdecoding="async"/g, '$1$2'); // clean up earlier duplicate attributes
  // fonts are self-hosted (fonts.css): drop the Google Fonts links, preload the faces the first screen uses
  h = h.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*>/g, '');
  h = h.replace(/\s*<link\b[^>]*href="https:\/\/fonts\.googleapis\.com[^>]*>(?:<noscript>[\s\S]*?<\/noscript>)?/g, '');
  h = h.replace(/\s*<link rel="preload" as="font"[^>]*>/g, '');
  h = h.replace('<style id="critical">', `${FONT_PRELOADS}\n  <style id="critical">`);
  // preconnect to the CDN used by three.js / QR lib
  if (!h.includes('href="https://cdn.jsdelivr.net"')) h = h.replace(/(\s*)<\/head>/, '\n  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>$1</head>');
  fs.writeFileSync(file, h);
}
const kb = f => (fs.statSync(f).size / 1024).toFixed(1);
console.log(`Built app.min.css (${kb(`${DIST}/app.min.css`)} KB) and ${JS.length} minified scripts; updated ${pages.length} pages.`);
