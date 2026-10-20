/* thinking.js — interactive "What I'm thinking about" section */
(() => {
  const sec = document.querySelector('section.perspective[data-thinking]');
  if (!sec) return;
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => reduce.matches || html.classList.contains('motion-paused') || document.hidden;
  const fine = matchMedia('(pointer: fine)').matches;

  /* Headline word reveal */
  const h2 = sec.querySelector('#perspective-title');
  if (h2 && !h2.dataset.split) {
    h2.dataset.split = '1';
    let n = 0;
    const wrap = node => {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) frag.append(w); else { const s = document.createElement('span'); s.className = 'tk-word'; s.style.setProperty('--i', n++); s.textContent = w; frag.append(s); } });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) wrap(ch);
      });
    };
    wrap(h2);
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('tk-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  io.observe(sec);

  /* Section aurora follows pointer */
  sec.addEventListener('pointermove', e => { const r = sec.getBoundingClientRect(); sec.style.setProperty('--ax', `${e.clientX - r.left}px`); sec.style.setProperty('--ay', `${e.clientY - r.top}px`); });

  /* Card visuals */
  const cards = [...sec.querySelectorAll('.tk-card')];
  const states = cards.map(card => ({ card, canvas: card.querySelector('canvas'), px: .5, py: .5, hover: 0, hoverT: 0, w: 0, h: 0 }));
  const ORANGE = '255,91,38', BLUE = '110,160,255';

  const scenes = {
    flow(c, s, t) { // agent nodes routing through a system with a human approval gate
      const { w, h } = s;
      const nodes = [[.1, .5], [.3, .25], [.3, .75], [.55, .5], [.78, .5], [.92, .3], [.92, .7]];
      const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [4, 6]];
      const gate = 4;
      const near = nodes.map(([x, y]) => Math.hypot(x - s.px, (y - s.py) * h / w) < .12);
      c.lineWidth = 1;
      edges.forEach(([a, b]) => { c.strokeStyle = `rgba(${BLUE},.22)`; c.beginPath(); c.moveTo(nodes[a][0] * w, nodes[a][1] * h); c.lineTo(nodes[b][0] * w, nodes[b][1] * h); c.stroke(); });
      const speed = .25 + s.hover * .35;
      const gateOpen = ((t * speed) % 1) > .55 || s.hover > .5;
      edges.forEach(([a, b], i) => {
        for (let k = 0; k < 2; k++) {
          let u = ((t * speed + i * .17 + k * .5) % 1);
          if (b === gate && !gateOpen) u = Math.min(u, .85);
          if (a === gate && !gateOpen) return;
          const x = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * u, y = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * u;
          c.fillStyle = a === gate ? `rgba(${ORANGE},.95)` : `rgba(${BLUE},.9)`;
          c.beginPath(); c.arc(x * w, y * h, 2, 0, 6.283); c.fill();
        }
      });
      nodes.forEach(([x, y], i) => {
        const r = i === gate ? 9 : 5;
        c.fillStyle = i === gate ? (gateOpen ? `rgba(${ORANGE},.9)` : `rgba(${ORANGE},.25)`) : near[i] ? `rgba(${BLUE},.9)` : `rgba(${BLUE},.45)`;
        if (i === gate && gateOpen) { c.shadowColor = `rgb(${ORANGE})`; c.shadowBlur = 14; }
        c.beginPath(); i === gate ? c.rect(x * w - r, y * h - r, r * 2, r * 2) : c.arc(x * w, y * h, r + (near[i] ? 2 : 0), 0, 6.283); c.fill();
        c.shadowBlur = 0;
      });
      c.fillStyle = `rgba(${ORANGE},.85)`; c.font = '9px "JetBrains Mono", monospace'; c.textAlign = 'center';
      c.fillText(gateOpen ? 'HUMAN ✓ APPROVED' : 'AWAITING REVIEW', nodes[gate][0] * w, nodes[gate][1] * h - 16);
    },
    vitals(c, s, t) { // pulsing vital sign + cell network
      const { w, h } = s;
      if (!s.cells) s.cells = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random() * .55 + .05, p: Math.random() * 6 }));
      const bpm = 64 + s.hover * 40 + (1 - s.py) * 20;
      const beatT = (t * bpm / 60) % 1;
      s.cells.forEach((a, i) => s.cells.slice(i + 1).forEach(b => { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < .22) { c.strokeStyle = `rgba(${BLUE},${(1 - d / .22) * .25})`; c.beginPath(); c.moveTo(a.x * w, a.y * h); c.lineTo(b.x * w, b.y * h); c.stroke(); } }));
      s.cells.forEach(a => {
        const dp = Math.hypot(a.x - s.px, a.y - s.py);
        const pulse = Math.max(0, 1 - Math.abs(dp - beatT * .8) * 8);
        c.fillStyle = `rgba(${pulse > .3 ? ORANGE : BLUE},${.4 + pulse * .6})`;
        c.beginPath(); c.arc(a.x * w, a.y * h, 2.2 + pulse * 3, 0, 6.283); c.fill();
      });
      const base = h * .82, beat = x => { const g = (m, sd, a) => a * Math.exp(-((x - m) ** 2) / (2 * sd * sd)); return g(.2, .03, .12) - g(.32, .01, .2) + g(.35, .012, 1) - g(.38, .012, .3) + g(.6, .05, .25); };
      c.strokeStyle = `rgba(${ORANGE},.9)`; c.lineWidth = 1.5; c.beginPath();
      for (let x = 0; x <= w; x += 2) { const v = beat(((x / w) * 1.5 + t * bpm / 60) % 1); x ? c.lineTo(x, base - v * h * .16) : c.moveTo(x, base - v * h * .16); }
      c.stroke(); c.lineWidth = 1;
      c.fillStyle = `rgba(${ORANGE},.85)`; c.font = '9px "JetBrains Mono", monospace'; c.textAlign = 'right';
      c.fillText(`${Math.round(bpm)} BPM`, w - 4, 12);
    },
    roadmap(c, s, t) { // growing branching decision path
      const { w, h } = s;
      const grow = paused() ? 1 : Math.min(1, ((t * .22) % 1.3) / 1) + s.hover * .4;
      const pick = s.py < .5 ? 0 : 1;
      let seg = 0;
      const branch = (x, y, ang, len, depth, chosen) => {
        if (depth > 4) return;
        const id = seg++;
        const prog = Math.max(0, Math.min(1, grow * 5 - depth));
        if (prog <= 0) return;
        const x2 = x + Math.cos(ang) * len * prog, y2 = y + Math.sin(ang) * len * prog;
        c.strokeStyle = chosen ? `rgba(${ORANGE},.9)` : `rgba(${BLUE},.35)`; c.lineWidth = chosen ? 2 : 1;
        c.beginPath(); c.moveTo(x * w, y * h); c.lineTo(x2 * w, y2 * h); c.stroke();
        c.fillStyle = chosen ? `rgb(${ORANGE})` : `rgba(${BLUE},.6)`;
        c.beginPath(); c.arc(x2 * w, y2 * h, chosen ? 3 : 2, 0, 6.283); c.fill();
        if (prog < 1) return;
        const sp = .5 + (s.px - .5) * .4;
        branch(x2, y2, ang - sp, len * .78, depth + 1, chosen && pick === 0);
        branch(x2, y2, ang + sp, len * .78, depth + 1, chosen && pick === 1);
      };
      branch(.06, .5, 0, .2, 0, true);
      c.lineWidth = 1;
      c.fillStyle = `rgba(${ORANGE},.85)`; c.font = '9px "JetBrains Mono", monospace'; c.textAlign = 'right';
      c.fillText(pick ? 'PATH B · SCALE' : 'PATH A · FOCUS', w - 4, 12);
    }
  };

  const fit = s => { const d = Math.min(2, devicePixelRatio || 1); s.w = s.canvas.clientWidth; s.h = s.canvas.clientHeight; s.canvas.width = s.w * d; s.canvas.height = s.h * d; s.canvas.getContext('2d').setTransform(d, 0, 0, d, 0, 0); };
  const render = (s, t) => { const c = s.canvas.getContext('2d'); c.clearRect(0, 0, s.w, s.h); s.hover += ((s.hoverT) - s.hover) * .1; scenes[s.card.dataset.scene](c, s, t); };
  let vis = false, raf = 0;
  const t0 = performance.now();
  const frame = now => { raf = 0; const t = (now - t0) / 1000; states.forEach(s => render(s, t)); if (vis && !paused()) raf = requestAnimationFrame(frame); };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  states.forEach(s => {
    new ResizeObserver(() => { fit(s); kick(); }).observe(s.canvas);
    s.card.addEventListener('pointermove', e => {
      const r = s.canvas.getBoundingClientRect(); s.px = (e.clientX - r.left) / r.width; s.py = (e.clientY - r.top) / r.height; s.hoverT = 1;
      const cr = s.card.getBoundingClientRect(), x = e.clientX - cr.left, y = e.clientY - cr.top;
      s.card.style.setProperty('--sx', `${x}px`); s.card.style.setProperty('--sy', `${y}px`);
      if (fine && !paused()) s.card.style.setProperty('--tilt', `perspective(900px) rotateX(${(.5 - y / cr.height) * 5}deg) rotateY(${(x / cr.width - .5) * 6}deg)`);
      kick();
    });
    s.card.addEventListener('pointerleave', () => { s.hoverT = 0; s.px = s.py = .5; s.card.style.removeProperty('--tilt'); kick(); });
    const btn = s.card.querySelector('.tk-toggle'), more = s.card.querySelector('.tk-more');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open)); more.hidden = !open; s.card.classList.toggle('is-open', open);
      btn.querySelector('.tk-cta').textContent = open ? 'Show less' : 'Read more'; s.hoverT = open ? 1 : 0; kick();
    });
  });
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }, { rootMargin: '100px' }).observe(sec);
  new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', kick);
})();
