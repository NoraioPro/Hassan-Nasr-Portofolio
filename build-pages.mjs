// build-pages.mjs: generates the internal pages in dist/<slug>/index.html from sections of dist/index.html,
// adds "Learn more" links + footer page nav + SEO tags (JSON-LD, canonical, OG/Twitter) to the home page,
// and writes sitemap.xml / robots.txt. Idempotent; update-portfolio.mjs runs it after regenerating the home page.
import fs from 'node:fs';
import { BASE_URL } from './site.config.mjs';

const DIST = 'dist';
const read = f => fs.readFileSync(f, 'utf8');
let home = read(`${DIST}/index.html`);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = p => BASE_URL.replace(/\/$/, '') + p;

// Return the outerHTML of the element carrying id="..." (balanced on its own tag name).
function extract(html, id) {
  const at = html.indexOf(` id="${id}"`); if (at < 0) return '';
  const s = html.lastIndexOf('<', at); const tag = html.slice(s + 1).match(/^[a-z0-9]+/)[0];
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g'); re.lastIndex = s; let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[0][1] === '/' ? -1 : 1; if (!depth) return html.slice(s, m.index + m[0].length); }
  return '';
}
function extractByClass(html, cls) {
  const at = html.search(new RegExp(`<section class="${cls}[ "]`)); if (at < 0) return '';
  const re = /<section[\s>]|<\/section>/g; re.lastIndex = at; let d = 0, m;
  while ((m = re.exec(html))) { d += m[0][1] === '/' ? -1 : 1; if (!d) return html.slice(at, m.index + m[0].length); }
  return '';
}

const PAGES = [
  { slug: 'space', nav: 'Space', title: 'Space & satellites', h1: 'Space & <em>satellite exploration.</em>',
    desc: 'Hassan Nasr on space and satellites: a live 3D orbit scene, 2nd place at NASA Space Apps 2025 Oslo with Eduspaceno.com, and Andøya Space Hackathon 25.',
    lead: 'Space, satellites, and the possibilities of connected intelligence. Our team took 2nd place at NASA Space Apps 2025 in Oslo with Eduspaceno.com, an AI-powered learning universe built on live NASA and ESA data.',
    sections: ['space'], frontier: true, extra: 'space' },
  { slug: 'medical', nav: 'Medical', title: 'Healthcare technology & MedTech', h1: 'Clinical AI, <em>engineered for trust.</em>',
    desc: 'Hassan Nasr, CTO of Medioteq: secure digital health with cloud platforms, HL7 FHIR interoperability, AI clinical workflows and GDPR-compliant delivery.',
    lead: 'As CTO of Medioteq, I lead the technology vision for secure, scalable digital health: cloud-native platforms, interoperability, AI-powered clinical workflows, and GDPR-compliant delivery that integrates with hospital systems and medical devices.',
    sections: ['medical'], frontier: true, extra: 'medical' },
  { slug: 'robotics', nav: 'Robotics', title: 'Robotics research track', h1: 'Intelligence <em>that moves.</em>',
    desc: 'A robotics cell running live in the browser: overhead vision, task planning and five-axis inverse kinematics. A planned research track by Hassan Nasr.',
    lead: 'A robotics cell running live in your browser. Overhead vision detects parts, a planner sequences the task, and inverse kinematics drives a five-axis arm to sort them. This is a concept system and a planned research track.',
    sections: ['robotics'], frontier: true, extra: 'robotics' },
  { slug: 'digital-twin', nav: 'Digital twin', title: 'Digital twins', h1: 'Mirror the real thing. <em>Then make it better.</em>',
    desc: 'Hassan Nasr on digital twins: living models of patients, assets and operations that sync with real data. Includes his interactive, voiced neural portrait.',
    lead: 'I design digital twins: living models of patients, assets and operations that stay in sync with real data, so teams can monitor, simulate and decide before they act. Below is my own twin, a neural portrait that follows you and can introduce me.',
    sections: ['twin'], frontier: true },
  { slug: 'projects', nav: 'Projects', title: 'Projects & live websites', h1: 'Projects <em>you can open.</em>',
    desc: 'Live websites, products and selected work by Hassan Nasr, filterable by status and industry, with brand kits.',
    lead: 'Live websites across industries, my own products, and the ideas I am building. Filter by status and industry, or switch to brand kits.',
    sections: ['live-projects', 'work'] },
  { slug: 'credentials', nav: 'Credentials', title: 'Awards & credentials', h1: 'Always learning. <em>Recognised along the way.</em>',
    desc: 'Awards and certifications of Hassan Nasr: Beste AI-Jammer at AI JAM 2025, NASA Space Apps 2025, Andøya Space Hackathon 25, Claude Academy and more.',
    lead: 'From IT Essentials in 2008 to agentic AI in 2026, with an AI award and two space hackathons along the way. Open any credential for details and a verify link.',
    sections: ['credentials'] },
  { slug: 'workshops', nav: 'Workshops', title: 'AI workshops for leaders', h1: 'AI workshops <em>for leaders.</em>',
    desc: 'Hands-on AI workshops for CEOs and leadership teams by Hassan Nasr, CTO at Medioteq: AGI briefing, strategy sprint, agentic and responsible AI.',
    lead: "I run hands-on workshops for CEOs and leadership teams who want to understand advanced AI and agentic systems, and turn them into decisions, roadmaps and working pilots. Take the readiness check, then request a date.",
    sections: ['workshops'], extra: 'workshops' },
  { slug: 'about', nav: 'About', title: 'About Hassan Nasr', h1: 'A builder’s curiosity. <em>A leader’s perspective.</em>',
    desc: 'About Hassan Nasr, CTO at Medioteq AS in Oslo: AI architecture, automation, ERP/CRM and Power Platform, and a career journey from 2005 to today.',
    lead: 'I’m Hassan, based in Oslo. My work brings together AI, software platforms, business automation, and technical leadership. Below is the journey that got me here.',
    sections: ['about', 'journey', '.perspective', 'contact'] },
];

