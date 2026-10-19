# Roadmap: making Hassan Nasr's portfolio epic

Owner key: **Hassan** = content, decisions, accounts · **Dev** = website developer.
Effort: S (< half a day) · M (1–3 days) · L (1–2 weeks). Impact: ★ low · ★★ medium · ★★★ high.

## Quick wins (this week)

| # | Item | Effort | Impact | Owner |
|---|------|--------|--------|-------|
| 1 | Pick the production domain and set `BASE_URL` in `site.config.mjs`, then rerun `node update-portfolio.mjs` (canonical, OG, sitemap, JSON-LD all use it) | S | ★★★ | Hassan → Dev |
| 2 | Activate FormSubmit: send one real message from the contact form, click the activation email | S | ★★★ | Hassan |
| 3 | Deploy `dist/` to Vercel (output dir `dist`, no build command needed; or `node build.mjs`) | S | ★★★ | Dev |
| 4 | Submit the sitemap in Google Search Console and Bing Webmaster Tools | S | ★★ | Hassan |
| 5 | Fill the `TODO: Hassan to add` comments on the internal pages (Eduspaceno details, Medioteq material, robotics goals, workshop agendas) | M | ★★★ | Hassan |
| 6 | Delete the unused 1.7–2.3 MB PNGs in `dist/assets/` (not referenced by any page) or move them out of `dist/` | S | ★ | Dev |
| 7 | Add a real photo-based OG image if preferred over the generated one (`dist/assets/og-image.jpg`, 1200×630) | S | ★★ | Hassan |

## 30 days

| Item | Effort | Impact | Owner |
|------|--------|--------|-------|
| **Analytics**, privacy-friendly: Vercel Web Analytics or Plausible (no cookie banner needed); track booking-wizard steps, contact sends, WhatsApp clicks | S | ★★★ | Dev |
| **Form backend upgrade**: replace FormSubmit with a Vercel serverless function that sends via **Resend** (already connected); verify the sending domain, add rate limiting + honeypot check server-side, send the visitor a confirmation with the .ics | M | ★★★ | Dev |
| **Case-study template** (`/projects/<slug>/`): problem → approach → architecture diagram → outcome → stack; first two: Medioteq platform (what can be public) and Eduspaceno.com | M | ★★★ | Dev (template) · Hassan (content) |
| Perf budgets in CI: JS ≤ 200 KB min, CSS ≤ 80 KB min, LCP ≤ 2.5 s mobile, CLS ≤ 0.05; fail the build with Lighthouse CI | S | ★★ | Dev |
| Accessibility audit: axe + manual keyboard/screen-reader pass on every page; fix contrast of muted mono text | M | ★★ | Dev |

## 60 days

| Item | Effort | Impact | Owner |
|------|--------|--------|-------|
| **Insights / blog** at `/insights/` built from the section 05 topics (AI in real workflows, Healthcare & MedTech, Leading through change): Markdown → static HTML in the same build, RSS feed, Article JSON-LD | M | ★★★ | Dev · Hassan writes 1 post / 2 weeks |
| **Norwegian (i18n)**: `/no/` mirror of the home + workshops pages, `hreflang` tags, language switch in the header | L | ★★ | Dev · Hassan reviews copy |
| Workshop pages per format (`/workshops/agentic/` …) with agenda, outcomes, who it's for; Service JSON-LD per page | M | ★★ | Hassan (content) · Dev |
| Real calendar availability in the booking wizard (Cal.com or Google Calendar free/busy) instead of free-text preferred dates | M | ★★ | Dev |

## 90 days

| Item | Effort | Impact | Owner |
|------|--------|--------|-------|
| **Voice-clone portrait option**: record ~2 min of consented audio, generate the intro with a voice-cloning TTS, ship a pre-rendered MP3 + viseme timeline (keeps the site static); keep Web Speech as fallback | M | ★★★ | Hassan (recording, consent) · Dev |
| "Ask Hassan" assistant on the portrait: answers only from site content (RAG over the pages), with clear AI labelling | L | ★★ | Dev |
| **AI search visibility**: `llms.txt`, concise FAQ blocks, consistent entity data (same name/title/links on LinkedIn, GitHub, Medioteq), cite-worthy insights posts | S–M | ★★★ | Dev · Hassan |
| Talks & media page (events, hackathons, workshops delivered) with photos Hassan supplies | M | ★★ | Hassan · Dev |
| Quarterly review: analytics → which sections convert → prune or expand | S | ★★ | Hassan |
