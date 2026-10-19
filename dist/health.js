// Interactive clinical platform architecture: wires, flowing packets, lenses and live (simulated) telemetry.
(() => {
  const root = document.querySelector('[data-health-console]');
  if (!root) return;
  const NS = 'http://www.w3.org/2000/svg';
  const board = root.querySelector('[data-hc-board]');
  const svg = board.querySelector('.hc-wires');
  const zone = board.querySelector('.hc-zone');
  const detail = root.querySelector('.hc-detail');
  const dTitle = root.querySelector('[data-hc-title]'), dText = root.querySelector('[data-hc-text]'), dTags = root.querySelector('[data-hc-tags]');
  const html = document.documentElement;

  const INFO = {
    ehr: ['EHR / EPJ', 'Patient records and clinical documentation, accessed through standard FHIR R4 APIs instead of point-to-point exports.', ['FHIR R4', 'SMART on FHIR']],
    devices: ['Medical devices', 'Bedside monitors and IoMT sensors streaming vitals in near real time.', ['HL7 v2', 'IEEE 11073', 'MQTT']],
    lab: ['Lab & imaging', 'Results and imaging metadata from LIS and PACS, normalised on arrival.', ['DICOM', 'HL7 v2', 'LOINC']],
    apps: ['Patient apps', 'Remote monitoring and patient-reported outcomes, only with explicit consent.', ['Consent', 'Remote care']],
    gateway: ['Interoperability gateway', 'One integration surface that turns HL7 v2, DICOM and device feeds into FHIR resources with shared terminology.', ['FHIR', 'SNOMED CT', 'LOINC']],
    identity: ['Identity & consent', 'Every request is authenticated, authorised by role, and checked against patient consent before data moves.', ['OIDC', 'RBAC', 'Consent registry']],
    stream: ['Event stream', 'Clinical events flow through a durable, replayable stream, so models and alerts react in seconds instead of nightly batches.', ['Event-driven', 'Replayable', 'Back-pressure']],
    platform: ['Clinical data platform', 'Encrypted, access-controlled data with a complete audit trail, hosted in-region.', ['AES-256 at rest', 'TLS 1.3', 'Audit log', 'EU/EEA']],
    llm: ['Clinical copilot', 'An LLM assistant grounded in guidelines and the patient record, citing its sources. Clinicians review and decide.', ['RAG', 'Citations', 'Human-in-the-loop']],
    predict: ['Risk models', 'Early-warning and deterioration scores with explanations, monitored for drift and bias after deployment.', ['Explainability', 'Drift monitoring', 'MDR-aware']],
    agents: ['Workflow agents', 'Automates routine work like referrals, coding suggestions and follow-ups, with an approval step for anything clinical.', ['Agentic AI', 'Approval gates', 'Audit']],
    workspace: ['Clinician workspace', 'Insights delivered inside the tools clinicians already use, not another login.', ['SMART on FHIR', 'EHR-embedded']],
    alerts: ['Smart alerts', 'Prioritised, deduplicated alerts that reduce alarm fatigue and reach the right person.', ['Priority routing', 'Escalation']],
    analytics: ['Analytics', 'Quality, capacity and outcome dashboards for clinical and operational leadership.', ['Quality', 'Operations', 'Outcomes']]
  };
  const DEFAULT = ['Bedside to decision', 'Select a component to trace how clinical data moves through the platform, and what protects it along the way.', ['Interoperable', 'Secure by default', 'Human-in-the-loop']];
  const LENS_TEXT = {
    flow: DEFAULT,
    security: ['Security by design', 'Zero-trust access, encryption in transit and at rest, consent checks and a full audit trail, all inside an EU/EEA secure zone.', ['GDPR', 'Normen', 'Zero trust', 'Audit trail']],
    ai: ['Responsible clinical AI', 'Every model is grounded, explainable and monitored. AI suggests, clinicians decide, and every action is logged.', ['Human-in-the-loop', 'Explainability', 'Drift monitoring', 'EU AI Act-ready']]
  };
  const EDGES = [
    ['ehr', 'gateway'], ['devices', 'gateway'], ['lab', 'gateway'], ['apps', 'identity'], ['apps', 'gateway'],
    ['gateway', 'stream'], ['identity', 'platform'], ['gateway', 'platform'],
    ['stream', 'predict'], ['stream', 'platform'], ['platform', 'llm'], ['platform', 'predict'], ['platform', 'agents'],
    ['llm', 'workspace'], ['predict', 'alerts'], ['agents', 'workspace'], ['predict', 'analytics'], ['platform', 'analytics']
  ];
  const nodes = Object.fromEntries([...board.querySelectorAll('.hc-node')].map(n => [n.dataset.node, n]));
  const out = id => EDGES.filter(e => e[0] === id);

  /* ---------- Wires ---------- */
  let wires = [];
  function layout() {
    const b = board.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    svg.replaceChildren();
    const badges = [];
    const rect = id => { const r = nodes[id].getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };
    wires = EDGES.map(([a, z]) => {
      const A = rect(a), Z = rect(z);
      const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, cz = { x: Z.x + Z.w / 2, y: Z.y + Z.h / 2 };
      let d;
      if (Math.abs(cz.x - ca.x) > Math.abs(cz.y - ca.y)) {
        const x1 = A.x + A.w, x2 = Z.x, m = (x1 + x2) / 2;
        d = `M${x1} ${ca.y} C${m} ${ca.y} ${m} ${cz.y} ${x2} ${cz.y}`;
      } else {
        const y1 = cz.y > ca.y ? A.y + A.h : A.y, y2 = cz.y > ca.y ? Z.y : Z.y + Z.h, m = (y1 + y2) / 2;
        d = `M${ca.x} ${y1} C${ca.x} ${m} ${cz.x} ${m} ${cz.x} ${y2}`;
      }
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('class', 'hc-wire');
      svg.append(path);
      const len = path.getTotalLength();
      const mid = path.getPointAtLength(len / 2);
      if (badges.some(b => Math.hypot(b.x - mid.x, b.y - mid.y) < 26)) return { a, z, path, len };
      badges.push(mid);
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('class', 'hc-lock-bg'); bg.setAttribute('x', mid.x - 16); bg.setAttribute('y', mid.y - 7); bg.setAttribute('width', 32); bg.setAttribute('height', 14); bg.setAttribute('rx', 7);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'hc-lock'); t.setAttribute('x', mid.x); t.setAttribute('y', mid.y + 3); t.setAttribute('text-anchor', 'middle');
      t.textContent = 'TLS';
      svg.append(bg, t);
      return { a, z, path, len };
    });
    packetLayer = document.createElementNS(NS, 'g');
    svg.append(packetLayer);
    packets.forEach(p => { p.el = makePacket(); });
    // secure zone around integration + platform columns
    const cols = [...board.querySelectorAll('.hc-col[data-col="integration"], .hc-col[data-col="platform"]')].map(c => c.getBoundingClientRect());
    const zx = Math.max(2, Math.min(...cols.map(r => r.left)) - b.left - 10), zy = Math.min(...cols.map(r => r.top)) - b.top - 14;
    const zr = Math.min(b.width - 2, Math.max(...cols.map(r => r.right)) - b.left + 10), zb = Math.max(...cols.map(r => r.bottom)) - b.top + 10;
    Object.assign(zone.style, { left: `${zx}px`, top: `${zy}px`, width: `${zr - zx}px`, height: `${zb - zy}px` });
    applyTrace();
  }

  /* ---------- Packets travel the whole pipeline ---------- */
  let packetLayer = null;
  const packets = [];
  const makePacket = () => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.6); c.setAttribute('class', 'hc-packet'); packetLayer.append(c); return c; };
  const sources = ['ehr', 'devices', 'lab', 'apps'];
  function spawn() {
    const from = sources[Math.random() * sources.length | 0];
    const choices = out(from);
    const edge = choices[Math.random() * choices.length | 0];
    packets.push({ edge: EDGES.indexOf(edge), t: 0, speed: 0.55 + Math.random() * 0.35, el: makePacket() });
  }
  function step(dt) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i], w = wires[p.edge];
      if (!w) { p.el.remove(); packets.splice(i, 1); continue; }
      p.t += dt * p.speed * (180 / Math.max(w.len, 60));
      if (p.t >= 1) {
        nodes[w.z].classList.add('is-pulse');
        setTimeout(() => nodes[w.z].classList.remove('is-pulse'), 220);
        const next = out(w.z);
        if (!next.length) { p.el.remove(); packets.splice(i, 1); continue; }
        p.edge = EDGES.indexOf(next[Math.random() * next.length | 0]);
        p.t = 0;
        continue;
      }
      const pt = w.path.getPointAtLength(p.t * w.len);
      p.el.setAttribute('cx', pt.x.toFixed(1)); p.el.setAttribute('cy', pt.y.toFixed(1));
      p.el.style.opacity = traced && !(traced.has(w.a) && traced.has(w.z)) ? 0.15 : 1;
    }
  }

  /* ---------- Tracing + detail panel ---------- */
  let traced = null, selected = null;
  function connected(id) {
    const set = new Set([id]);
    const walk = (cur, dir) => EDGES.forEach(([a, z]) => {
      const [from, to] = dir ? [a, z] : [z, a];
      if (from === cur && !set.has(to)) { set.add(to); walk(to, dir); }
    });
    walk(id, true); walk(id, false);
    return set;
  }
  function applyTrace() {
    board.classList.toggle('is-tracing', !!traced);
    Object.entries(nodes).forEach(([id, n]) => n.classList.toggle('is-hot', !!traced && traced.has(id)));
    wires.forEach(w => w.path.classList.toggle('is-hot', !!traced && traced.has(w.a) && traced.has(w.z)));
  }
  function showDetail([title, text, tags]) {
    dTitle.textContent = title; dText.textContent = text;
    dTags.replaceChildren(...tags.map(t => Object.assign(document.createElement('li'), { textContent: t })));
    detail.classList.remove('is-swapping'); void detail.offsetWidth; detail.classList.add('is-swapping');
  }
  function focusNode(id) {
    traced = id ? connected(id) : null;
    applyTrace();
    showDetail(id ? INFO[id] : LENS_TEXT[root.dataset.lens]);
  }
  Object.entries(nodes).forEach(([id, n]) => {
    n.addEventListener('mouseenter', () => focusNode(id));
    n.addEventListener('focus', () => focusNode(id));
    n.addEventListener('mouseleave', () => focusNode(selected));
    n.addEventListener('blur', () => focusNode(selected));
    n.addEventListener('click', () => {
      selected = selected === id ? null : id;
      Object.values(nodes).forEach(x => x.classList.toggle('is-selected', x.dataset.node === selected));
      focusNode(selected || id);
    });
  });
  root.querySelectorAll('[data-lens-btn]').forEach(btn => btn.addEventListener('click', () => {
    root.dataset.lens = btn.dataset.lensBtn;
    root.querySelectorAll('[data-lens-btn]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    selected = null; Object.values(nodes).forEach(x => x.classList.remove('is-selected'));
    traced = null; applyTrace();
    showDetail(LENS_TEXT[btn.dataset.lensBtn]);
  }));

  /* ---------- Device ECG + simulated telemetry ---------- */
  const ecg = root.querySelector('.hc-ecg');
  const ectx = ecg.getContext('2d');
  const beat = x => { const g = (m, s, a) => a * Math.exp(-((x - m) ** 2) / (2 * s * s)); return g(.2, .03, .12) - g(.32, .01, .2) + g(.35, .012, 1) - g(.38, .012, .3) + g(.6, .05, .25); };
  function drawEcg(time) {
    const w = ecg.width = ecg.clientWidth * 2, h = ecg.height = ecg.clientHeight * 2;
    ectx.strokeStyle = '#ff5b26'; ectx.lineWidth = 2; ectx.beginPath();
    const mode = root.dataset.ecgMode || 'ecg', rate = Number(root.dataset.rate || 1), since = (performance.now() - Number(root.dataset.pulse || -1e9)) / 1000;
    ectx.strokeStyle = mode === 'spo2' ? '#4fd1ff' : mode === 'eeg' ? '#b28cff' : '#ff5b26';
    const wave = u => mode === 'spo2' ? Math.max(0, Math.sin(u * Math.PI * 2)) ** 3 * .8 + Math.max(0, Math.sin(u * Math.PI * 4 - 1)) * .12 : mode === 'eeg' ? (Math.sin(u * 61) * .18 + Math.sin(u * 23 + 1) * .14 + Math.sin(u * 97) * .06) + .3 : beat(u);
    for (let x = 0; x <= w; x += 2) { const xr = x / w; const boost = since < 1.2 ? 1 + Math.exp(-((xr - (1 - since / 1.2)) ** 2) / .004) * 1.2 : 1; const v = wave(((xr) * 1.6 + time * 1.2 * rate) % 1) * boost; x ? ectx.lineTo(x, h * .7 - v * h * .6) : ectx.moveTo(x, h * .7 - v * h * .6); }
    ectx.stroke();
  }
  const metric = k => root.querySelector(`[data-m="${k}"]`);
  let tps = 1248, p95 = 138;
  function tickMetrics() {
    tps = Math.round(Math.min(1420, Math.max(1080, tps + (Math.random() - .5) * 60)));
    p95 = Math.round(Math.min(170, Math.max(112, p95 + (Math.random() - .5) * 8)));
    metric('tps').textContent = `${tps.toLocaleString('en-US')} msg/s`;
    metric('p95').textContent = `${p95} ms`;
    metric('avail').textContent = `${(99.97 + Math.random() * 0.02).toFixed(2)}%`;
  }

  /* ---------- Loop ---------- */
  let visible = false, raf = 0, last = 0, spawnAcc = 0, metricAcc = 0;
  const running = () => visible && !document.hidden && !html.classList.contains('motion-paused');
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    spawnAcc += dt; metricAcc += dt;
    if (spawnAcc > 0.28 && packets.length < 26) { spawnAcc = 0; spawn(); }
    if (metricAcc > 1.2) { metricAcc = 0; tickMetrics(); }
    step(dt);
    drawEcg(now / 1000);
    if (running()) raf = requestAnimationFrame(frame); else last = 0;
  }
  const sync = () => { if (running() && !raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '100px' }).observe(root);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
  new ResizeObserver(() => layout()).observe(board);
  layout();
  for (let i = 0; i < 10; i++) { spawn(); packets[packets.length - 1].t = Math.random(); }
  drawEcg(0);
})();
