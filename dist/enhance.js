/* enhance.js — interactive layer: hero field, tagline, magnetic buttons, ECG modes, reveal, spotlight, scroll progress */
(() => {
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => reduce.matches || html.classList.contains('motion-paused') || document.hidden;
  const fine = matchMedia('(pointer: fine)').matches;

  /* Scroll progress */
  const bar = document.createElement('div');
  bar.className = 'fx-progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.prepend(bar);
  let sq = false;
  let scrollMaxCache = -1; new ResizeObserver(() => { scrollMaxCache = -1; }).observe(document.body); addEventListener('resize', () => { scrollMaxCache = -1; }, { passive: true });
  const updBar = () => { sq = false; if (scrollMaxCache < 0) scrollMaxCache = document.documentElement.scrollHeight - innerHeight; const h = scrollMaxCache; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
  addEventListener('scroll', () => { if (!sq) { sq = true; requestAnimationFrame(updBar); } }, { passive: true });
  updBar();

  /* Hero constellation field */
  const hero = document.querySelector('[data-hero]');
  if (hero) {
    const c = document.createElement('canvas');
    c.className = 'fx-hero-field'; c.setAttribute('aria-hidden', 'true');
    hero.prepend(c);
    const ctx = c.getContext('2d');
    let W = 0, H = 0, dpr = 1, pts = [], mx = -1e4, my = -1e4, raf = 0, vis = true;
    const resize = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = hero.clientWidth; H = hero.clientHeight;
      c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(110, W * H / 14000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: Math.random() * 1.4 + .4 }));
      draw();
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        if (!paused()) {
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 22000) { const f = (1 - d2 / 22000) * .6; p.vx += dx / Math.sqrt(d2 + 1) * f * .08; p.vy += dy / Math.sqrt(d2 + 1) * f * .08; }
          p.vx *= .985; p.vy *= .985; p.x += p.vx + (Math.random() - .5) * .02; p.y += p.vy;
          if (p.x < 0) p.x += W; if (p.x > W) p.x -= W; if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
        }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 9000) { ctx.strokeStyle = `rgba(120,170,255,${(1 - d2 / 9000) * .18})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        const md = Math.hypot(a.x - mx, a.y - my);
        if (md < 160) { ctx.strokeStyle = `rgba(255,140,90,${(1 - md / 160) * .35})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke(); }
        ctx.fillStyle = md < 160 ? 'rgba(255,190,150,.9)' : 'rgba(190,215,255,.7)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
    };
    const loop = () => { raf = 0; draw(); if (vis && !paused()) raf = requestAnimationFrame(loop); };
    const sync = () => { if (vis && !paused() && !raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (paused()) draw(); });
    hero.addEventListener('pointerleave', () => { mx = my = -1e4; });
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; sync(); }).observe(hero);
    new ResizeObserver(resize).observe(hero);
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', sync);
    reduce.addEventListener?.('change', sync);
  }

  /* Rotating tagline word */
  const em = document.querySelector('.hero-tagline em');
  if (em) {
    const words = ['thoughtfully', 'responsibly', 'boldly', 'carefully', 'beautifully'];
    let i = 0;
    em.classList.add('fx-rotor');
    setInterval(() => {
      if (paused()) return;
      i = (i + 1) % words.length;
      em.classList.add('is-out');
      setTimeout(() => { em.textContent = words[i]; em.classList.remove('is-out'); }, 280);
    }, 3200);
  }

  /* Magnetic buttons */
  if (fine) document.querySelectorAll('.hero-actions .button, .palette-trigger').forEach(btn => {
    btn.classList.add('fx-magnet');
    btn.addEventListener('pointermove', e => {
      if (paused()) return;
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  /* Spotlight + tilt on cards */
  const cards = '.project, .client-card, .deployment-card, .ws-card';
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.(cards);
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty('--fx-x', `${x}px`); card.style.setProperty('--fx-y', `${y}px`);
    card.classList.add('fx-spot');
    if (fine && !paused() && card.matches('.deployment-card')) {
      card.style.transform = `perspective(800px) rotateX(${(.5 - y / r.height) * 6}deg) rotateY(${(x / r.width - .5) * 6}deg)`;
    }
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const card = e.target.closest?.(cards);
    if (card && !card.contains(e.relatedTarget)) { card.classList.remove('fx-spot'); if (card.matches('.deployment-card')) card.style.transform = ''; }
  });

  /* ECG: click/keyboard to pulse, mode switch, pointer-reactive BPM */
  const hc = document.querySelector('[data-health-console]');
  const ecg = hc?.querySelector('.hc-ecg');
  if (hc && ecg) {
    const modes = ['ecg', 'spo2', 'eeg'];
    const labels = { ecg: 'ECG · lead II', spo2: 'SpO₂ pleth', eeg: 'EEG · alpha' };
    hc.dataset.ecgMode = 'ecg';
    const bar = document.createElement('div');
    bar.className = 'fx-sig mono'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Signal mode');
    bar.innerHTML = modes.map(m => `<button type="button" data-sig="${m}" aria-pressed="${m === 'ecg'}">${labels[m]}</button>`).join('') + '<span class="fx-bpm" aria-live="polite">72 bpm</span>';
    ecg.after(bar);
    const bpm = bar.querySelector('.fx-bpm');
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-sig]'); if (!b) return;
      hc.dataset.ecgMode = b.dataset.sig;
      bar.querySelectorAll('[data-sig]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
    ecg.tabIndex = 0; ecg.setAttribute('role', 'button'); ecg.setAttribute('aria-label', 'Trigger a pulse on the signal trace');
    const pulse = () => { hc.dataset.pulse = String(performance.now()); ecg.classList.remove('fx-flash'); void ecg.offsetWidth; ecg.classList.add('fx-flash'); };
    ecg.addEventListener('click', pulse);
    ecg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pulse(); } });
    ecg.addEventListener('pointermove', e => {
      const r = ecg.getBoundingClientRect(); const k = (e.clientX - r.left) / r.width;
      const rate = 0.7 + k * 1.3; hc.dataset.rate = rate.toFixed(2);
      bpm.textContent = `${Math.round(60 * rate * 1.2)} ${hc.dataset.ecgMode === 'eeg' ? 'Hz·10' : 'bpm'}`;
    });
    ecg.addEventListener('pointerleave', () => { hc.dataset.rate = '1'; bpm.textContent = '72 bpm'; });
  }
})();
