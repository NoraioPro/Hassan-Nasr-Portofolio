/* workshops.js: AI Workshops for leaders (readiness check, journey, smart booking wizard) */
(() => {
  const sec = document.querySelector('#workshops[data-ws]');
  if (!sec) return;
  const html = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => rm.matches || html.classList.contains('motion-paused');
  const TO = 'hnasrno@gmail.com', CC = 'h.nasr@medioteq.no', PHONE = '201111113628';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const W = { exec: ['Executive AGI Briefing', 'Half day', 4], sprint: ['AI Strategy & Roadmap Sprint', '1–2 days', 8], agentic: ['Agentic AI in Practice', '1 day', 7], responsible: ['Responsible AI & Capabilities/Limits', 'Half day', 4], health: ['Healthcare & MedTech AI', 'Half day to 1 day', 6] };

  /* journey + entrance */
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { sec.classList.add('ws-in'); o.disconnect(); } }, { threshold: .12 }).observe(sec);

  /* readiness check */
  const QS = [
    ['role', 'Your role', [['ceo', 'CEO / Board'], ['tech', 'CTO / IT'], ['ops', 'Operations / Business'], ['clin', 'Clinical / Health']]],
    ['use', 'AI in your company today', [['none', 'Not yet', 0], ['exp', 'Experiments', 1], ['prod', 'Some in production', 2], ['scale', 'Scaling', 3]]],
    ['data', 'Your data', [['scat', 'Scattered', 0], ['part', 'Partly organised', 1], ['gov', 'Well governed', 2]]],
    ['goal', 'Main goal', [['strategy', 'Strategy'], ['auto', 'Automation & productivity'], ['product', 'New products'], ['risk', 'Governance & risk']]],
    ['when', 'Timeline', [['explore', 'Exploring', 0], ['quarter', 'This quarter', 1], ['urgent', 'Urgent', 2]]]
  ];
  const ans = {};
  const qsEl = sec.querySelector('.ws-qs');
  qsEl.innerHTML = QS.map(([k, label, opts]) => `<div class="ws-q" role="group" aria-label="${esc(label)}"><span class="mono">${esc(label)}</span><div class="ws-chips">${opts.map(([v, l]) => `<button type="button" class="chip" data-q="${k}" data-v="${v}" aria-pressed="false">${esc(l)}</button>`).join('')}</div></div>`).join('');
  const gauge = sec.querySelector('.ws-g-fg'), scoreEl = sec.querySelector('[data-ws-score]'), recEl = sec.querySelector('[data-ws-rec]'), useBtn = sec.querySelector('[data-ws-use]');
  const LEN = 157.08; gauge.style.strokeDasharray = LEN; gauge.style.strokeDashoffset = LEN;
  let recommended = null;
  function evaluate() {
    const lvl = (k, max) => { const o = QS.find(q => q[0] === k)[2].find(o => o[0] === ans[k]); return o ? o[2] / max : 0; };
    const done = Object.keys(ans).length;
    const score = Math.round((lvl('use', 3) * 45 + lvl('data', 2) * 35 + lvl('when', 2) * 20) * (done ? 1 : 0));
    gauge.style.strokeDashoffset = String(LEN * (1 - score / 100));
    gauge.style.stroke = score < 35 ? '#7fb0ff' : score < 70 ? '#ffb347' : '#33d17a';
    if (done < 5) { scoreEl.textContent = `${score}`; recEl.textContent = `${5 - done} more to go…`; useBtn.hidden = true; return; }
    let r = 'sprint';
    if (ans.role === 'clin') r = 'health'; else if (ans.goal === 'risk') r = 'responsible'; else if (ans.goal === 'auto' && ans.use !== 'none') r = 'agentic'; else if (ans.role === 'ceo' && (ans.use === 'none' || ans.use === 'exp')) r = 'exec';
    recommended = r;
    const stage = score < 35 ? 'Aware' : score < 60 ? 'Experiment' : score < 85 ? 'Operationalize' : 'Transform';
    scoreEl.textContent = `${score}/100 · ${stage}`;
    recEl.innerHTML = `Recommended: <strong>${esc(W[r][0])}</strong> (${esc(W[r][1])}).`;
    useBtn.hidden = false;
    sec.querySelectorAll('.ws-journey li').forEach((li, i) => li.classList.toggle('is-you', ['Aware', 'Experiment', 'Operationalize', 'Transform'][i] === stage));
    sec.querySelectorAll('.ws-card').forEach(c => c.classList.toggle('is-rec', c.dataset.wsId === r));
  }
  qsEl.addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; ans[b.dataset.q] = b.dataset.v; qsEl.querySelectorAll(`[data-q="${b.dataset.q}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b))); evaluate(); });

  /* wizard */
  const form = sec.querySelector('#ws-form');
  const panes = [...form.querySelectorAll('[data-step-pane]')], steps = [...form.querySelectorAll('.ws-steps li')];
  const nextBtn = form.querySelector('[data-ws-next]'), backBtn = form.querySelector('[data-ws-back]'), status = form.querySelector('[data-ws-status]');
  form.querySelector('[data-ws-choices]').innerHTML = Object.entries(W).map(([k, [t, d]], i) => `<label><input type="radio" name="workshop" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`).join('');
  let step = 1;
  const KEY = 'hn-workshop-draft';
  const draftEl = form.querySelector('[data-ws-draft]');
  /* dates */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const minD = new Date(); minD.setDate(minD.getDate() + 14); while ([0, 6].includes(minD.getDay())) minD.setDate(minD.getDate() + 1);
  const maxD = new Date(); maxD.setFullYear(maxD.getFullYear() + 1);
  ['date1', 'date2', 'date3'].forEach(n => { const i = form.elements[n]; i.min = iso(minD); i.max = iso(maxD); });
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const osloOffsetMin = date => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Oslo', timeZoneName: 'shortOffset' }).formatToParts(date).find(x => x.type === 'timeZoneName')?.value || 'GMT+1'; const m = p.match(/GMT([+-])(\d+)(?::(\d+))?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 60; };
  const osloToDate = (ds, hh) => { const [y, mo, d] = ds.split('-').map(Number); const guess = new Date(Date.UTC(y, mo - 1, d, hh)); return new Date(guess.getTime() - osloOffsetMin(guess) * 60000); };
  const SLOTS = [['09:00', 9], ['13:00', 13]];
  const slotsEl = form.querySelector('[data-ws-slots]'), tzEl = form.querySelector('[data-ws-tz]');
  function renderSlots() {
    const ds = form.elements.date1.value || iso(minD);
    const cur = form.querySelector('input[name="slot"]:checked')?.value || '09:00';
    const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: userTZ });
    slotsEl.innerHTML = SLOTS.map(([l, h]) => `<label><input type="radio" name="slot" value="${l}" ${l === cur ? 'checked' : ''}><span><b>${l} Oslo</b><small>${fmt.format(osloToDate(ds, h))} your time</small></span></label>`).join('');
    tzEl.textContent = `Times shown in Oslo (Europe/Oslo) and your time zone (${userTZ}).`;
  }
  const isWeekday = ds => { const d = new Date(ds + 'T12:00:00'); return ![0, 6].includes(d.getDay()); };
  const setErr = (n, m) => { const e = form.querySelector(`[data-err="${n}"]`); if (e) e.textContent = m; const el = form.elements[n]; if (el && el.setAttribute) el.setAttribute('aria-invalid', String(!!m)); return !m; };
  function validate(s) {
    let ok = true;
    const req = (n, msg) => { const el = form.elements[n]; let m = ''; if (el.validity.valueMissing) m = msg || 'This field is required.'; else if (el.type === 'email' && el.validity.typeMismatch) m = 'Please enter a valid email address.'; else if (el.validity.tooShort) m = `Please write at least ${el.minLength} characters.`; ok = setErr(n, m) && ok; };
    if (s === 2) { req('company'); req('name'); req('email'); }
    if (s === 4) {
      ['date1', 'date2', 'date3'].forEach((n, i) => {
        const v = form.elements[n].value; let m = '';
        if (!v && i === 0) m = 'Pick at least one date.';
        else if (v && v < iso(minD)) m = `Earliest is ${iso(minD)} (2 weeks ahead).`;
        else if (v && v > iso(maxD)) m = 'Please pick a date within 12 months.';
        else if (v && !isWeekday(v)) m = 'Please pick a weekday.';
        ok = setErr(n, m) && ok;
      });
    }
    if (s === 5) req('goals');
    if (!ok) form.querySelector('[aria-invalid="true"]')?.focus();
    return ok;
  }
  const val = () => { const d = Object.fromEntries(new FormData(form)); d.workshopTitle = W[d.workshop]?.[0] || d.workshop; return d; };
  function summary() {
    const d = val(); const dates = [d.date1, d.date2, d.date3].filter(Boolean).join(', ');
    const rows = [['Workshop', d.workshopTitle], ['Company', d.company], ['Contact', `${d.name} · ${d.role} · ${d.email}`], ['Team', `${d.size} · ${d.industry}`], ['Format', `${d.format} · ${d.language}`], ['Dates', `${dates} · ${d.slot} Oslo`]];
    form.querySelector('[data-ws-summary]').innerHTML = rows.map(([k, v]) => `<dt class="mono">${k}</dt><dd>${esc(v)}</dd>`).join('');
  }
  function go(s, focus = true) {
    step = Math.max(1, Math.min(5, s)); form.dataset.step = step;
    panes.forEach(p => { p.hidden = +p.dataset.stepPane !== step; });
    steps.forEach(li => { const n = +li.dataset.s; li.classList.toggle('is-done', n < step); li.classList.toggle('is-now', n === step); if (n === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    backBtn.disabled = step === 1;
    form.querySelector('[data-ws-next-label]').textContent = step === 5 ? 'Send booking request' : 'Next';
    if (step === 4) renderSlots();
    if (step === 5) summary();
    if (focus) panes[step - 1].querySelector('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea')?.focus({ preventScroll: true });
  }
  const save = () => { try { const d = Object.fromEntries(new FormData(form)); delete d._honey; localStorage.setItem(KEY, JSON.stringify({ d, step, t: Date.now() })); draftEl.textContent = 'Draft saved on this device.'; } catch {} };
  const restore = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!s) return; Object.entries(s.d).forEach(([k, v]) => { const els = form.querySelectorAll(`[name="${k}"]`); els.forEach(el => { if (el.type === 'radio') el.checked = el.value === v; else el.value = v; }); }); draftEl.textContent = 'Draft restored from this device.'; go(s.step || 1, false); } catch {} };
  form.addEventListener('input', save); form.addEventListener('change', e => { save(); if (e.target.name === 'date1') renderSlots(); });
  backBtn.addEventListener('click', () => go(step - 1));
  const pick = id => { const r = form.querySelector(`input[name="workshop"][value="${id}"]`); if (r) r.checked = true; save(); go(1, false); form.scrollIntoView({ behavior: paused() ? 'auto' : 'smooth', block: 'start' }); setTimeout(() => r?.focus({ preventScroll: true }), paused() ? 0 : 500); };
  sec.addEventListener('click', e => { const b = e.target.closest('[data-ws-pick]'); if (b) pick(b.dataset.wsPick); });
  useBtn.addEventListener('click', () => recommended && pick(recommended));
  window.__pickWorkshop = pick;
  /* ics */
  const icsStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function makeIcs(d) {
    const start = osloToDate(d.date1, +d.slot.slice(0, 2)); const hours = W[d.workshop]?.[2] || 4; const end = new Date(start.getTime() + hours * 3600000);
    const t = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hassan Nasr//Workshop booking//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:ws-${Date.now()}@hassannasr`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${t(`TENTATIVE: ${d.workshopTitle} with Hassan Nasr`)}`, `DESCRIPTION:${t(`Tentative hold, pending confirmation from Hassan.\nCompany: ${d.company}\nFormat: ${d.format} (${d.language})\nGoals: ${d.goals}`)}`, `LOCATION:${t(d.format)}`, 'STATUS:TENTATIVE', 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  }
  const waText = d => `Hi Hassan, I just requested a workshop booking:\n• ${d.workshopTitle}\n• ${d.company} (${d.role}, team ${d.size}, ${d.industry})\n• ${d.format}, ${d.language}\n• Dates: ${[d.date1, d.date2, d.date3].filter(Boolean).join(', ')} at ${d.slot} Oslo\n— ${d.name}`;
  const done = form.querySelector('[data-ws-done]');
  async function submit() {
    const d = val();
    if (d._honey) { finish(d, 'Thanks, your request is on its way.'); return; }
    form.dataset.state = 'loading'; status.textContent = 'Sending…'; nextBtn.disabled = true;
    const payload = { workshop: d.workshopTitle, company: d.company, name: d.name, email: d.email, role: d.role, team_size: d.size, industry: d.industry, format: d.format, language: d.language, preferred_dates: [d.date1, d.date2, d.date3].filter(Boolean).join(', '), start_time: `${d.slot} Oslo (visitor time zone: ${userTZ})`, goals: d.goals, _replyto: d.email, _cc: CC, _subject: `Workshop booking: ${d.workshopTitle} — ${d.company}`, _template: 'table', _captcha: 'false', _honey: '' };
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${TO}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (String(j.success) !== 'true' && /activat/i.test(j.message || '')) { finish(d, `Thanks ${esc(d.name.split(' ')[0])}! Your request has been received. The inbox is finishing a one-time setup, so please also send the WhatsApp follow-up below.`, 'pending'); return; }
      if (!res.ok || String(j.success) !== 'true') throw new Error(j.message || `HTTP ${res.status}`);
      finish(d, `Thanks ${esc(d.name.split(' ')[0])}! Your booking request is on its way. I'll confirm a date within a working day.`);
    } catch (err) {
      console.warn('Workshop booking:', err?.message || err);
      form.dataset.state = 'error';
      const body = Object.entries(payload).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n');
      status.innerHTML = `The request didn't go through (the form service didn't respond). Your details are still here. Try again, <a href="mailto:${TO},${CC}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}">send it by email</a>, or <a href="https://wa.me/${PHONE}?text=${encodeURIComponent(waText(d))}" target="_blank" rel="noopener noreferrer">send it on WhatsApp</a>.`;
    } finally { nextBtn.disabled = false; }
  }
  function finish(d, msg, st = 'success') {
    form.dataset.state = st; status.innerHTML = msg;
    form.querySelector('[data-ws-ics]').href = makeIcs(d);
    form.querySelector('[data-ws-wa]').href = `https://wa.me/${PHONE}?text=${encodeURIComponent(waText(d))}`;
    panes.forEach(p => { p.hidden = true; }); form.querySelector('.ws-nav').hidden = true; done.hidden = false;
    try { localStorage.removeItem(KEY); } catch {} draftEl.textContent = '';
    form.querySelector('[data-ws-ics]').focus({ preventScroll: true });
  }
  form.querySelector('[data-ws-new]').addEventListener('click', () => { form.reset(); done.hidden = true; form.querySelector('.ws-nav').hidden = false; form.dataset.state = 'idle'; status.textContent = ''; go(1); });
  nextBtn.addEventListener('click', () => { if (!validate(step)) { status.textContent = 'Please check the highlighted fields.'; return; } status.textContent = ''; if (step < 5) go(step + 1); else submit(); });
  form.addEventListener('submit', e => { e.preventDefault(); nextBtn.click(); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio') { e.preventDefault(); nextBtn.click(); } });
  go(1, false); restore();
})();
