// build-labs.mjs: the interactive labs listed in labs/labs.json.
// Each source page (labs/src/*.html, exported from Claude artifacts) becomes dist/labs/<slug>/index.html with a
// "← All labs" link, its own metadata and no GitHub or claude.ai links. A folder labs/src/<slug>/ next to the page
// is copied in as well (for pages that load their own files). The /labs/ gallery uses the same header and footer as
// the other pages, with one section per entry in SECTIONS. The labs are also added to sitemap.xml and llms.txt.
// Runs after build-pages.mjs, before build.mjs.
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const BASE = 'https://hnasr.com';
const labs = JSON.parse(fs.readFileSync('labs/labs.json', 'utf8'));
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// exact text fixes for copies of Claude artifacts; each must match exactly once or the build stops
const PATCHES = {
  humanity: [
    ['The live Historian needs Claude, which isn’t available in this view. Here are the most relevant entries from the dataset:', 'Here are the most relevant entries from the dataset:'],
    // the first frame can arrive before the page's own clock, which made the time step negative and walked a particle off its path
    ['const rdt=Math.min(.25,(now-lastT)/1000), dt=Math.min(.05,rdt);', 'const rdt=Math.max(0,Math.min(.25,(now-lastT)/1000)), dt=Math.min(.05,rdt);'],
    ['if(t>1) t-=1; f.t[i]=t;', 'if(t>1) t-=1; else if(t<0) t+=1; f.t[i]=t;'],
  ],
  // this link needs a login to a NAV test system, so visitors get the name without the link
  'careos-twin': [
    ['<a href="https://epj.ekstern.dev.nav.no" target="_blank" rel="noopener">nav-epj</a>', 'nav-epj'],
  ],
  // gorgov.com currently serves an expired certificate; keep the name, drop the link until it is renewed
  'gorgov-valley': [
    ['<a href="https://gorgov.com" target="_blank" rel="noopener">gorgov.com ↗</a>', 'gorgov.com'],
  ],
};

// gallery sections, in page order; each lab picks one with "section" in labs.json
const SECTIONS = [
  ['body', 'Science & the body'],
  ['story', 'Faith, history & economy'],
  ['space', 'Space & 3D architecture'],
  ['games', 'Games & worlds'],
  ['tools', 'Tools & dashboards'],
];
for (const m of labs) if (!SECTIONS.some(([id]) => id === m.section)) throw new Error(`${m.slug}: unknown section "${m.section}"`);

const BACK_CSS = '.hn-back{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:inline-flex;align-items:center;gap:0;height:40px;min-width:40px;padding:0 12px;box-sizing:border-box;border-radius:999px;background:rgba(9,11,14,.78);color:#ece6d8;border:1px solid rgba(255,255,255,.18);font:500 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;white-space:nowrap;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:border-color .25s}.hn-back:hover{border-color:rgba(255,255,255,.45)}.hn-back:focus-visible{outline:2px solid #ff5b26;outline-offset:2px}.hn-back-t{display:inline-block;max-width:0;overflow:hidden;opacity:0;margin-left:0;transition:max-width .35s,opacity .25s,margin-left .35s}.hn-back:hover .hn-back-t,.hn-back:focus-visible .hn-back-t{max-width:90px;opacity:1;margin-left:8px}@media (max-width:760px){.hn-back-t{max-width:90px;opacity:1;margin-left:8px}}@media (prefers-reduced-motion:reduce){.hn-back,.hn-back-t{transition:none}}' +
  // corners other than bottom-right, chosen by BACK_JS when a lab has its own controls there
  '.hn-back[data-corner="bl"]{right:auto;left:calc(12px + env(safe-area-inset-left,0px))}.hn-back[data-corner="tr"]{bottom:auto;top:calc(12px + env(safe-area-inset-top,0px))}.hn-back[data-corner="tl"]{right:auto;bottom:auto;left:calc(12px + env(safe-area-inset-left,0px));top:calc(12px + env(safe-area-inset-top,0px))}' +
  // busy labs: the middle of a side edge (usually 3D view, not controls), and an arrow-only 40px button
  '.hn-back[data-corner="mr"]{bottom:auto;top:50%;transform:translateY(-50%)}.hn-back[data-corner="ml"]{right:auto;bottom:auto;left:calc(12px + env(safe-area-inset-left,0px));top:50%;transform:translateY(-50%)}.hn-back.is-compact{width:40px;padding:0;justify-content:center}.hn-back.is-compact .hn-back-t{max-width:0!important;opacity:0!important;margin-left:0!important}';

