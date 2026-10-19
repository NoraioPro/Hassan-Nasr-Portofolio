# Hassan Nasr — Portfolio

Personal website of **Hassan Nasr**, CTO at Medioteq AS (Oslo): AI architecture, health technology, enterprise software and digital transformation.

The site is static HTML, CSS and JavaScript in `dist/`. There is no framework and no `npm install`. Small Node scripts regenerate the data-driven sections, build the internal pages and minify the assets.

## What's on the site

| Section | What it is |
|---|---|
| **Hero** | Name, portrait that follows the pointer, live Oslo clock, "Now" card |
| **Frontiers** | Four full-bleed "worlds" with a portal entry on scroll: **Orbit** (three.js satellite over a lit Earth), **Clinic** (interactive clinical-platform architecture), **Lab** (5-axis robot cell with inverse kinematics, vision and pick-and-sort), **Twin** (digital twins + the voiced neural portrait) |
| **About** | Background and focus areas |
| **Journey** | Career timeline 2005 → today with a year odometer, career map and LinkedIn photo galleries |
| **Credentials** | Awards and certifications with verify links |
| **Selected work** | Featured projects and product families |
| **Live on the web** | Live client websites and own deployments with screenshots, logos and extracted **brand kits** (colour palette + typography) on flip cards |
| **Workshops** | AI workshops for leaders, readiness check and booking |
| **Contact** | Contact form (FormSubmit) |

Internal pages are generated from the same sections: `/space/`, `/medical/`, `/robotics/`, `/digital-twin/`, `/projects/`, `/credentials/`, `/workshops/`, `/about/`.

## Project layout

```
dist/                     ← the website (deploy this folder)
  index.html              ← home page (also the source the internal pages are cut from)
  <page>/index.html       ← generated internal pages
  site.css, *.css         ← stylesheets (bundled into app.min.css)
  site.js, *.js           ← scripts (minified into dist/min/)
  space3d.js, robot3d.js  ← three.js scenes (loaded lazily from jsDelivr)
  assets/                 ← images: journey/, clients/, live/, avatar/, awards/ …
portfolio.json            ← GitHub repositories
deployments.json          ← own live deployments (status, URL, screenshot, brand kit)
clients.json              ← client websites (category, screenshot, logo, brand kit)
site.config.mjs           ← production URL (BASE_URL)
update-portfolio.mjs      ← regenerates projects + live section, then runs the two build steps
build-pages.mjs           ← internal pages, SEO tags, JSON-LD, sitemap.xml, robots.txt, manifest
build.mjs                 ← CSS bundle (app.min.css) + minified scripts (dist/min/) via esbuild
site-cards.mjs            ← shared markup for the website cards and brand kits
preview.mjs               ← tiny local web server
audit-links.mjs           ← checks internal anchors/files and external links
ROADMAP.md                ← next steps
```

## Requirements

- **Node.js 20+** (developed on Node 22)
- Internet access the first time you run `build.mjs`: it uses `npx esbuild@0.24.0`

## Run it locally

```bash
node preview.mjs
```

Then open http://127.0.0.1:4173.

## Build

After any content or code change, run the full pipeline:

```bash
node update-portfolio.mjs
```

This regenerates the featured projects and the "Live on the web" section, rebuilds all internal pages and SEO files, and re-minifies CSS and JS. It is safe to run repeatedly: running it twice produces the same output.

To re-minify only (after editing CSS or JS):

```bash
node build.mjs
```

Check links before publishing:

```bash
node audit-links.mjs
```

## Editing content

| To change… | Edit | Then run |
|---|---|---|
| Featured projects | the `projects` list in `update-portfolio.mjs` | `node update-portfolio.mjs` |
| Own live deployments | `deployments.json` (`status`: `live`, `pending`, `unavailable`) | `node update-portfolio.mjs` |
| Client websites | `clients.json` (set `"hidden": true` to keep one but not show it) | `node update-portfolio.mjs` |
| Any other section text | `dist/index.html` directly | `node update-portfolio.mjs` |
| Styles / behaviour | `dist/*.css` / `dist/*.js` (not the files in `dist/min/`) | `node build.mjs` |

Screenshots and logos for website cards live in `dist/assets/clients/` and `dist/assets/live/` as `<slug>.webp` and `<slug>-logo.webp`. Cards without a logo get a monogram in the site's brand colour.

## Deploy

The site is fully static. On **Vercel**: import this repository, set the **output directory** to `dist`, and leave the build command empty. The committed `dist/` is already built. Any static host (Netlify, GitHub Pages, Cloudflare Pages, nginx) works the same way: serve the `dist/` folder.

## Before going live

- **Domain:** set the real domain in `site.config.mjs` (`BASE_URL` is still a placeholder), then run `node update-portfolio.mjs`. Canonical URLs, Open Graph tags, the sitemap and JSON-LD all use it.
- **Contact form:** send one test message and click FormSubmit's activation email, otherwise messages won't be delivered.
- **Search engines:** submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.

See `ROADMAP.md` for the full list of next steps.

## Third-party services used at runtime

- **Google Fonts:** Inter Tight, Instrument Serif and JetBrains Mono. Brand-kit fonts are loaded on demand.
- **jsDelivr:** three.js and the Earth textures for the 3D scenes. If they can't load, the scenes fall back to lighter 2D versions.
- **FormSubmit:** delivers contact form messages by email.

## License

MIT. See [LICENSE](LICENSE).
