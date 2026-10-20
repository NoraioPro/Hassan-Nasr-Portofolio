(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Motion control ---------- */
  let paused = reduce.matches;
  const motionButton = $('#motion-toggle');
  const motionLabel = $('[data-motion-label]');
  const loops = new Set();
  function applyMotion() {
    root.classList.toggle('motion-paused', paused);
    motionButton?.setAttribute('aria-pressed', String(paused));
    if (motionLabel) motionLabel.textContent = paused ? 'Play motion' : 'Pause motion';
    loops.forEach(loop => loop.sync());
    if (typeof scrollScenes !== 'undefined') runScenes();
  }
  motionButton?.addEventListener('click', () => { paused = !paused; applyMotion(); });
  reduce.addEventListener('change', e => { paused = e.matches; applyMotion(); });

  // A render loop that only runs while its element is on screen, the tab is visible and motion is on.
  function createLoop(element, frame) {
    let visible = false, raf = 0, last = 0;
    const tick = now => { raf = 0; frame(Math.min(50, now - (last || now)), now); last = now; loop.sync(); };
    const loop = {
      sync() {
        const run = visible && !paused && !document.hidden;
        if (run && !raf) raf = requestAnimationFrame(tick);
        if (!run) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
      },
      once() { frame(0, performance.now()); }
    };
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; loop.sync(); }, { rootMargin: '100px' }).observe(element);
    loops.add(loop);
    return loop;
  }
  document.addEventListener('visibilitychange', () => loops.forEach(loop => loop.sync()));

  /* ---------- Header, progress, active section ---------- */
  const header = $('.header');
  const progressBar = $('.progress-bar span');
  let scrollQueued = false;
  let maxCache = -1;
  const scrollMax = () => maxCache < 0 ? (maxCache = document.documentElement.scrollHeight - innerHeight) : maxCache;
  new ResizeObserver(() => { maxCache = -1; }).observe(document.body);
  addEventListener('resize', () => { maxCache = -1; }, { passive: true });
  function onScroll() {
    scrollQueued = false;
    const max = scrollMax();
    progressBar.style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`;
    header.classList.toggle('is-scrolled', scrollY > 24);
  }
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const navLinks = $$('#main-nav a[href^="#"]:not(.nav-contact)');
  const frontierTabs = $$('.frontier-tab');
  const frontierIds = ['space', 'medical', 'robotics', 'twin'];
  const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id = entry.target.id;
    const navId = frontierIds.includes(id) ? 'frontiers' : id;
    navLinks.forEach(link => link.setAttribute('aria-current', String(link.hash === `#${navId}`)));
    frontierTabs.forEach(tab => tab.setAttribute('aria-current', String(tab.hash === `#${id}`)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.hero, #about, #journey, #credentials, #workshops, #work, #live-projects, .perspective, #contact, #space, #medical, #robotics, #twin').forEach(s => sectionObserver.observe(s));

  /* ---------- Mobile menu ---------- */
  const menu = $('.menu-toggle');
  const nav = $('#main-nav');
  const closeMenu = () => { nav.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => { const open = nav.classList.toggle('menu-open'); menu.setAttribute('aria-expanded', String(open)); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('menu-open')) { closeMenu(); menu.focus(); } });

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = ['.section-head', '.frontier-copy', '.instrument', '.about-copy', '.focus-list li', '.project', '.deployments-heading', '.deployment-card', '.index-heading', '.repo-controls', '.topics li', '.contact h2', '.contact-bottom', '.stat', '.career-map', '.achievements li', '.clients-stats > div', '.client-filters', '.client-card'];
  const revealer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealer.unobserve(entry.target); }
  }), { rootMargin: '0px 0px 25% 0px' });
  revealTargets.forEach(selector => $$(selector).forEach((el, i) => {
    el.dataset.reveal = '';
    const siblings = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
    el.style.setProperty('--delay', `${Math.min(siblings, 8) * 0.06}s`);
    revealer.observe(el);
  }));

  /* ---------- Oslo clock ---------- */
  const clock = $('[data-clock]');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const tickClock = () => { if (clock) clock.textContent = fmt.format(new Date()); };
  tickClock(); setInterval(tickClock, 15000);

  /* ---------- Hero: portrait follows the pointer ---------- */
  const hero = $('[data-hero]');
  const portrait = $('[data-portrait] img');
  const portraitReadout = $('[data-portrait-readout]');
  const nameLines = $$('.name-line');
  let heroQueued = false, hx = 0, hy = 0;
  function updateHero() {
    heroQueued = false;
    portrait.style.setProperty('--ry', (hx * 14).toFixed(2));
    portrait.style.setProperty('--rx', (-hy * 8).toFixed(2));
    portrait.style.setProperty('--tx', (hx * 14).toFixed(2));
    nameLines.forEach(line => {
      const depth = Number(line.dataset.depth);
      line.style.setProperty('--px', (hx * depth).toFixed(1));
      line.style.setProperty('--py', (hy * depth * .4).toFixed(1));
    });
    if (portraitReadout) portraitReadout.textContent = `TRACKING · ${(hx * 14).toFixed(1)}° / ${(-hy * 8).toFixed(1)}°`;
  }
  if (finePointer.matches && hero && portrait) {
    hero.addEventListener('pointermove', e => {
      if (paused) return;
      hx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
      hy = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      if (!heroQueued) { heroQueued = true; requestAnimationFrame(updateHero); }
    });
    hero.addEventListener('pointerleave', () => { hx = 0; hy = 0; requestAnimationFrame(updateHero); });
  }

  /* ---------- Stats count-up ---------- */
  const counts = {
    featured: $$('.project').length,
    repos: $$('.repo-row').length,
    live: $$('#deployment-grid > [data-status="live"]').length,
    liveAll: $$('#deployment-grid > [data-status="live"]').length
  };
  $$('[data-count], [data-to]').forEach(el => {
    const target = el.dataset.to ? Number(el.dataset.to) : counts[el.dataset.count];
    if (!target) return;
    el.textContent = target;
    if (paused) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now(), duration = 1400;
      const step = now => {
        const t = Math.min(1, (now - start) / duration);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: .6 });
    io.observe(el);
  });

  /* ---------- Projects ---------- */
  $$('.project').forEach(project => project.addEventListener('toggle', () => {
    if (project.open) $$('.project[open]').forEach(other => { if (other !== project) other.open = false; });
  }));
  function openProject(name) {
    const project = $$('.project').find(item => item.querySelector('.project-name').textContent.startsWith(name));
    if (!project) return;
    $$('.project[open]').forEach(other => { if (other !== project) other.open = false; });
    project.open = true;
    requestAnimationFrame(() => {
      project.scrollIntoView({ behavior: paused ? 'auto' : 'smooth', block: 'start' });
      project.querySelector('summary').focus({ preventScroll: true });
    });
  }
  $$('[data-project]').forEach(link => link.addEventListener('click', e => { e.preventDefault(); openProject(link.dataset.project); }));
  $$('[data-repo-query]').forEach(link => link.addEventListener('click', () => {
    const search = $('#repo-search'); if (!search) return;
    const ownerSel = $('#repo-owner'); if (ownerSel) ownerSel.value = '';
    search.value = link.dataset.repoQuery;
    search.dispatchEvent(new Event('input'));
  }));

  /* ---------- Live on the web: combined status x industry filter ---------- */
  const comboGrid = $('#deployment-grid');
  if (comboGrid) {
    const cards = $$(':scope > li', comboGrid);
    const sChips = $$('[data-status-filter]'), cChips = $$('[data-cat-filter]');
    const countEl = $('#deployment-count'), emptyEl = $('#deployment-empty');
    const state = { status: (sChips.find(c => c.getAttribute('aria-pressed') === 'true') || {}).dataset?.statusFilter || 'all', cat: 'all' };
    const match = (card, s, c) => (s === 'all' || card.dataset.status === s) && (c === 'all' || card.dataset.cat === c);
    const apply = () => {
      let n = 0;
      cards.forEach(card => { const ok = match(card, state.status, state.cat); card.hidden = !ok; if (ok) n++; });
      sChips.forEach(ch => { const k = ch.dataset.statusFilter; ch.setAttribute('aria-pressed', String(k === state.status)); const m = cards.filter(cd => match(cd, k, state.cat)).length; ch.lastElementChild.textContent = m; ch.classList.toggle('is-empty', !m); });
      cChips.forEach(ch => { const k = ch.dataset.catFilter; ch.setAttribute('aria-pressed', String(k === state.cat)); const m = cards.filter(cd => match(cd, state.status, k)).length; ch.lastElementChild.textContent = m; ch.classList.toggle('is-empty', !m); });
      if (countEl) countEl.textContent = `Showing ${n} of ${cards.length} sites`;
      if (emptyEl) emptyEl.hidden = n !== 0;
    };
    const run = () => { if (document.startViewTransition && !paused) { const t = document.startViewTransition(apply); t.ready.catch(() => {}); t.finished.catch(() => {}); } else apply(); };
    sChips.forEach(ch => ch.addEventListener('click', () => { state.status = ch.dataset.statusFilter; run(); }));
    cChips.forEach(ch => ch.addEventListener('click', () => { state.cat = ch.dataset.catFilter; run(); }));
    $('.combo-reset')?.addEventListener('click', () => { state.status = 'all'; state.cat = 'all'; run(); });
    apply();
  }

  /* ---------- Brand kits: flip cards to reveal the extracted palette + typography ---------- */
  const loadedFonts = new Set();
  const loadFonts = card => {
    const aa = $('.bk-aa[data-fonts]', card);
    if (!aa) return;
    aa.dataset.fonts.split('|').forEach(name => {
      if (loadedFonts.has(name)) return;
      loadedFonts.add(name);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;600&display=swap`;
      document.head.append(link);
    });
  };
  const flip = (card, on) => {
    card.classList.toggle('is-flipped', on);
    const [front, back] = [$('.card-front', card), $('.card-back', card)];
    front.inert = on; back.inert = !on;
    front.toggleAttribute('aria-hidden', on); back.setAttribute('aria-hidden', String(!on));
    const btn = $('.brand-toggle', card);
    btn.setAttribute('aria-pressed', String(on));
    btn.firstElementChild.textContent = on ? 'Screen' : 'Brand kit';
    if (on) loadFonts(card);
  };
  document.addEventListener('click', e => {
    const toggle = e.target.closest('.brand-toggle');
    if (toggle) { const card = toggle.closest('.client-card'); flip(card, !card.classList.contains('is-flipped')); return; }
    const sw = e.target.closest('.bk-swatch');
    if (sw) {
      navigator.clipboard?.writeText(sw.dataset.hex).catch(() => {});
      const label = sw.firstElementChild, text = label.textContent;
      sw.classList.add('is-copied'); label.textContent = 'Copied';
      setTimeout(() => { sw.classList.remove('is-copied'); label.textContent = text; }, 1200);
      return;
    }
    const view = e.target.closest('.view-toggle [data-view]');
    if (view) {
      const grid = document.getElementById(view.getAttribute('aria-controls'));
      const on = view.dataset.view === 'brand';
      view.parentElement.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === view)));
      $$(':scope > .client-card', grid).forEach((card, i) => {
        if (paused) flip(card, on);
        else setTimeout(() => flip(card, on), Math.min(i, 16) * 45);
      });
    }
  });

  /* ---------- Canvas helper ---------- */
  function fitCanvas(canvas) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: width, h: height };
  }
  function trackPointer(field) {
    const p = { x: .5, y: .5, tx: .5, ty: .5, active: false };
    field.addEventListener('pointermove', e => {
      const r = field.getBoundingClientRect();
      p.tx = (e.clientX - r.left) / r.width; p.ty = (e.clientY - r.top) / r.height; p.active = true;
      field.classList.add('is-active');
    });
    field.addEventListener('pointerleave', () => { p.active = false; p.tx = .5; p.ty = .5; });
    return p;
  }

  /* ---------- Space: starfield, Earth limb, orbit ---------- */
  $$('[data-space]').forEach(field => {
    const canvas = $('canvas', field);
    const sat = $('.satellite img', field);
    const p = trackPointer(field);
    let c = fitCanvas(canvas), t = 0;
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .9 + .1, tw: Math.random() * 6.28 }));
    function frame(dt) {
      if (field.classList.contains('is-3d')) return;
      t += dt / 1000;
      p.x = lerp(p.x, p.tx, .06); p.y = lerp(p.y, p.ty, .06);
      const { ctx, w, h } = c;
      const ox = (p.x - .5), oy = (p.y - .5);
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const x = ((s.x - ox * s.z * .08) % 1 + 1) % 1 * w;
        const y = ((s.y - oy * s.z * .08) % 1 + 1) % 1 * h;
        ctx.globalAlpha = (.25 + .55 * s.z) * (.75 + .25 * Math.sin(t * 2 + s.tw));
        ctx.fillStyle = '#edeae3';
        ctx.fillRect(x, y, s.z * 1.6, s.z * 1.6);
      }
      ctx.globalAlpha = 1;
      // Earth limb
      const er = w * 1.1, ex = w * .5 - ox * 20, ey = h + er * .78 - oy * 12;
      const atmo = ctx.createRadialGradient(ex, ey, er * .98, ex, ey, er * 1.09);
      atmo.addColorStop(0, 'rgba(255,120,70,.45)'); atmo.addColorStop(.25, 'rgba(255,91,38,.14)'); atmo.addColorStop(1, 'rgba(255,91,38,0)');
      ctx.fillStyle = atmo; ctx.beginPath(); ctx.arc(ex, ey, er * 1.09, 0, Math.PI * 2); ctx.fill();
      const earth = ctx.createRadialGradient(ex, ey - er * .9, er * .1, ex, ey, er);
      earth.addColorStop(0, '#1d2128'); earth.addColorStop(1, '#0d0f12');
      ctx.fillStyle = earth; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(237,234,227,.07)'; ctx.lineWidth = 1;
      for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.ellipse(ex, ey, er * Math.sin(i / 7 * Math.PI / 2 + .2), er, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
      // Orbits
      const cx = w / 2 + ox * 18, cy = h * .5 + oy * 10;
      const tilt = -.22 + ox * .2;
      [[.46, .15, 'rgba(237,234,227,.16)', [3, 6]], [.38, .26, 'rgba(255,91,38,.4)', []]].forEach(([rx, ry, color, dash], i) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt + i * .35);
        ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, w * rx, h * ry, 0, 0, Math.PI * 2); ctx.stroke();
        const a = t * (i ? .5 : -.32) + i * 2;
        const dx = Math.cos(a) * w * rx, dy = Math.sin(a) * h * ry;
        ctx.setLineDash([]); ctx.fillStyle = i ? '#ff5b26' : '#edeae3';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(dx, dy, i ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      sat.style.setProperty('--sx', (-oy * 22).toFixed(2));
      sat.style.setProperty('--sy', (ox * 30).toFixed(2));
      sat.style.setProperty('--sz', (-8 + ox * 6).toFixed(2));
      sat.style.setProperty('--bob', (Math.sin(t * 1.2) * 6).toFixed(2));
    }
    const loop = createLoop(field, frame);
    addEventListener('resize', () => { c = fitCanvas(canvas); loop.once(); }, { passive: true });
    loop.once();
  });

  /* ---------- Robotics: two-link arm with inverse kinematics ---------- */
  $$('[data-robot]').forEach(field => {
    const svg = $('svg', field);
    const L1 = 150, L2 = 120, base = { x: 300, y: 380 };
    const link1 = $('[data-link-1]', field), link2 = $('[data-link-2]', field);
    const joint1 = $('[data-joint-1]', field), gripper = $('[data-gripper]', field);
    const targetEl = $('[data-robot-target]', field);
    const anglesEl = $('[data-robot-angles]', field), statusEl = $('[data-robot-status]', field);
    let mode = 'track', t = 0, a1 = -Math.PI / 2, a2 = 0, pointer = null;
    const target = { x: 380, y: 200 };
    function toSvg(e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    field.addEventListener('pointermove', e => { if (mode === 'track') { pointer = toSvg(e); field.classList.add('is-active'); } });
    field.addEventListener('pointerleave', () => { pointer = null; });
    field.addEventListener('pointerdown', e => { if (!e.target.closest('button')) { pointer = toSvg(e); } });
    $$('[data-robot-mode]', field).forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.robotMode;
      $$('[data-robot-mode]', field).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      pointer = null;
    }));
    function solve(tx, ty) {
      let dx = tx - base.x, dy = ty - base.y;
      dy = Math.min(dy, -10);
      let d = Math.hypot(dx, dy);
      const maxD = L1 + L2 - 1, minD = Math.abs(L1 - L2) + 20;
      if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
      if (d < minD) { dx *= minD / d; dy *= minD / d; d = minD; }
      const cos2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const q2 = -Math.acos(cos2); // elbow up
      const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      return [q1, q2, base.x + dx, base.y + dy];
    }
    function frame(dt) {
      if (field.classList.contains('is-3d')) return;
      t += dt / 1000;
      if (pointer && mode === 'track') { target.x = lerp(target.x, pointer.x, .2); target.y = lerp(target.y, pointer.y, .2); }
      else {
        const speed = mode === 'calibrate' ? 1.4 : .5;
        target.x = 300 + Math.sin(t * speed) * 190;
        target.y = 190 + Math.sin(t * speed * 2) * 70;
      }
      const [q1, q2, rx, ry] = solve(target.x, target.y);
      a1 = lerp(a1, q1, .12); a2 = lerp(a2, q2, .12);
      const jx = base.x + Math.cos(a1) * L1, jy = base.y + Math.sin(a1) * L1;
      const ex = jx + Math.cos(a1 + a2) * L2, ey = jy + Math.sin(a1 + a2) * L2;
      link1.setAttribute('x2', jx); link1.setAttribute('y2', jy);
      link2.setAttribute('x1', jx); link2.setAttribute('y1', jy); link2.setAttribute('x2', ex); link2.setAttribute('y2', ey);
      joint1.setAttribute('cx', jx); joint1.setAttribute('cy', jy);
      gripper.setAttribute('transform', `translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${((a1 + a2) * 180 / Math.PI + 90).toFixed(1)})`);
      targetEl.setAttribute('transform', `translate(${rx.toFixed(1)} ${ry.toFixed(1)})`);
      const reached = Math.hypot(ex - rx, ey - ry) < 8;
      field.classList.toggle('is-reached', reached);
      anglesEl.textContent = `Î¸1 ${Math.round(-a1 * 180 / Math.PI)}° · Î¸2 ${Math.round(-a2 * 180 / Math.PI)}°`;
      statusEl.textContent = mode === 'calibrate' ? 'Calibrating sweep' : reached ? 'Target acquired' : pointer ? 'Vision / tracking' : 'Vision / ready';
    }
    const loop = createLoop(field, frame);
    loop.once();
  });

  /* ---------- Command palette ---------- */
  const palette = $('#palette');
  if (palette && typeof palette.showModal === 'function') {
    const input = $('input', palette), list = $('#palette-list', palette);
    const sections = [['Frontiers', '#frontiers'], ['Space & satellites', '#space'], ['Healthcare technology', '#medical'], ['Robotics', '#robotics'], ['Digital twins · neural portrait', '#twin'], ['About Hassan', '#about'], ['Journey & experience', '#journey'], ['Credentials & certifications', '#credentials'], ['AI workshops & booking', '#workshops'], ['Client work', '#live-projects'], ['Selected work', '#work'], ['Live projects', '#live-projects'], ['What I’m thinking about', '.perspective'], ['Contact', '#contact']]
      .filter(([, target]) => $(target))
      .map(([label, target]) => ({ group: 'Sections', label, hint: 'Jump', run: () => $(target).scrollIntoView({ behavior: paused ? 'auto' : 'smooth' }) }));
    const pages = [['Space & satellites page', '/space/'], ['Healthcare technology page', '/medical/'], ['Robotics page', '/robotics/'], ['Projects page', '/projects/'], ['Awards & credentials page', '/credentials/'], ['AI workshops page', '/workshops/'], ['About Hassan page', '/about/'], ['Home', '/']]
      .filter(([, href]) => location.pathname !== href).map(([label, href]) => ({ group: 'Pages', label, hint: 'Open page', run: () => { location.href = href; } }));
    const projects = $$('.project').map(p => {
      const name = p.querySelector('.project-name').firstChild.textContent.trim();
      return { group: 'Selected work', label: name, hint: p.querySelector('.project-status').textContent, run: () => openProject(name) };
    });
    const live = $$('#deployment-grid > [data-cat="product"][data-status="live"] .card-front').map(a => ({ group: 'Live sites', label: a.querySelector('strong').textContent, hint: a.querySelector('.client-bar .mono').textContent, run: () => window.open(a.href, '_blank', 'noopener') }));
    const clientSites = $$('#deployment-grid > [data-cat]:not([data-cat="product"]) .card-front').map(a => ({ group: 'Client sites', label: a.querySelector('strong').textContent, hint: a.querySelector('.client-bar .mono').textContent, run: () => window.open(a.href, '_blank', 'noopener') }));
    const creds = $$('#credentials .cr-feat, #credentials .cr-row').map(c => ({ group: 'Credentials', label: (c.querySelector('.cr-title') || c.querySelector('.cr-row-main strong')).textContent, hint: (c.querySelector('.cr-issuer') || c.querySelector('.cr-row-main span')).textContent, run: () => (window.__focusCredential ? window.__focusCredential(c.dataset.cid) : c.scrollIntoView({ block: 'center' })) }));
    const workshops = $$('#workshops .ws-card').map(c => ({ group: 'Workshops', label: c.querySelector('h3').textContent, hint: c.querySelector('.ws-tag').textContent, run: () => (window.__pickWorkshop ? window.__pickWorkshop(c.dataset.wsId) : c.scrollIntoView({ block: 'center' })) }));
    const career = $$('.milestone').map(m => ({ group: 'Journey', label: `${m.dataset.label} — ${m.dataset.org}`, hint: m.querySelector('time').textContent, run: () => m.scrollIntoView({ behavior: paused ? 'auto' : 'smooth', block: 'center' }) }));
    const all = [...sections, ...pages, ...career, ...workshops, ...creds, ...clientSites, ...projects, ...live];
    let results = [], active = 0;
    const score = (item, q) => {
      const hay = `${item.label} ${item.hint}`.toLowerCase();
      if (!q) return item.repo ? -1 : 1;
      if (item.label.toLowerCase().startsWith(q)) return 3;
      if (hay.includes(q)) return 2;
      let i = 0; for (const ch of hay) if (ch === q[i]) i++;
      return i === q.length ? 1 : -1;
    };
    function render() {
      const q = input.value.trim().toLowerCase();
      const byGroup = new Map();
      all.map(item => ({ item, s: score(item, q) })).filter(r => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .forEach(({ item }) => { const g = byGroup.get(item.group) || []; if (g.length < (q ? 6 : 10)) g.push(item); byGroup.set(item.group, g); });
      results = [];
      let html = '';
      for (const group of ['Sections', 'Pages', 'Journey', 'Workshops', 'Credentials', 'Client sites', 'Selected work', 'Live sites']) {
        const items = byGroup.get(group); if (!items) continue;
        html += `<li class="group" role="presentation">${group}</li>`;
        for (const item of items) {
          const id = `pal-${results.length}`;
          html += `<li id="${id}" role="option" data-index="${results.length}" aria-selected="false"><span></span><small></small></li>`;
          results.push(item);
        }
      }
      list.innerHTML = html || '<li class="empty" role="presentation">No matches. Try “health”, “live” or a project name.</li>';
      $$('[role="option"]', list).forEach((li, i) => { li.firstChild.textContent = results[i].label; li.lastChild.textContent = results[i].hint; });
      setActive(0);
    }
    function setActive(i) {
      const options = $$('[role="option"]', list);
      if (!options.length) { input.removeAttribute('aria-activedescendant'); return; }
      active = (i + options.length) % options.length;
      options.forEach((o, n) => o.setAttribute('aria-selected', String(n === active)));
      input.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({ block: 'nearest' });
    }
    function choose(i) { const item = results[i]; if (!item) return; palette.close(); item.run(); }
    function open() { closeMenu(); input.value = ''; render(); palette.showModal(); input.focus(); }
    $('.palette-trigger').addEventListener('click', open);
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    });
    list.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) choose(Number(o.dataset.index)); });
    list.addEventListener('pointermove', e => { const o = e.target.closest('[role="option"]'); if (o && Number(o.dataset.index) !== active) setActive(Number(o.dataset.index)); });
    palette.addEventListener('click', e => { if (e.target === palette) palette.close(); });
    document.addEventListener('keydown', e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault(); palette.open ? palette.close() : open();
      }
    });
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) $('.palette-trigger kbd').textContent = 'Ctrl K';
  }

  /* ---------- Scroll-linked scenes: frontier tabs + journey ---------- */
  const scrollScenes = [];
  const setVar = (el, name, value) => { const key = `_${name}`; if (el[key] === value) return; el[key] = value; el.style.setProperty(name, value); };
  const progressOf = (el, startAt = .7, endAt = .3) => { // 0 when el top hits startAt·vh, 1 when its bottom hits endAt·vh
    const r = el.getBoundingClientRect();
    return clamp((innerHeight * startAt - r.top) / (r.height + innerHeight * (startAt - endAt)), 0, 1);
  };
  function runScenes() { scenesQueued = false; scrollScenes.forEach(fn => fn()); }
  let scenesQueued = false;
  const queueScenes = () => { if (!scenesQueued) { scenesQueued = true; requestAnimationFrame(runScenes); } };
  addEventListener('scroll', queueScenes, { passive: true });
  addEventListener('resize', queueScenes, { passive: true });

  // Frontier tabs: sliding indicator under the current tab, per-panel progress bars
  const tabBar = $('.frontier-tabs');
  if (tabBar) {
    const indicator = $('.tab-indicator', tabBar);
    const tabs = $$('.frontier-tab', tabBar);
    const panels = tabs.map(tab => $(tab.hash));
    let placed = null;
    const placeIndicator = () => {
      const current = tabs.find(tab => tab.getAttribute('aria-current') === 'true');
      tabBar.classList.toggle('has-active', !!current);
      if (!current || current === placed) return;
      placed = current;
      tabBar.style.setProperty('--ix', `${current.offsetLeft}px`);
      tabBar.style.setProperty('--iw', `${current.offsetWidth}px`);
      tabBar.style.setProperty('--active-glow', `color-mix(in srgb, ${getComputedStyle(current).getPropertyValue('--tab-accent').trim() || '#ff5b26'} 35%, transparent)`);
    };
    addEventListener('resize', () => { placed = null; placeIndicator(); }, { passive: true });
    new MutationObserver(placeIndicator).observe(tabBar, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    scrollScenes.push(() => {
      const ps = panels.map(panel => progressOf(panel, .6, .4).toFixed(3));
      ps.forEach((v, i) => setVar(tabs[i], '--p', v));
      placeIndicator();
    });
  }

  // Journey: rail fill + comet, lit milestones, odometer year, active role
  const timeline = $('[data-timeline]');
  if (timeline) {
    const milestones = $$('.milestone', timeline);
    const odoCols = $$('.odo-col > span');
    const label = $('[data-journey-label]'), org = $('[data-journey-org]'), now = $('.journey-now');
    const meter = $('.journey-meter');
    const mapRows = $$('.cm-row');
    $$('.cm-bar').forEach((bar, i) => bar.style.setProperty('--i', i));
    let activeId = '';
    const setYear = year => String(year).padStart(4, '0').split('').forEach((d, i) => odoCols[i]?.style.setProperty('--d', d));
    setYear(milestones[0].dataset.year);
    scrollScenes.push(() => {
      const p = progressOf(timeline, .55, .55);
      const line = innerHeight * .55;
      const tops = milestones.map(m => m.getBoundingClientRect().top);
      let active = milestones[0];
      setVar(timeline, '--tp', p.toFixed(3));
      setVar(meter, '--jp', p.toFixed(3));
      milestones.forEach((m, i) => {
        const lit = tops[i] + 40 < line;
        m.classList.toggle('is-lit', lit);
        if (lit) active = m;
      });
      if (active.id === activeId) return;
      activeId = active.id;
      setYear(active.dataset.year);
      label.textContent = active.dataset.label;
      org.textContent = active.dataset.org;
      now.classList.remove('is-swapping'); void now.offsetWidth; now.classList.add('is-swapping');
      mapRows.forEach(row => row.classList.toggle('is-current', row.hash === `#${activeId}`));
    });
    if (reduce.matches) milestones.forEach(m => m.classList.add('is-lit'));
  }
  // Worlds: portal entry progress, and the page colour follows the world you are in
  const worlds = $$('.world');
  let pageBg = '';
  const WORLD_BG = { orbit: '#03050b', clinic: '#06100e', lab: '#0b0a08', twin: '#07051a' };
  scrollScenes.push(() => {
    let current = null;
    const rects = worlds.map(w => w.getBoundingClientRect());
    worlds.forEach((w, i) => {
      const r = rects[i];
      const enter = paused ? 1 : clamp((innerHeight - r.top) / (innerHeight * .85), 0, 1);
      setVar(w, '--enter', enter.toFixed(2));
      if (r.top < innerHeight * .5 && r.bottom > innerHeight * .5) current = w;
    });
    const bg = current ? WORLD_BG[current.dataset.world] : '';
    if (bg !== pageBg) { pageBg = bg; if (bg) root.style.setProperty('--page-bg', bg); else root.style.removeProperty('--page-bg'); }
  });
  runScenes();

  /* ---------- Pointer spotlight + card tilt ---------- */
  $$('.deployment-card, .focus-list li, .topics li, .case-card, .now-card, .achievements li').forEach(el => el.classList.add('spot'));
  if (finePointer.matches) {
    document.addEventListener('pointermove', e => {
      const card = e.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      if (card.classList.contains('tl-card') && !paused) {
        card.style.setProperty('--trx', `${(((e.clientY - r.top) / r.height) - .5) * -4}deg`);
        card.style.setProperty('--try', `${(((e.clientX - r.left) / r.width) - .5) * 5}deg`);
      }
    }, { passive: true });
    document.addEventListener('pointerout', e => {
      const card = e.target.closest('.tl-card');
      if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--trx', '0deg'); card.style.setProperty('--try', '0deg'); }
    });
  }

  /* ---------- Journey photo viewer ---------- */
  const lightbox = $('#lightbox');
  if (lightbox && typeof lightbox.showModal === 'function') {
    const lbImg = $('[data-lb-img]', lightbox), lbCaption = $('[data-lb-caption]', lightbox), lbCount = $('[data-lb-count]', lightbox);
    const galleries = {};
    $$('.tl-shot').forEach(shot => {
      const img = $('img', shot);
      (galleries[shot.dataset.gallery] ||= [])[Number(shot.dataset.index)] = { src: img.currentSrc || img.src, alt: img.alt };
    });
    let current = [], index = 0, opener = null;
    const show = (i, dir = 1) => {
      index = (i + current.length) % current.length;
      const item = current[index];
      lbImg.src = item.src; lbImg.alt = item.alt;
      lbCaption.textContent = item.alt;
      lbCount.textContent = `${index + 1} / ${current.length}`;
      lbImg.style.setProperty('--dir', dir);
      lbImg.classList.remove('is-swapping'); void lbImg.offsetWidth; lbImg.classList.add('is-swapping');
      const preload = current[(index + dir + current.length) % current.length];
      if (preload) new Image().src = preload.src;
    };
    document.addEventListener('click', e => {
      const shot = e.target.closest('.tl-shot');
      if (!shot) return;
      opener = shot;
      current = galleries[shot.dataset.gallery];
      lightbox.classList.toggle('single', current.length < 2);
      show(Number(shot.dataset.index));
      lightbox.showModal();
    });
    $('[data-lb-prev]', lightbox).addEventListener('click', () => show(index - 1, -1));
    $('[data-lb-next]', lightbox).addEventListener('click', () => show(index + 1, 1));
    $('[data-lb-close]', lightbox).addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(index - 1, -1);
      if (e.key === 'ArrowRight') show(index + 1, 1);
    });
    lightbox.addEventListener('close', () => opener?.focus({ preventScroll: true }));
    let swipeX = null;
    lightbox.addEventListener('pointerdown', e => { swipeX = e.clientX; });
    lightbox.addEventListener('pointerup', e => {
      if (swipeX === null) return;
      const dx = e.clientX - swipeX; swipeX = null;
      if (Math.abs(dx) > 50 && current.length > 1) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
  }

  /* ---------- Decode effect on section labels ---------- */
  const glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/·<>';
  const scrambler = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    scrambler.unobserve(entry.target);
    if (paused) return;
    const node = [...entry.target.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
    if (!node) return;
    const finalText = node.textContent;
    const start = performance.now(), duration = 700;
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const settled = Math.floor(finalText.length * t);
      node.textContent = finalText.split('').map((ch, i) => i < settled || ch === ' ' ? ch : glyphs[(Math.random() * glyphs.length) | 0]).join('');
      if (t < 1) requestAnimationFrame(step); else node.textContent = finalText;
    };
    requestAnimationFrame(step);
  }), { threshold: 1 });
  $$('.section-head .kicker, .frontier-copy .kicker').forEach(k => scrambler.observe(k));

  applyMotion();
})();