// The back button must never sit on a lab's own controls (on phones it covered Corpus's "Layers", LIFE's "Animals
// today" and the NORGE EVA toolbars). After load, and whenever the lab's interface changes (throttled to once a second)
// or the screen is resized or rotated: keep the current place while it is free; otherwise try the four corners, then the
// middle of the right and left edges, first full size and then as a 40px arrow, and take the first place with no
// button, link, field, tab or slider underneath. If nothing is free, the arrow goes where it covers least.
const BACK_JS = `(()=>{const b=document.querySelector('.hn-back');if(!b||!document.elementsFromPoint||!window.MutationObserver)return;
const CTRL='button,a[href],input,select,textarea,[role="button"],[role="tab"],[role="slider"],[role="link"]';
const hits=()=>{const r=b.getBoundingClientRect();let n=0;for(const[x,y]of[[r.left+r.width/2,r.top+r.height/2],[r.left+3,r.top+3],[r.right-3,r.top+3],[r.left+3,r.bottom-3],[r.right-3,r.bottom-3]]){if(document.elementsFromPoint(x,y).some(e=>e!==b&&!b.contains(e)&&e.matches(CTRL)))n++}return n};
const P=['br','bl','tr','tl','mr','ml'];
const place=()=>{b.dataset.corner=b.dataset.corner||'br';if(!hits())return;
for(const compact of[b.classList.contains('is-compact'),true]){b.classList.toggle('is-compact',compact);for(const c of P){b.dataset.corner=c;if(!hits())return}}
let best=['br',1e9];for(const c of P){b.dataset.corner=c;const n=hits();if(n<best[1])best=[c,n]}b.dataset.corner=best[0]};
let last=0,q=0;const soon=()=>{if(q)return;q=setTimeout(()=>{q=0;last=Date.now();place()},Math.max(150,1000-(Date.now()-last)))};
addEventListener('load',()=>{setTimeout(place,1200);new MutationObserver(soon).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','aria-expanded']})});
addEventListener('resize',soon);addEventListener('orientationchange',soon);})();`;

const GALLERY_CSS = `
.labs{padding-block:clamp(120px,14vw,168px) clamp(64px,8vw,112px)}
.labs .section-head{margin-bottom:clamp(28px,4vw,48px)}
.lab-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px}
.lab-card{border:1px solid var(--line);border-radius:18px;background:var(--surface);overflow:hidden;transition:border-color .3s,transform .5s cubic-bezier(.2,.8,.2,1)}
.lab-card:hover,.lab-card:focus-within{border-color:var(--line-strong);transform:translateY(-3px)}
.lab-link{display:block;height:100%;color:inherit;text-decoration:none}
.lab-link:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:18px}
.lab-thumb{display:block;aspect-ratio:16/10;overflow:hidden;background:radial-gradient(120% 90% at 70% 30%,#15171b,#0b0c0e)}
.lab-thumb img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .8s cubic-bezier(.2,.8,.2,1)}
.lab-card:hover .lab-thumb img{transform:scale(1.04)}
.lab-body{display:grid;gap:6px;padding:18px 20px 20px}
.lab-kind{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.lab-title{font-size:20px;font-weight:500;letter-spacing:-.02em;line-height:1.2}
.lab-sub{font-size:14px;color:var(--text);opacity:.85}
.lab-desc{font-size:14px;line-height:1.55;color:var(--muted)}
.lab-open{margin-top:8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text)}
.lab-open span{display:inline-block;transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.lab-card:hover .lab-open span{transform:translateX(4px)}
.lab-note{margin-top:28px;font-size:12px;letter-spacing:.04em;color:var(--muted)}
.lab-h{margin:clamp(40px,6vw,64px) 0 18px;font-size:12px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
@media (prefers-reduced-motion:reduce){.lab-card,.lab-thumb img,.lab-open span{transition:none;transform:none!important}}
`;

