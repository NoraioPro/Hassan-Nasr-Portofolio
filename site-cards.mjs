// Shared markup for website cards (Client work + Live projects): screenshot on the front, extracted brand kit on the back.
export const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const domain = url => new URL(url).hostname.replace(/^www\./, '');
const initials = name => name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = hex => { const [r, g, b] = rgb(hex).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const vividness = hex => { const [r, g, b] = rgb(hex); const max = Math.max(r, g, b), min = Math.min(r, g, b); const l = (max + min) / 2; const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); return s * (1 - Math.abs(l - 0.5) * 2); };
export const accentOf = colors => [...(colors || [])].sort((a, b) => vividness(b) - vividness(a)).find(c => vividness(c) > 0.18) || '#ff5b26';

export function logo(site, dir, eager = false) {
  if (site.logo) return `<span class="client-logo tone-${site.logoTone || 'light'}"><img src="${dir}/${site.slug}-logo.webp" alt="" width="48" height="48" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></span>`;
  const accent = accentOf(site.brand?.colors);
  return `<span class="client-logo client-monogram" style="--mono:${accent}" aria-hidden="true">${esc(initials(site.name))}</span>`;
}

export function siteCard({ site, dir, meta, attrs = '', vt = 'client', extraClass = '' }) {
  const [w, h] = site.shot || [800, 600];
  const host = domain(site.url);
  const colors = (site.brand?.colors || []).slice(0, 5);
  const fonts = site.brand?.fonts || [];
  const accent = accentOf(colors);
  const swatches = colors.map(c => `<button type="button" class="bk-swatch ${luminance(c) > 0.45 ? 'on-light' : 'on-dark'}" style="--c:${c}" data-hex="${c}" aria-label="Copy colour ${c.toUpperCase()}"><span class="mono">${c.toUpperCase()}</span></button>`).join('');
  const type = fonts.length
    ? `<span class="bk-aa" data-fonts="${esc(fonts.join('|'))}" style="font-family:'${esc(fonts[0])}', var(--sans)">Aa</span><span class="bk-type-meta"><span class="mono">Typography</span><strong style="font-family:'${esc(fonts[0])}', var(--sans)">${esc(fonts[0])}</strong>${fonts[1] ? `<span style="font-family:'${esc(fonts[1])}', var(--sans)">${esc(fonts[1])}</span>` : ''}</span>`
    : `<span class="bk-aa">Aa</span><span class="bk-type-meta"><span class="mono">Typography</span><strong>System font stack</strong></span>`;
  const back = `<div class="card-face card-back brand-kit" style="--k1:${colors[0] || '#15171b'};--k-accent:${accent}" aria-hidden="true" inert>` +
    `<span class="bk-head">${logo(site, dir, true)}<span><strong>${esc(site.name)}</strong><span class="mono">Brand kit · extracted from ${esc(host)}</span></span></span>` +
    `<span class="bk-label mono">Palette <em>tap to copy</em></span><span class="bk-palette">${swatches}</span>` +
    `<span class="bk-type">${type}</span>` +
    `<a class="bk-visit mono" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer">Visit site ↗</a></div>`;
  const front = `<a class="card-face card-front" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(site.name)}, ${esc(meta)} (opens in a new tab)">` +
    `<span class="client-frame"><span class="client-bar" aria-hidden="true"><i></i><i></i><i></i><span class="mono">${esc(host)}</span></span>` +
    `<span class="client-shot"><img src="${dir}/${site.slug}.webp" alt="Screenshot of the ${esc(site.name)} website" width="${w}" height="${h}" loading="lazy" decoding="async"></span></span>` +
    `<span class="client-meta">${logo(site, dir)}<span class="client-name"><strong>${esc(site.name)}</strong><span class="mono">${esc(meta)}</span></span><span class="client-go" aria-hidden="true">↗</span></span></a>`;
  return `<li class="client-card${site.featured ? ' is-featured' : ''}${extraClass}" ${attrs} style="view-transition-name: ${vt}-${site.slug}">` +
    `<div class="card-flip">${front}${back}</div>` +
    `<button type="button" class="brand-toggle mono" aria-pressed="false" aria-label="Show the ${esc(site.name)} brand kit"><span>Brand kit</span></button></li>`;
}

export const viewToggle = gridId => `<div class="view-toggle" role="group" aria-label="Card view"><button type="button" class="mono" data-view="screens" aria-controls="${gridId}" aria-pressed="true">Screens</button><button type="button" class="mono" data-view="brand" aria-controls="${gridId}" aria-pressed="false">Brand kits</button></div>`;