/* ---------- shared pieces from the home page ---------- */
const headStart = home.indexOf('<head>') + 6, headEnd = home.indexOf('</head>');
const baseHead = home.slice(headStart, headEnd)
  .replace(/\s*<title>[\s\S]*?<\/title>/, '').replace(/\s*<meta name="description"[^>]*>/, '')
  .replace(/\s*<meta (property|name)="(og|twitter):[^>]*>/g, '').replace(/\s*<link rel="canonical"[^>]*>/, '')
  .replace(/\s*<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '')
  .replace(/\s*<link rel="preload" as="image"[^>]*>/g, '');
const header = home.slice(home.indexOf('<header class="header">'), home.indexOf('</header>') + 9);
const tail = home.slice(home.indexOf('</footer>') + 9, home.indexOf('</body>'));
const pageNav = PAGES.map(p => `<a href="${p.slug}/">${p.nav}</a>`).join('');
const subHeader = header.replace(/<nav id="main-nav"([^>]*)>[\s\S]*?<\/nav>/, (m, a) =>
  `<nav id="main-nav"${a}>${PAGES.map(p => `<a href="${p.slug}/" data-page="${p.slug}">${p.nav}</a>`).join('')}<a href="#contact" class="nav-contact">Let’s talk <span aria-hidden="true">↗</span></a></nav>`)
  .replace('href="#" aria-label="Hassan Nasr home"', 'href="./" aria-label="Hassan Nasr home"');
const footerFor = () => `<footer class="footer wrap"><a class="brand" href="./" aria-label="Hassan Nasr home"><span class="brand-mark">HN</span><span class="brand-dot" aria-hidden="true"></span></a><p>Hassan Nasr · Oslo, Norway</p><a href="./" class="mono">Home ↑</a><nav class="footer-pages" aria-label="Pages">${pageNav}</nav></footer>`;

/* ---------- structured data ---------- */
let creds = []; try { creds = JSON.parse(home.match(/<script type="application\/json" id="cr-data">([\s\S]*?)<\/script>/)[1]); } catch {}
for (const m of home.matchAll(/class="cr-row-main"><strong>([\s\S]*?)<\/strong><span>([\s\S]*?)<\/span>/g)) { const t = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim(); if (!creds.some(c => c.title === t)) creds.push({ title: t, issuer: m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() }); }
const workshops = [...home.matchAll(/<li class="ws-card[^"]*"[^>]*data-ws-id="([^"]+)"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g)]
  .map(m => ({ id: m[1], name: m[2].replace(/<[^>]+>/g, '').trim(), d: m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }));
const person = { '@type': 'Person', '@id': abs('/#person'), name: 'Hassan Nasr', jobTitle: 'CTO', url: abs('/'),
  image: abs('/assets/og-image.jpg'), address: { '@type': 'PostalAddress', addressLocality: 'Oslo', addressCountry: 'NO' },
  worksFor: { '@type': 'Organization', '@id': abs('/#medioteq'), name: 'Medioteq AS', url: 'https://medioteq.no' },
  sameAs: ['https://www.linkedin.com/in/h-nasr/'],
  knowsAbout: ['Artificial intelligence', 'Agentic AI', 'Healthcare technology', 'Enterprise software', 'Business automation', 'ERP and CRM integration', 'Microsoft Power Platform'] };
const credLD = creds.map(c => ({ '@type': 'EducationalOccupationalCredential', name: c.title, credentialCategory: c.award ? 'award' : (c.kind || 'certificate'),
  recognizedBy: { '@type': 'Organization', name: c.issuer }, ...(c.verify ? { url: c.verify } : {}), ...(c.date ? { dateCreated: c.date } : {}) }));
const serviceLD = workshops.map(w => ({ '@type': 'Service', name: w.name, description: w.d, serviceType: 'AI workshop', provider: { '@id': abs('/#person') },
  areaServed: ['Norway', 'Gulf region', 'Egypt', 'Remote'], offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', url: abs('/workshops/') } }));
const ld = obj => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...obj }).replace(/</g, '\\u003c')}</script>`;
const crumbLD = p => ld({ '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') }, { '@type': 'ListItem', position: 2, name: p.title, item: abs(`/${p.slug}/`) }] });

const seoHead = ({ title, desc, path }) => `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${abs(path)}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Hassan Nasr">
  <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${abs(path)}"><meta property="og:image" content="${abs('/assets/og-image.jpg')}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Hassan Nasr, CTO at Medioteq AS, Oslo">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${abs('/assets/og-image.jpg')}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="assets/icon-192.png"><link rel="manifest" href="manifest.webmanifest">`;

/* ---------- page extras (facts only from the site) ---------- */
let repos = []; try { const pj = JSON.parse(read('portfolio.json')); repos = Array.isArray(pj) ? pj : (pj.repositories || pj.repos || []); } catch {}
const repoName = r => r.full_name || r.fullName || (r.owner ? `${r.owner}/${r.name}` : r.name) || '';
const spaceRepos = repos.filter(r => /space|nasa|galax|orbit|satell|astro|rocket|cosmo|planet/i.test(`${repoName(r)} ${r.description || ''}`)).slice(0, 12);
const EXTRA = {
  space: () => `<section class="page-block wrap" aria-labelledby="sp-events"><h2 id="sp-events">Space events</h2>
  <ul class="page-facts"><li><strong>NASA International Space Apps Challenge 2025</strong><span>Oslo, October 4–5, 2025. 2nd place with Eduspaceno.com. Recognised as a “Galactic Problem Solver” for outstanding participation and efforts to address challenges on Earth and in space.</span></li>
  <li><strong>Space Hackathon 25: Andøya Space</strong><span>14–16 October 2025. Certificate of Attendance (Norwegian Space Cluster / Andøya Space Education).</span></li>
  <li><strong>Galaxy Guide Buddy</strong><span>An exploration project linked from the orbit scene above. <a href="https://galaxy-guide-buddy-rho.vercel.app" rel="noopener" target="_blank">Explore Galaxy Guide Buddy ↗</a></span></li></ul>
  <!-- TODO: Hassan to add: what Eduspaceno.com does in more detail, team members, links to the Space Apps project page. --></section>
  <section class="page-block wrap"><div class="page-cta"><a class="button button-primary" href="credentials/">See the space credentials</a><a class="button button-ghost" href="#contact">Start a conversation</a></div></section>`,
  medical: () => `<section class="page-block wrap" aria-labelledby="md-focus"><h2 id="md-focus">Focus areas</h2>
  <ul class="page-facts"><li><strong>Interoperability</strong><span>HL7 FHIR R4 and HL7 v2, connecting EHR/EPJ, medical devices (IoMT), lab and imaging systems.</span></li>
  <li><strong>Security & compliance</strong><span>EU/EEA hosting in a secure zone, GDPR and Normen.</span></li>
  <li><strong>AI governance</strong><span>Human-in-the-loop by design: clinicians stay in control of AI-powered workflows.</span></li>
  <li><strong>Role</strong><span>Chief Technology Officer at Medioteq, 2026 — now. Owns architecture, roadmap and engineering.</span></li></ul></section>
  <section class="page-block wrap" aria-labelledby="md-rel"><h2 id="md-rel">Related</h2><ul class="page-list">
  <li><a href="https://medioteq.no" rel="noopener" target="_blank">Medioteq ↗</a><small>medioteq.no</small></li>
  <li><a href="https://thefootscan.com" rel="noopener" target="_blank">The Foot Scan ↗</a><small>Healthcare website, thefootscan.com</small></li>
  <li><a href="workshops/">Healthcare & MedTech AI workshop</a><small>For clinical and MedTech leadership teams</small></li></ul>
  <!-- TODO: Hassan to add: case studies or public material on Medioteq platform work. --></section>`,
  robotics: () => `<section class="page-block wrap" aria-labelledby="rb-track"><h2 id="rb-track">The research track</h2>
  <ul class="page-facts"><li><strong>01 Perception</strong><span>Vision detects and classifies parts.</span></li><li><strong>02 Planning</strong><span>Task and path sequencing.</span></li><li><strong>03 Control</strong><span>Five-axis inverse kinematics with a minimum-jerk motion profile.</span></li></ul>
  <p>This is a concept system and a planned research track, running entirely in the browser. Use Drive mode above to take the controls.</p>
  <!-- TODO: Hassan to add: goals, timeline and any hardware for the robotics research track. --></section>`,
  workshops: () => `<section class="page-block wrap faq" aria-labelledby="ws-faq"><h2 id="ws-faq">Frequently asked questions</h2>
  <details><summary>Who are the workshops for?</summary><p>CEOs, leadership teams and decision makers who want to understand advanced AI and agentic systems and turn them into decisions, roadmaps and working pilots.</p></details>
  <details><summary>Where do they take place?</summary><p>On-site in Norway, the Gulf or Egypt, or remotely. Other locations on request.</p></details>
  <details><summary>Which languages?</summary><p>English or Norwegian. Other languages on request.</p></details>
  <details><summary>How does booking work?</summary><p>Pick a workshop, tell me about your company and format, choose up to three preferred weekdays at least two weeks ahead, and add your goals. I confirm a date by email. You can also download a tentative calendar hold and follow up on WhatsApp.</p></details>
  <details><summary>Not sure which workshop fits?</summary><p>Take the five-question AI readiness check above. It recommends a workshop and pre-selects it in the booking form.</p></details>
  <details><summary>What does it cost?</summary><p>Scope and pricing depend on format and team size, and are agreed after a short conversation.</p></details>
  <!-- TODO: Hassan to add: detailed agendas per workshop and any pricing policy. --></section>`,
};

/* ---------- write internal pages ---------- */
for (const p of PAGES) {
  const body = p.sections.map(id => id.startsWith('.') ? extractByClass(home, id.slice(1)) : extract(home, id)).filter(Boolean)
    .map(h => h.replace(/<a class="learn-more[\s\S]*?<\/a>|<p class="learn-more">[\s\S]*?<\/p>/g, '')).join('\n');
  const main = p.frontier ? `<section class="frontiers wrap page-section" aria-label="${esc(p.title)}">${body}</section>` : body;
  const cssExtra = baseHead.includes('app.min.css') || baseHead.includes('pages.css') ? '' : '\n  <link rel="stylesheet" href="pages.css">';
  const html = `<!doctype html>
<html lang="en">
<head>
  <base href="/">${baseHead.replace(/\s*<link rel="icon"[^>]*>/, '')}${seoHead({ title: `${p.title} · Hassan Nasr`, desc: p.desc, path: `/${p.slug}/` })}${cssExtra}
  ${crumbLD(p)}${p.slug === 'credentials' ? ld({ ...person, hasCredential: credLD }) : ''}${p.slug === 'workshops' ? ld({ '@type': 'OfferCatalog', name: 'AI workshops for leaders', itemListElement: serviceLD }) : ''}${p.slug === 'about' ? ld({ '@type': 'ProfilePage', mainEntity: person }) : ''}
</head>

<body class="page page-${p.slug}">
  <a class="skip" href="/${p.slug}/#main">Skip to content</a>
  <div class="progress-bar" aria-hidden="true"><span></span></div>
  ${subHeader.replace(`data-page="${p.slug}"`, `data-page="${p.slug}" aria-current="page"`)}
  <main id="main">
    <header class="page-hero wrap">
      <nav aria-label="Breadcrumb"><ol class="crumbs"><li><a href="./">Home</a></li><li aria-current="page">${esc(p.title)}</li></ol></nav>
      <h1>${p.h1}</h1>
      <p class="lead">${p.lead}</p>
    </header>
    ${main.replace(/<h1([ >])/g, '<h2$1').replace(/<\/h1>/g, '</h2>')}
    ${p.extra ? EXTRA[p.extra]() : ''}
  </main>
  ${footerFor()}${tail}</body>
</html>
`;
  fs.mkdirSync(`${DIST}/${p.slug}`, { recursive: true });
  fs.writeFileSync(`${DIST}/${p.slug}/index.html`, html);
}

/* ---------- home: learn-more links, footer nav, SEO ---------- */
home = home.replace(/<p class="learn-more">[\s\S]*?<\/p>/g, '');
const LEARN = { space: ['space/', 'Learn more about my space work'], medical: ['medical/', 'Learn more about healthcare technology'], robotics: ['robotics/', 'Learn more about the robotics track'], twin: ['digital-twin/', 'Explore my digital twin work'],
  about: ['about/', 'Learn more about me'], credentials: ['credentials/', 'See all awards & credentials'], 'live-projects': ['projects/', 'Browse all projects'], workshops: ['workshops/', 'Workshop details & FAQ'] };
for (const [id, [href, text]] of Object.entries(LEARN)) {
  const el = extract(home, id); if (!el) continue;
  const close = el.lastIndexOf('</');
  home = home.replace(el, el.slice(0, close) + `<p class="learn-more"><a href="${href}">${text} <span aria-hidden="true">→</span></a></p>` + el.slice(close));
}
home = home.replace(/<nav class="footer-pages"[\s\S]*?<\/nav>/, '').replace(/(<footer class="footer wrap">[\s\S]*?)<\/footer>/, `$1<nav class="footer-pages" aria-label="Pages">${pageNav}</nav></footer>`);
const homeTitle = 'Hassan Nasr · CTO · AI architecture & health tech · Oslo';
const homeDesc = 'Hassan Nasr, CTO at Medioteq AS in Oslo: AI architecture for health, enterprise software and digital transformation. Projects, awards and AI workshops.';
home = home.replace(/\s*<title>[\s\S]*?<\/title>/, '').replace(/\s*<meta name="description"[^>]*>/, '').replace(/\s*<meta (property|name)="(og|twitter):[^>]*>/g, '')
  .replace(/\s*<link rel="canonical"[^>]*>/, '').replace(/\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>/g, '')
  .replace(/\s*<script type="application\/ld\+json"[\s\S]*?<\/script>/g, '')
  .replace('</head>', `${seoHead({ title: homeTitle, desc: homeDesc, path: '/' })}
  ${ld({ '@graph': [{ ...person, hasCredential: credLD }, { '@type': 'Organization', '@id': abs('/#medioteq'), name: 'Medioteq AS', url: 'https://medioteq.no' }, { '@type': 'WebSite', '@id': abs('/#site'), name: 'Hassan Nasr', url: abs('/') }, { '@type': 'OfferCatalog', name: 'AI workshops for leaders', itemListElement: serviceLD }] })}
</head>`);
if (!home.includes('app.min.css') && !home.includes('href="pages.css"')) home = home.replace('</head>', '  <link rel="stylesheet" href="pages.css">\n</head>');
fs.writeFileSync(`${DIST}/index.html`, home);

/* ---------- sitemap / robots / manifest ---------- */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...PAGES.map(p => `/${p.slug}/`)].map(u => `  <url><loc>${abs(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
fs.writeFileSync(`${DIST}/manifest.webmanifest`, JSON.stringify({ name: 'Hassan Nasr', short_name: 'Hassan Nasr', start_url: '/', display: 'standalone', background_color: '#0b0c0e', theme_color: '#0b0c0e',
  icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2));
if (!fs.existsSync(`${DIST}/favicon.svg`)) fs.writeFileSync(`${DIST}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0c0e"/><path d="M18 16v32M46 16v32M18 32h28" stroke="#edeae3" stroke-width="7"/><circle cx="50" cy="14" r="6" fill="#ff5b26"/></svg>\n`);

/* ---------- 404 page (Vercel serves dist/404.html for unknown paths) ---------- */
fs.writeFileSync(`${DIST}/404.html`, `<!doctype html>
<html lang="en">
<head>
  <base href="/">${baseHead.replace(/\s*<link rel="icon"[^>]*>/, '')}
  <title>Page not found · Hassan Nasr</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
</head>
<body class="page page-404">
  <a class="skip" href="/#main">Skip to content</a>
  ${subHeader}
  <main id="main">
    <header class="page-hero wrap">
      <p class="kicker mono"><i>404</i> Lost in orbit</p>
      <h1>This page drifted <em>out of range.</em></h1>
      <p class="lead">The link may be old or mistyped. Here are the places worth visiting:</p>
      <ul class="page-list">${PAGES.map(p => `<li><a href="${p.slug}/">${p.nav}</a><small>${esc(p.title)}</small></li>`).join('')}</ul>
      <div class="page-cta"><a class="button button-primary" href="./">Back to the home page</a></div>
    </header>
  </main>
  ${footerFor()}${tail}</body>
</html>
`);

/* ---------- llms.txt: a plain summary for AI search and assistants ---------- */
fs.writeFileSync(`${DIST}/llms.txt`, `# Hassan Nasr

> CTO at Medioteq AS in Oslo, Norway. Technology leader and founder building AI architecture for health, enterprise software and digital transformation across Norway, the Gulf and Egypt.

## Pages

- [Home](${abs('/')}): Overview, frontiers (space, healthcare, robotics, digital twins), journey, credentials, projects and workshops.
${PAGES.map(p => `- [${p.title}](${abs(`/${p.slug}/`)}): ${p.desc}`).join('\n')}

## Facts

- Current role: Chief Technology Officer, Medioteq AS (2026 – present), Oslo.
- Previous: CTO at DGC (Digital Game Changers), UAE, 2021 – 2025; Founder & Technical Director, Gorgov Digital, 2013 – 2025.
- Recognition: 1st place and Best Vibecoder, AI Jam Norway 2025; 2nd place, NASA Space Apps 2025 Oslo.
- Focus: AI and agentic systems, healthcare technology and interoperability (HL7 FHIR), digital twins, ERP/CRM and Power Platform automation.

## Contact

- LinkedIn: https://www.linkedin.com/in/h-nasr/
- Website contact form: ${abs('/#contact')}
`);
console.log(`Pages: ${PAGES.map(p => '/' + p.slug + '/').join(' ')} · ${spaceRepos.length} space repos · ${creds.length} credentials · ${workshops.length} workshops in JSON-LD`);
