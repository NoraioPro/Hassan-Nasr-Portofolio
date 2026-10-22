/* focus.js: the three "Where I focus" icons come alive. Agents pass work around a hub (plan, retrieve, act, review),
   ERP and CRM sync records along their wires, and the product cube turns through strategy, architecture and delivery.
   Ambient motion while in view, livelier on hover, a burst on click or tap; static under reduced motion. */
(() => {
  const list = document.querySelector('.focus-list[data-fx]');
  if (!list) return;
  const html = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => rm.matches || html.classList.contains('motion-paused');
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = x => x * x * (3 - 2 * x);
  const set = (el, a, v) => el.setAttribute(a, v.toFixed(2));
  const flash = (el, frames, ms = 520) => el.animate?.(frames, { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)' });

  function setChip(c, i) {
    if (c.chip === i) return;
    c.chip = i; c.chips.forEach((el, k) => el.classList.toggle('is-on', k === i));
  }

  /* hub + four agents: one task travels out and back, a click dispatches to all four at once */
  function agents(c) {
    const svg = c.el.querySelector('svg'), hub = svg.querySelector('.fx-hub'), ring = svg.querySelector('.fx-ring');
    const nodes = [...svg.querySelectorAll('.fx-nodes circle')], links = [...svg.querySelectorAll('.fx-links line')], pks = [...svg.querySelectorAll('.fx-pk circle')];
    const BASE = [[6, 7], [26, 7], [26, 25], [6, 25]], HR = 4, NR = 2.5, segs = BASE.map(() => [0, 0, 0, 0]);
    let leg = 0, p = 0, burst = -1;
    const at = (s, k, el) => { set(el, 'cx', lerp(s[0], s[2], k)); set(el, 'cy', lerp(s[1], s[3], k)); };
    const hit = i => { flash(nodes[i], [{ fillOpacity: 1 }, { fillOpacity: 0 }]); };
    return {
      frame(dt, t, e, sx, sy) {
        const hx = 16 + sx * 0.9, hy = 16 + sy * 0.9;
        for (const el of [hub, ring]) { set(el, 'cx', hx); set(el, 'cy', hy); }
        BASE.forEach(([bx, by], i) => {
          const amp = 0.35 + e * 0.5;
          const x = bx + sx * 2 + Math.cos(t * 0.9 + i * 1.9) * amp, y = by + sy * 2 + Math.sin(t * 1.3 + i * 1.7) * amp;
          set(nodes[i], 'cx', x); set(nodes[i], 'cy', y);
          const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, s = segs[i];
          s[0] = hx + ux * (HR + 1.1); s[1] = hy + uy * (HR + 1.1); s[2] = x - ux * (NR + 1.1); s[3] = y - uy * (NR + 1.1);
          set(links[i], 'x1', s[0]); set(links[i], 'y1', s[1]); set(links[i], 'x2', s[2]); set(links[i], 'y2', s[3]);
        });
        const before = p;
        p += dt * lerp(0.75, 1.9, e);
        if (before < 0.5 && p >= 0.5) { hit(leg); setChip(c, leg); }
        if (p >= 1) { p -= 1; leg = (leg + 1) % 4; }
        const k = ease(p < 0.5 ? p * 2 : (1 - p) * 2);
        at(segs[leg], k, pks[0]); pks[0].style.opacity = clamp(Math.min(k, 1 - k) * 8, 0, 1) * 0.4 + 0.6;
        if (burst >= 0) {
          const b0 = burst; burst += dt * 1.8;
          const bk = ease(Math.min(1, burst < 1 ? burst : 2 - burst));
          for (let i = 0; i < 4; i++) { at(segs[i], bk, pks[i + 1]); pks[i + 1].style.opacity = burst < 1.9 ? 1 : 0; }
          if (b0 < 1 && burst >= 1) nodes.forEach((_, i) => hit(i));
          if (burst >= 2) { burst = -1; pks.slice(1).forEach(el => (el.style.opacity = 0)); }
        }
      },
      hit() { burst = 0; svg.classList.remove('is-burst'); void svg.getBoundingClientRect(); svg.classList.add('is-burst'); },
      reset() { pks.forEach(el => (el.style.opacity = 0)); }
    };
  }

  /* ERP and CRM: a record travels each wire in turn, the receiving box lights up and its rows refill */
  function sync(c) {
    const svg = c.el.querySelector('svg'), wires = [...svg.querySelectorAll('.fx-wire')], boxes = [...svg.querySelectorAll('.fx-box')];
    const rows = [...svg.querySelectorAll('.fx-row')], pks = [...svg.querySelectorAll('.fx-pk circle')];
    const dirEl = c.el.querySelector('[data-fx-dir]'), stateEl = c.el.querySelector('[data-fx-state]');
    const L = wires.map(w => w.getTotalLength());
    let dir = 0, p = 0, burst = -1;
    const place = (i, k, el) => { const pt = wires[i].getPointAtLength(k * L[i]); set(el, 'cx', pt.x); set(el, 'cy', pt.y); };
    const land = i => { // wire 0 ends in CRM (box 1), wire 1 ends in ERP (box 0)
      const b = i === 0 ? 1 : 0;
      flash(boxes[b], [{ fill: 'rgba(255,91,38,.38)' }, { fill: 'rgba(255,91,38,0)' }], 620);
      rows.slice(b * 2, b * 2 + 2).forEach((r, n) => r.animate?.([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 380, delay: n * 90, easing: 'ease-out', fill: 'backwards' }));
      setChip(c, b);
    };
    const status = busy => { if (stateEl.classList.contains('is-busy') === busy) return; stateEl.classList.toggle('is-busy', busy); stateEl.textContent = busy ? 'Syncing' : 'In sync'; };
    return {
      frame(dt, t, e) {
        const travel = 0.62;
        const before = p;
        p += dt * lerp(0.42, 1.05, e);
        if (before < travel && p >= travel) land(dir);
        if (p >= 1) { p -= 1; dir ^= 1; dirEl.textContent = dir ? '←' : '→'; }
        const k = ease(Math.min(1, p / travel));
        place(dir, k, pks[dir]); pks[dir].style.opacity = p < travel ? 1 : 0;
        if (burst < 0) pks[dir ^ 1].style.opacity = 0;
        else {
          const b0 = burst; burst += dt * 2.2;
          place(dir ^ 1, ease(Math.min(1, burst)), pks[dir ^ 1]); pks[dir ^ 1].style.opacity = burst < 1 ? 1 : 0;
          if (b0 < 1 && burst >= 1) { land(dir ^ 1); burst = -1; }
        }
        status(p < travel || burst >= 0);
        if (dirEl.textContent === '⇄' && p > 0) dirEl.textContent = dir ? '←' : '→';
      },
      hit() { burst = 0; },
      reset() { pks.forEach(el => (el.style.opacity = 0)); dirEl.textContent = '⇄'; status(false); }
    };
  }

  /* product cube: turns slowly, opens up on hover to show its core, spins a full turn on click */
  function cube(c) {
    const el = c.el.querySelector('.fx-cube');
    let ry = 45, spin = null, ex = 0;
    return {
      frame(dt, t, e, sx, sy) {
        ry += dt * lerp(16, 55, e);
        let extra = 0;
        if (spin) { spin.t += dt / 0.95; const k = 1 - Math.pow(1 - Math.min(1, spin.t), 3); extra = 360 * k; if (spin.t >= 1) { ry += 360; extra = 0; spin = null; } }
        const y = ry + extra + sx * 35, x = -30 - sy * 22;
        ex = lerp(ex, e + (spin ? Math.sin(Math.PI * Math.min(1, spin.t)) * 0.8 : 0), 1 - Math.pow(0.002, dt));
        el.style.setProperty('--ry', y.toFixed(1) + 'deg'); el.style.setProperty('--rx', x.toFixed(1) + 'deg'); el.style.setProperty('--ex', ex.toFixed(3));
        setChip(c, Math.floor((((y - 45) % 360) + 360) % 360 / 120));
      },
      hit() { if (!spin) spin = { t: 0 }; },
      reset() {}
    };
  }

  const KINDS = { agents, sync, cube };
  const cards = [...list.querySelectorAll('[data-fx-card]')].filter(el => KINDS[el.dataset.fxCard]).map(el => {
    const c = { el, tile: el.querySelector('.fx-tile'), chips: [...el.querySelectorAll('.fx-read span')], chip: 0, hover: false, boost: 0, e: 0, px: 0, py: 0, sx: 0, sy: 0 };
    c.fx = KINDS[el.dataset.fxCard](c);
    return c;
  });

  let inView = false, raf = 0, last = 0, t = 0;
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
    const k = 1 - Math.pow(0.015, dt);
    for (const c of cards) {
      c.boost = Math.max(0, c.boost - dt);
      c.e = lerp(c.e, c.hover || c.boost > 0 ? 1 : 0, k);
      c.sx = lerp(c.sx, c.px, k); c.sy = lerp(c.sy, c.py, k);
      c.el.style.setProperty('--sx', c.sx.toFixed(3)); c.el.style.setProperty('--sy', c.sy.toFixed(3));
      c.fx.frame(dt, t, c.e, c.sx, c.sy);
    }
    if (inView && !document.hidden && !still()) raf = requestAnimationFrame(loop);
  }
  function kick() {
    const live = inView && !still();
    list.classList.toggle('is-live', live);
    if (!live) cards.forEach(c => c.fx.reset());
    if (live && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; kick(); }, { rootMargin: '60px 0px' }).observe(list);
  document.addEventListener('visibilitychange', kick);
  new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['class'] });
  rm.addEventListener?.('change', kick);

  for (const c of cards) {
    c.el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { c.hover = true; c.el.classList.add('is-hot'); } });
    c.el.addEventListener('pointerleave', () => { c.hover = false; c.px = c.py = 0; c.el.classList.remove('is-hot'); });
    c.el.addEventListener('pointermove', e => {
      const r = c.el.getBoundingClientRect(), ti = c.tile.getBoundingClientRect();
      c.el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`); c.el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      c.px = clamp((e.clientX - (ti.left + ti.width / 2)) / (r.width * 0.55), -1, 1);
      c.py = clamp((e.clientY - (ti.top + ti.height / 2)) / (r.height * 0.8), -1, 1);
    });
    c.el.addEventListener('click', e => { if (still() || e.target.closest('a')) return; c.boost = 1.6; c.fx.hit(); kick(); });
  }
})();
