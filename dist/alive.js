/* alive.js: site-wide micro-interactions and compact phone layouts.
   - arrows (↗ → ↓ ←) move in their direction on hover/focus; in-page "↓" cues bob while on screen
   - stroke icons draw themselves in when they first appear, and redraw on hover
   - counts that change (filter chips, result lines) bump so the change is noticed
   - section numbers (01, 02 …) tick into place when their section arrives
   - phones: long lists become swipe rails with a live position counter, long bullet lists fold behind "+N more"
   Everything stays still under reduced motion or the site's "pause motion" switch. */
(() => {
  const html = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => rm.matches || html.classList.contains('motion-paused');
  const phone = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const SKIP = '.m-dock, .focus-list, [data-np], .instrument, .world-bg, .cx-globe, [data-health-console]';

  /* ---------- arrows ---------- */
  const DIR = { '↗': 'ne', '→': 'e', '↓': 's', '←': 'w', '↑': 'n' };
  const ARROW = /[↗→↓←↑]/;
  for (const el of document.querySelectorAll('a, button')) {
    if (el.closest(SKIP)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), found = [];
    while (walker.nextNode()) if (ARROW.test(walker.currentNode.nodeValue)) found.push(walker.currentNode);
    for (const t of found) {
      const p = t.parentElement, v = t.nodeValue;
      if (p.classList.contains('arw')) continue;
      if (p !== el && v.trim().length === 1 && p.childNodes.length === 1) { p.classList.add('arw'); p.dataset.d = DIR[v.trim()]; continue; }
      const frag = document.createDocumentFragment(); let last = 0;
      v.replace(/[↗→↓←↑]/g, (ch, i) => {
        frag.append(v.slice(last, i));
        const s = document.createElement('span'); s.className = 'arw'; s.dataset.d = DIR[ch]; s.setAttribute('aria-hidden', 'true'); s.textContent = ch;
        frag.append(s); last = i + 1; return ch;
      });
      frag.append(v.slice(last)); t.replaceWith(frag);
    }
  }
  // in-page "jump down" cues bob gently while visible
  const bobIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-bob', e.isIntersecting && !still())));
  document.querySelectorAll('a[href^="#"] .arw[data-d="s"]').forEach(a => bobIO.observe(a));

  /* ---------- stroke icons draw in ---------- */
  const SHAPES = 'path, line, circle, rect, polyline, polygon, ellipse';
  const drawing = new WeakSet();
  function draw(svg, dur = 720) {
    if (still() || drawing.has(svg)) return;
    const shapes = [...svg.querySelectorAll(SHAPES)].filter(s => { const c = getComputedStyle(s); return c.stroke !== 'none' && parseFloat(c.strokeWidth) > 0; });
    if (!shapes.length) return;
    drawing.add(svg);
    let left = shapes.length;
    shapes.forEach((s, i) => {
      const had = s.getAttribute('pathLength');
      s.setAttribute('pathLength', '1');
      const a = s.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }],
        { duration: dur, delay: i * 70, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'backwards' });
      a.onfinish = a.oncancel = () => { if (had === null) s.removeAttribute('pathLength'); else s.setAttribute('pathLength', had); if (--left === 0) drawing.delete(svg); };
    });
  }
  const icons = new Set([...document.querySelectorAll('svg')].filter(s => !s.closest(SKIP)));
  const iconIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    iconIO.unobserve(e.target);
    const b = e.target.getBoundingClientRect();
    if (b.width && b.width <= 48 && b.height <= 48) draw(e.target);
  }), { threshold: .8 });
  icons.forEach(s => iconIO.observe(s));
  if (fine.matches) document.addEventListener('pointerover', e => {
    const host = e.target.closest?.('a, button');
    if (!host || host.contains(e.relatedTarget)) return;
    const svg = host.querySelector('svg');
    if (svg && icons.has(svg) && svg.getBoundingClientRect().width <= 48) draw(svg, 520);
  }, { passive: true });

  /* ---------- counts that change bump ---------- */
  const bump = el => { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); };
  const counted = [...document.querySelectorAll('.chip b, .combo-count, .cr-count')];
  counted.forEach(el => { el._v = el.textContent; });
  const countMO = new MutationObserver(recs => {
    const seen = new Set();
    for (const r of recs) { const el = r.target.nodeType === 3 ? r.target.parentElement : r.target; if (el && !seen.has(el)) seen.add(el); }
    seen.forEach(el => { if (el._v !== el.textContent) { el._v = el.textContent; if (!still()) bump(el); } });
  });
  counted.forEach(el => countMO.observe(el, { childList: true, characterData: true, subtree: true }));

  /* ---------- section numbers tick into place ---------- */
  const tick = el => {
    const final = el.textContent, m = final.match(/^(\d+)([\s\S]*)$/);
    if (!m || still()) return;
    const n = m[1].length; let k = 0;
    const t = setInterval(() => {
      if (++k > 7) { clearInterval(t); el.textContent = final; return; }
      el.textContent = String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0') + m[2];
    }, 45);
  };
  const tickIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { tickIO.unobserve(e.target); tick(e.target); } }), { threshold: .9 });
  document.querySelectorAll('.kicker > i, .project-number').forEach(el => tickIO.observe(el));

  /* ---------- phones: swipe rails with a live counter ---------- */
  const pad = n => String(n).padStart(2, '0');
  for (const rail of document.querySelectorAll('[data-rail]')) {
    const ui = document.createElement('div');
    ui.className = 'rail-ui'; ui.setAttribute('aria-hidden', 'true');
    ui.innerHTML = '<span class="rail-n mono"><b>01</b><i>/</i><span>01</span></span><span class="rail-bar"><i></i></span><span class="rail-tip mono">Swipe</span>';
    rail.after(ui);
    const nEl = ui.querySelector('b'), totEl = ui.querySelector('.rail-n span'), bar = ui.querySelector('.rail-bar i');
    let queued = false, hinted = false;
    const update = () => {
      queued = false;
      if (!phone.matches) return;
      const items = [...rail.children].filter(c => c.getClientRects().length);
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let idx = 0, best = Infinity;
      items.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < best) { best = d; idx = i; } });
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4) idx = items.length - 1;
      nEl.textContent = pad(items.length ? idx + 1 : 0); totEl.textContent = pad(items.length);
      bar.style.transform = `scaleX(${items.length ? (idx + 1) / items.length : 0})`;
      ui.hidden = items.length < 2;
    };
    rail.addEventListener('scroll', () => { ui.classList.add('is-touched'); if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    // filters show/hide cards: start again from the first one
    new MutationObserver(recs => { if (recs.some(r => r.target.parentElement === rail && r.attributeName === 'hidden')) { rail.scrollLeft = 0; update(); } })
      .observe(rail, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    // the first time a rail shows up, nudge it once so it reads as swipeable
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting || hinted || !phone.matches) return;
      hinted = true; io.disconnect(); update();
      if (!still() && rail.scrollLeft === 0 && rail.scrollWidth > rail.clientWidth + 8)
        rail.animate([{ transform: 'none' }, { transform: 'translateX(-36px)' }, { transform: 'none' }], { duration: 1100, delay: 250, easing: 'cubic-bezier(.3,.7,.2,1)' });
    }, { threshold: .55 }).observe(rail);
    phone.addEventListener?.('change', update);
    addEventListener('resize', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- header: compact, steps aside while you read (phones), logo dot takes the colour of the world you are in ---------- */
  const header = document.querySelector('.header'), mainNav = document.getElementById('main-nav'), palette = document.getElementById('palette');
  const dock = document.querySelector('[data-dock]');
  let lastY = scrollY, dirQ = false, idle = 0;
  const onScrollDir = () => {
    dirQ = false;
    const y = scrollY, dy = y - lastY;
    if (Math.abs(dy) < 8) return;
    const down = dy > 0; lastY = y;
    const busy = mainNav?.classList.contains('menu-open') || palette?.open || header?.contains(document.activeElement);
    html.classList.toggle('hdr-hidden', phone.matches && down && y > 180 && !busy);
    if (dock) {
      dock.classList.toggle('is-mini', down && y > 180);
      clearTimeout(idle); idle = setTimeout(() => dock.classList.remove('is-mini'), 1100);
    }
  };
  addEventListener('scroll', () => { if (!dirQ) { dirQ = true; requestAnimationFrame(onScrollDir); } }, { passive: true });
  header?.addEventListener('focusin', () => html.classList.remove('hdr-hidden'));
  if (mainNav) new MutationObserver(() => { if (mainNav.classList.contains('menu-open')) html.classList.remove('hdr-hidden'); }).observe(mainNav, { attributes: true, attributeFilter: ['class'] });
  const worldIO = new IntersectionObserver(es => {
    for (const e of es) {
      if (e.isIntersecting) html.style.setProperty('--brand-accent', getComputedStyle(e.target).getPropertyValue('--world-accent').trim() || '');
      else if (getComputedStyle(e.target).getPropertyValue('--world-accent').trim() === html.style.getPropertyValue('--brand-accent')) html.style.removeProperty('--brand-accent');
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('.world').forEach(w => worldIO.observe(w));

  /* ---------- dock: icons pop in, answer taps, know what time it is in Oslo and Cairo ---------- */
  if (dock) {
    const btns = [...dock.querySelectorAll(':scope > a, :scope > button')];
    const hourIn = tz => +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date());
    const timeIn = tz => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const daytime = tz => { const h = hourIn(tz); return h >= 8 && h < 22; };
    const wa = dock.querySelector('.m-dock-wa'), waLabel = wa?.getAttribute('aria-label') || '';
    const clocks = () => {
      if (wa) { const day = daytime('Europe/Oslo'); wa.classList.toggle('is-night', !day); wa.setAttribute('aria-label', `${waLabel}. It is ${timeIn('Europe/Oslo')} in Oslo${day ? '' : ', replies may come in the morning'}.`); }
      dock.querySelectorAll('[data-tz]').forEach(el => {
        const late = !daytime(el.dataset.tz);
        el.classList.toggle('is-late', late);
        el.textContent = `${timeIn(el.dataset.tz)}${late ? ' · late' : ''}`;
        el.title = `${el.dataset.city} time${late ? ', late there' : ''}`;
      });
    };
    clocks(); setInterval(clocks, 30000);
    // icons pop in (staggered) each time the dock arrives; the phone rings once the first time
    let rang = false, pings = 0;
    new MutationObserver(() => {
      if (!dock.classList.contains('is-on') || still()) return;
      btns.forEach((b, i) => b.querySelector('svg')?.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }],
        { duration: 520, delay: 120 + i * 70, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' }));
      if (!rang) { rang = true; setTimeout(() => play(dock.querySelector('.m-dock-call'), 'ring'), 900); }
    }).observe(dock, { attributes: true, attributeFilter: ['class'] });
    // a soft ring around WhatsApp now and then (three times at most), only while the dock is open and still
    setInterval(() => {
      if (pings >= 3 || still() || document.hidden || !dock.classList.contains('is-on') || dock.classList.contains('is-mini')) return;
      pings++; play(wa, 'ping');
    }, 11000);
    const play = (el, cls) => { if (!el || still()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 900); };
    const TAP = { 'm-dock-wa': 'wiggle', 'm-dock-call': 'ring', 'm-dock-li': 'hop', 'm-dock-ct': 'flap' };
    btns.forEach(b => b.addEventListener('pointerdown', e => {
      if (still()) return;
      const r = b.getBoundingClientRect(), s = document.createElement('span');
      s.className = 'm-ripple'; s.style.left = `${e.clientX - r.left}px`; s.style.top = `${e.clientY - r.top}px`;
      b.append(s); s.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: .5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 550, easing: 'ease-out' }).onfinish = () => s.remove();
      play(b, TAP[[...b.classList].find(c => TAP[c])]);
    }));
  }

  /* ---------- journey: long bullet lists fold on phones ---------- */
  for (const ul of document.querySelectorAll('.tl-points')) {
    const extra = ul.children.length - 3;
    if (extra < 1) continue;
    ul.classList.add('is-clamp');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tl-more mono'; b.setAttribute('aria-expanded', 'false');
    b.textContent = `+${extra} more`;
    b.addEventListener('click', () => { const open = ul.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(open)); b.textContent = open ? 'Show less' : `+${extra} more`; });
    ul.after(b);
  }
})();
