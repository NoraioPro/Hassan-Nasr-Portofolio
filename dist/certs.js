/* certs.js: Awards & Credentials (filters, search, holo tilt, lightbox, stats, timeline) */
(() => {
  const sec = document.querySelector('#credentials');
  if (!sec) return;
  const html = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => rm.matches || html.classList.contains('motion-paused');
  const data = JSON.parse(sec.querySelector('#cr-data')?.textContent || '[]');
  const items = [...sec.querySelectorAll('.cr-feat, .cr-row')];
  const chips = [...sec.querySelectorAll('[data-cr-filter]')], dots = [...sec.querySelectorAll('.cr-dot')];
  const search = sec.querySelector('#cr-search'), countEl = sec.querySelector('.cr-count'), empty = sec.querySelector('.cr-empty');
  let cat = 'all';
  function apply() {
    const words = (search?.value || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    let n = 0;
    items.forEach(it => { const ok = (cat === 'all' || it.dataset.cats.split(' ').includes(cat)) && words.every(w => it.dataset.search.includes(w)); it.hidden = !ok; if (ok) n++; });
    dots.forEach(d => { const it = items.find(i => i.dataset.cid === d.dataset.target); d.classList.toggle('is-dim', !!it && it.hidden); });
    chips.forEach(ch => ch.setAttribute('aria-pressed', String(ch.dataset.crFilter === cat)));
    sec.querySelectorAll('.cr-featured-row, .cr-list').forEach(g => { g.hidden = ![...g.children].some(c => !c.hidden); });
    empty.hidden = n > 0;
    countEl.textContent = `Showing ${n} of ${items.length}`;
  }
  const run = () => { if (document.startViewTransition && !paused()) { const t = document.startViewTransition(apply); t.ready.catch(() => {}); t.finished.catch(() => {}); } else apply(); };
  chips.forEach(ch => ch.addEventListener('click', () => { cat = ch.dataset.crFilter; run(); }));
  search?.addEventListener('input', apply);
  sec.querySelector('.cr-reset')?.addEventListener('click', () => { cat = 'all'; if (search) search.value = ''; run(); });
  apply();

  /* copy */
  const copy = btn => {
    const done = ok => { btn.textContent = ok ? 'Copied ✓' : 'Select & copy'; btn.classList.toggle('is-ok', ok); setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-ok'); }, 1500); };
    const sel = () => { const code = btn.parentElement.querySelector('code'); const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(btn.dataset.copy).then(() => done(true), () => { sel(); done(false); }); else { sel(); done(false); }
  };

  /* lightbox */
  const lb = sec.querySelector('.cr-lightbox');
  const q = s => lb.querySelector(s);
  let idx = 0, zoom = false;
  const img = q('.cr-lb-media img'), zoomBtn = q('.cr-lb-zoom');
  const setZoom = on => { zoom = on; lb.classList.toggle('is-zoom', on); zoomBtn.setAttribute('aria-pressed', String(on)); zoomBtn.textContent = on ? 'Zoom −' : 'Zoom +'; if (!on) img.style.transformOrigin = ''; };
  function show(i) {
    idx = (i + data.length) % data.length; const d = data[idx]; setZoom(false);
    img.src = d.img; img.alt = `${d.title}, ${d.issuer} (${d.date})`;
    q('[data-lb-badges]').innerHTML = `${d.award ? '<span class="cr-badge-award">★ Award</span>' : ''}<span>${d.kind}</span><span>${d.date}</span>`;
    q('[data-lb-title]').textContent = d.title; q('[data-lb-issuer]').textContent = d.issuer;
    const qt = q('[data-lb-quote]'); qt.hidden = !d.quote; qt.textContent = d.quote ? `“${d.quote}”` : '';
    q('[data-lb-desc]').textContent = d.desc;
    const id = q('[data-lb-id]'); id.hidden = !d.cred; id.querySelector('code').textContent = d.cred; id.querySelector('button').dataset.copy = d.cred;
    const v = q('[data-lb-verify]'); v.hidden = !d.url; if (d.url) v.href = d.url;
    q('[data-lb-space]').hidden = !d.space;
    q('[data-lb-count]').textContent = `${idx + 1} / ${data.length}`;
  }
  function open(id) { const i = data.findIndex(d => d.id === id); if (i < 0) return; show(i); if (!lb.open) lb.showModal(); q('.cr-lb-close').focus(); }
  sec.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) { open(o.dataset.open); return; }
    const c = e.target.closest('.cr-copy'); if (c) { copy(c); return; }
    const dot = e.target.closest('.cr-dot'); if (dot) { focusItem(dot.dataset.target); return; }
  });
  q('.cr-lb-close').addEventListener('click', () => lb.close());
  q('[data-lb-prev]').addEventListener('click', () => show(idx - 1));
  q('[data-lb-next]').addEventListener('click', () => show(idx + 1));
  q('[data-lb-space]').addEventListener('click', () => lb.close());
  zoomBtn.addEventListener('click', () => setZoom(!zoom));
  img.addEventListener('click', e => { if (!zoom) { const r = img.getBoundingClientRect(); img.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`; } setZoom(!zoom); });
  img.addEventListener('pointermove', e => { if (!zoom) return; const r = img.getBoundingClientRect(); img.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`; });
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); } else if (e.key === '+' || e.key === '=') setZoom(true); else if (e.key === '-') setZoom(false); });

  function focusItem(id) {
    const it = items.find(x => x.dataset.cid === id); if (!it) return;
    if (it.hidden) { cat = 'all'; if (search) search.value = ''; apply(); }
    if (it.matches('.cr-feat')) { open(id); return; }
    it.scrollIntoView({ behavior: paused() ? 'auto' : 'smooth', block: 'center' });
    it.classList.remove('cr-ping'); void it.offsetWidth; it.classList.add('cr-ping');
  }
  window.__focusCredential = focusItem;

  /* holo tilt */
  const fine = matchMedia('(pointer: fine)').matches;
  sec.querySelectorAll('.cr-feat').forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`); c.style.setProperty('--my', `${(y * 100).toFixed(1)}%`); c.style.setProperty('--hue', `${Math.round(x * 140 + y * 80)}deg`);
      if (fine && !paused()) { c.style.setProperty('--rx', `${((.5 - y) * 10).toFixed(2)}deg`); c.style.setProperty('--ry', `${((x - .5) * 14).toFixed(2)}deg`); }
    });
    c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
  });

  /* entrance + stats counter */
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return; o.disconnect(); sec.classList.add('cr-in');
    sec.querySelectorAll('[data-cr-count]').forEach(el => {
      const to = +el.dataset.crCount; if (paused()) { el.textContent = to; return; }
      const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    });
  }, { threshold: .15 }).observe(sec);
})();
