/* contact.js — epic contact: WhatsApp smart link + QR, FormSubmit form, aurora, kinetic headline, Oslo clock, globe */
(() => {
  const sec = document.querySelector('#contact[data-contact]');
  if (!sec) return;
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => reduce.matches || html.classList.contains('motion-paused') || document.hidden;
  const PHONE = '201111113628';
  const TO = 'hnasrno@gmail.com', CC = 'h.nasr@medioteq.no';

  /* Kinetic headline */
  const h2 = sec.querySelector('#contact-title');
  if (h2 && !h2.dataset.split) {
    h2.dataset.split = '1'; h2.setAttribute('aria-label', h2.textContent.trim());
    let n = 0;
    const walk = node => [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.append(w); return; }
          const word = document.createElement('span'); word.className = 'cx-word'; word.setAttribute('aria-hidden', 'true');
          [...w].forEach(c => { const s = document.createElement('span'); s.className = 'cx-char'; s.style.setProperty('--i', n++); s.textContent = c; word.append(s); });
          frag.append(word);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) walk(ch);
    });
    walk(h2);
  }
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { sec.classList.add('cx-in'); o.disconnect(); } }, { threshold: .2 }).observe(sec);
  h2?.addEventListener('pointermove', e => {
    if (paused()) return;
    h2.querySelectorAll('.cx-char').forEach(c => { const r = c.getBoundingClientRect(); const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); const k = Math.max(0, 1 - d / 140); c.style.setProperty('--lift', `${-k * 14}px`); });
  });
  h2?.addEventListener('pointerleave', () => h2.querySelectorAll('.cx-char').forEach(c => c.style.removeProperty('--lift')));

  /* Aurora follows pointer */
  sec.addEventListener('pointermove', e => { if (paused()) return; const r = sec.getBoundingClientRect(); sec.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`); sec.style.setProperty('--gy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`); });

  /* Magnetic CTAs */
  if (matchMedia('(pointer: fine)').matches) sec.querySelectorAll('.contact-link, .cx-wa-btn, .cx-submit').forEach(b => {
    b.addEventListener('pointermove', e => { if (paused()) return; const r = b.getBoundingClientRect(); b.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .3}px`; });
    b.addEventListener('pointerleave', () => { b.style.translate = ''; });
  });

  /* Oslo clock + availability */
  const clock = sec.querySelector('[data-cx-clock]'), avail = sec.querySelector('[data-cx-avail]');
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', weekday: 'short' });
  const tick = () => {
    const now = new Date(); if (clock) clock.textContent = fmt.format(now);
    const hr = Number(fmt.format(now).slice(0, 2)), wk = !['Sat', 'Sun'].includes(dayFmt.format(now));
    const on = wk && hr >= 8 && hr < 18;
    if (avail) { avail.textContent = on ? 'Available now' : 'Replies within a day'; avail.parentElement.classList.toggle('is-off', !on); }
  };
  tick(); setInterval(tick, 1000);

  /* WhatsApp smart link */
  const msgs = {
    ai: "Hi Hassan, I found your portfolio and I'd like to talk about AI and automation for my business.",
    product: "Hi Hassan, I'm working on a new product idea and would love your perspective on building it.",
    health: "Hi Hassan, I'd like to discuss a healthcare / MedTech project with you.",
    chat: "Hi Hassan, I came across your portfolio and would love to have a conversation."
  };
  const wa = sec.querySelector('.cx-wa-btn'), preview = sec.querySelector('[data-cx-preview]'), qrBox = sec.querySelector('[data-cx-qr]');
  let topic = 'ai';
  const waUrl = () => `https://wa.me/${PHONE}?text=${encodeURIComponent(msgs[topic])}`;
  let qrLib = null;
  const drawQr = () => {
    if (!qrBox || !qrLib) return;
    const q = qrLib(0, 'M'); q.addData(waUrl()); q.make();
    qrBox.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
    const svg = qrBox.querySelector('svg'); if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'QR code that opens this WhatsApp chat on your phone'); }
  };
  const setTopic = t => {
    topic = t; wa.href = waUrl(); if (preview) preview.textContent = msgs[t];
    sec.querySelectorAll('[data-cx-topic]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cxTopic === t)));
    const sel = sec.querySelector('#cx-topic'); if (sel && !sel.dataset.touched) sel.value = t;
    drawQr();
  };
  sec.querySelectorAll('[data-cx-topic]').forEach(b => b.addEventListener('click', () => setTopic(b.dataset.cxTopic)));
  setTopic('ai');
  if (qrBox && matchMedia('(min-width: 821px)').matches) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'; s.async = true;
    s.onload = () => { qrLib = window.qrcode; drawQr(); };
    s.onerror = () => { qrBox.closest('.cx-qr')?.setAttribute('hidden', ''); };
    document.head.append(s);
  }

  /* Contact form via FormSubmit AJAX */
  const form = sec.querySelector('#cx-form');
  if (form) {
    const status = form.querySelector('[data-cx-status]'), btn = form.querySelector('.cx-submit');
    const topicSel = form.querySelector('#cx-topic'); topicSel?.addEventListener('change', () => { topicSel.dataset.touched = '1'; });
    const labels = { ai: 'AI & automation', product: 'New product', health: 'Healthcare & MedTech', chat: 'Just a conversation' };
    const errFor = el => form.querySelector(`#${el.id}-err`);
    const check = el => {
      let m = '';
      if (el.validity.valueMissing) m = 'This field is required.';
      else if (el.type === 'email' && el.validity.typeMismatch) m = 'Please enter a valid email address.';
      else if (el.validity.tooShort) m = `Please write at least ${el.minLength} characters.`;
      el.setAttribute('aria-invalid', String(!!m)); const e = errFor(el); if (e) e.textContent = m;
      return !m;
    };
    form.querySelectorAll('input:not([name="_honey"]), textarea').forEach(el => { el.addEventListener('blur', () => check(el)); el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); }); });
    const mailto = d => `mailto:${TO},${CC}?subject=${encodeURIComponent(`Portfolio enquiry: ${labels[d.topic] || d.topic}`)}&body=${encodeURIComponent(`${d.message}\n\n${d.name}\n${d.email}`)}`;
    const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const setState = (st, msg) => { form.dataset.state = st; status.innerHTML = msg; };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fields = [...form.querySelectorAll('input:not([name="_honey"]), textarea')];
      const ok = fields.map(check).every(Boolean);
      if (!ok) { fields.find(f => f.getAttribute('aria-invalid') === 'true')?.focus(); setState('invalid', 'Please check the highlighted fields.'); return; }
      const d = Object.fromEntries(new FormData(form));
      if (d._honey) { setState('success', 'Thanks, your message is on its way.'); return; }
      setState('loading', 'Sending…'); btn.disabled = true;
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${TO}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: d.name, email: d.email, topic: labels[d.topic] || d.topic, message: d.message, _replyto: d.email, _cc: CC, _subject: `Portfolio enquiry: ${labels[d.topic] || d.topic} (from ${d.name})`, _template: 'table', _captcha: 'false', _honey: '' })
        });
        const j = await res.json().catch(() => ({}));
        if (String(j.success) !== 'true' && /activat/i.test(j.message || '')) {
          form.reset(); fields.forEach(f => f.removeAttribute('aria-invalid'));
          setState('pending', `Thanks ${esc(d.name.split(' ')[0])}! Your message has been received. The inbox is finishing a one-time setup, so if you don't hear back within a day, please also <a href="${mailto(d)}">email me directly</a>.`);
          return;
        }
        if (!res.ok || String(j.success) !== 'true') throw new Error(j.message || `HTTP ${res.status}`);
        form.reset(); fields.forEach(f => f.removeAttribute('aria-invalid'));
        setState('success', `Thanks ${esc(d.name.split(' ')[0])}! Your message is on its way. I usually reply within a day.`);
      } catch (err) {
        console.warn('Contact form:', err?.message || err);
        const offline = !navigator.onLine;
        const a = document.createElement('a'); a.href = mailto(d); a.textContent = 'open it in your email app';
        setState('error', offline ? "You seem to be offline, so the message wasn't sent. Your text is still here. You can " : "The message didn't go through (the form service didn't respond). Your text is still here. You can try again or ");
        status.append(a, ', addressed to hnasrno@gmail.com and h.nasr@medioteq.no.');
      } finally { btn.disabled = false; }
    });
  }

  /* Connected-globally globe */
  const cv = sec.querySelector('.cx-globe canvas');
  if (cv) {
    const ctx = cv.getContext('2d');
    const cities = [[59.91, 10.75, 'OSLO'], [30.04, 31.24, 'CAIRO'], [25.2, 55.27, 'DUBAI'], [51.5, -.12, 'LONDON'], [40.7, -74, 'NEW YORK'], [1.35, 103.8, 'SINGAPORE']];
    const dots = []; for (let i = 0; i < 520; i++) { const y = 1 - (i / 519) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; dots.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
    const ll = ([la, lo]) => { const a = la * Math.PI / 180, b = lo * Math.PI / 180; return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)]; };
    let rot = -.2, drag = 0, vis = false, raf = 0, last = 0, W = 0, H = 0;
    const fit = () => { const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const proj = ([x, y, z], R, tilt = .35) => { const c = Math.cos(rot), s = Math.sin(rot); const x1 = x * c + z * s, z1 = -x * s + z * c; const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt); return [W / 2 + x1 * R, H / 2 - y2 * R, z2]; };
    const draw = now => {
      ctx.clearRect(0, 0, W, H); const R = Math.min(W, H) * .42, t = now / 1000;
      dots.forEach(p => { const [x, y, z] = proj(p, R); if (z < 0) return; ctx.fillStyle = `rgba(160,190,255,${.12 + z * .35})`; ctx.fillRect(x, y, 1.3, 1.3); });
      const pts = cities.map(c => [ll(c), c[2]]);
      const oslo = pts[0][0];
      pts.slice(1).forEach(([p], i) => {
        ctx.beginPath(); let started = false;
        for (let k = 0; k <= 30; k++) { const u = k / 30; let v = oslo.map((a, j) => a + (p[j] - a) * u); const m = Math.hypot(...v); const lift = 1 + Math.sin(u * Math.PI) * .25; v = v.map(a => a / m * lift); const [x, y, z] = proj(v, R); if (z < -.1) { started = false; continue; } started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; }
        ctx.strokeStyle = 'rgba(255,91,38,.55)'; ctx.lineWidth = 1; ctx.stroke();
        const u = paused() ? .5 : ((t * .35 + i * .2) % 1); let v = oslo.map((a, j) => a + (p[j] - a) * u); const m = Math.hypot(...v); v = v.map(a => a / m * (1 + Math.sin(u * Math.PI) * .25)); const [x, y, z] = proj(v, R); if (z > -.1) { ctx.fillStyle = '#ffb28f'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.283); ctx.fill(); }
      });
      pts.forEach(([p, n], i) => { const [x, y, z] = proj(p, R); if (z < 0) return; ctx.fillStyle = i ? 'rgba(255,170,130,.9)' : '#ff5b26'; ctx.beginPath(); ctx.arc(x, y, i ? 2.4 : 4 + (paused() ? 0 : Math.sin(t * 3) * 1.2), 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(220,228,255,.7)'; ctx.font = '9px "JetBrains Mono", monospace'; ctx.fillText(n, x + 6, y - 4); });
    };
    const loop = now => { raf = 0; const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now; if (!paused()) rot += dt * .18 + drag; drag *= .9; draw(now); if (vis && !paused()) raf = requestAnimationFrame(loop); else last = 0; };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    cv.addEventListener('pointermove', e => { if (e.buttons) { rot += e.movementX * .01; kick(); } });
    new ResizeObserver(() => { fit(); kick(); }).observe(cv);
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }).observe(cv);
    new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['class'] });
  }
})();