// links that do not work for visitors (GitHub, and claude.ai artifacts, which are private): keep the text, drop the link
const stripDeadLinks = s => s.replace(/<a\b[^>]*\bhref=["']https?:\/\/(?:www\.)?(?:github\.com|claude\.ai)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');

function buildLab(m) {
  let s = fs.readFileSync(m.src, 'utf8');
  for (const [from, to] of PATCHES[m.slug] || []) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${m.slug}: expected one match for a patch, found ${n}`);
    s = s.replace(from, to);
  }
  s = stripDeadLinks(s);
  const url = `${BASE}/labs/${m.slug}/`;
  const head = [
    /<meta[^>]+name=["']description["']/i.test(s) ? '' : `<meta name="description" content="${esc(m.desc)}">`,
    /<link[^>]+rel=["']canonical["']/i.test(s) ? '' : `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${esc(m.title)} · Hassan Nasr"><meta property="og:description" content="${esc(m.desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${BASE}/assets/labs/${m.slug}.webp"><meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="robots" content="index,follow"><style id="hn-back">${BACK_CSS}</style>`,
  ].join('');
  const headEnd = s.indexOf('</head>');
  if (headEnd < 0 || !/<body\b/i.test(s)) throw new Error(`${m.slug}: no <head> or <body> found`);
  s = s.slice(0, headEnd) + head + s.slice(headEnd);
  const body = s.match(/<body\b[^>]*>/i);
  const end = body.index + body[0].length;
  s = s.slice(0, end) + `<a class="hn-back" href="/labs/" aria-label="All labs"><span aria-hidden="true">←</span><span class="hn-back-t">All labs</span></a><script id="hn-back-js">${BACK_JS}</script>` + s.slice(end);
  fs.mkdirSync(path.join(DIST, 'labs', m.slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'labs', m.slug, 'index.html'), s);
  const own = path.join('labs', 'src', m.slug); // extra files the page loads, e.g. labs/src/dgc-deck/artifact-type/
  if (fs.existsSync(own) && fs.statSync(own).isDirectory()) fs.cpSync(own, path.join(DIST, 'labs', m.slug), { recursive: true });
  return (s.length / 1024).toFixed(0) + ' KB';
}

function buildGallery() {
  // same header, footer and scripts as the other pages (taken from an already built internal page)
  const shell = fs.readFileSync(path.join(DIST, 'space', 'index.html'), 'utf8');
  const header = shell.slice(shell.indexOf('<header class="header">'), shell.indexOf('</header>') + 9).replace('href="labs/"', 'href="labs/" aria-current="page"');
  const footer = shell.slice(shell.indexOf('<footer class="footer wrap">'), shell.indexOf('</footer>') + 9);
  const pre = shell.slice(shell.indexOf('>', shell.indexOf('<body')) + 1, shell.indexOf('<header class="header">')); // progress bar and skip link
  const tail = shell.slice(shell.indexOf('</footer>') + 9, shell.indexOf('</body>'));
  const url = `${BASE}/labs/`;
  const title = 'Labs & games · Hassan Nasr';
  const desc = 'Interactive 3D labs, space and architecture models, playable games and tools by Hassan Nasr: human anatomy, the history of life, the world’s faiths, Norway’s economy and more. Each one works on its own page.';
  const card = m => {
    const has = fs.existsSync(path.join(DIST, 'assets', 'labs', `${m.slug}.webp`));
    const img = has ? `<img src="assets/labs/${m.slug}.webp" alt="" width="640" height="400" loading="lazy" decoding="async">` : '';
    return `<li class="lab-card"><a class="lab-link" href="labs/${m.slug}/"><span class="lab-thumb" aria-hidden="true">${img}</span><span class="lab-body"><span class="lab-kind mono">${esc(m.kind)}</span><strong class="lab-title">${esc(m.title)}</strong><span class="lab-sub">${esc(m.subtitle)}</span><span class="lab-desc">${esc(m.desc)}</span><span class="lab-open mono">Open lab <span aria-hidden="true">→</span></span></span></a></li>`;
  };
  const sectionsHtml = SECTIONS.map(([id, label]) => {
    const items = labs.filter(m => m.section === id);
    if (!items.length) return '';
    return `  <h2 class="lab-h mono">${esc(label)}</h2>\n  <ul class="lab-grid">\n      ${items.map(card).join('\n      ')}\n  </ul>\n`;
  }).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="/">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${BASE}/assets/og-image.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="app.min.css"><style>${GALLERY_CSS}</style></head><body>
${pre}${header}
<main id="main" class="labs wrap">
  <header class="section-head"><span class="kicker mono">Labs &amp; games</span><h1>Learn by <em>exploring.</em></h1><p>Some ideas are easier to understand by touching them: the human body in 3D, the history of life, the world’s faiths, Norway’s economy and the models behind spacecraft and buildings. Some things are better played, so the games and worlds run in your browser too.</p></header>
${sectionsHtml}  <p class="lab-note mono">Labs run in your browser. Those with 3D graphics need WebGL, which most phones and computers support.</p>
</main>
${footer}${tail}</body></html>
`;
  fs.mkdirSync(path.join(DIST, 'labs'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'labs', 'index.html'), html);
}

const sizes = labs.map(m => `${m.slug} ${buildLab(m)}`);
buildGallery();

// sitemap.xml (rewritten by build-pages.mjs each run; the lab entries are removed first so repeated runs stay identical)
const sm = path.join(DIST, 'sitemap.xml');
let xml = fs.readFileSync(sm, 'utf8').replace(/\s*<url>\s*<loc>https:\/\/hnasr\.com\/labs\/[\s\S]*?<\/url>/g, '');
const urls = [`/labs/`, ...labs.map(m => `/labs/${m.slug}/`)].map(p => `  <url><loc>${BASE}${p}</loc></url>`).join('\n');
xml = xml.replace('</urlset>', `${urls}\n</urlset>`);
fs.writeFileSync(sm, xml);

// llms.txt: a plain list for AI assistants (build-pages.mjs rewrites the file each run; the section is replaced, not repeated)
const lf = path.join(DIST, 'llms.txt');
let txt = fs.readFileSync(lf, 'utf8').replace(/\n## Interactive labs\n[\s\S]*?(?=\n## |\s*$)/, '');
txt = txt.replace(/\s*$/, '\n') + '\n## Interactive labs\n' + labs.map(m => `- [${m.title}: ${m.subtitle}](${BASE}/labs/${m.slug}/): ${m.desc}`).join('\n') + '\n';
fs.writeFileSync(lf, txt);

console.log(`Labs: ${labs.length} pages + /labs/ gallery (${sizes.join(', ')})`);
