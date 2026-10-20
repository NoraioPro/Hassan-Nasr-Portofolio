/* portrait.js: Hassan Nasr Neural Portrait. Restored from voice-agent/assets/avatar (three.js relief head),
   embedded as a panel, re-tinted to the site palette, plus lip-sync (speechSynthesis) and captions. */
const root = document.querySelector('[data-np]');
if (root) init().catch(err => { console.warn('Neural portrait fallback:', err?.message || err); root.classList.add('np-fallback'); });

async function init() {
  const html = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = rm.matches;
  const motionOff = () => rm.matches || html.classList.contains('motion-paused');
  const $ = s => root.querySelector(s);
  const canvas = $('.np-stage canvas');
  const BASE = root.dataset.base || 'assets/avatar/';

  /* ---------- speech + captions (independent of WebGL so it works in fallback too) ---------- */
  const SCRIPT = "Hi, I'm Hassan Nasr, CTO at Medioteq AS, based in Oslo. I'm a technology leader and founder. I build AI architecture for health, enterprise software and digital transformation, across Norway, the Gulf and Egypt. What I care about is intelligence that is actually useful: systems people can trust, built to fit real work. Move your cursor and I'll follow you. Click, and I'll wink.";
  const capEl = $('[data-np-captions]');
  const words = []; { const re = /\S+/g; let m; while ((m = re.exec(SCRIPT))) words.push({ w: m[0], i: m.index }); }
  capEl.innerHTML = words.map((w, k) => `<span data-k="${k}">${w.w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
  const capSpans = [...capEl.children];
  const mouth = { open: 0, width: 1, target: 0, wTarget: 1, speaking: false };
  let visemes = [], vStart = 0, curWord = -1, boundarySeen = false, timer = 0;
  const visemeOf = ch => {
    ch = ch.toLowerCase();
    if ('a'.includes(ch)) return [0.9, 0.85];
    if ('ei'.includes(ch)) return [0.5, 1.05];
    if ('oúuw'.includes(ch)) return [0.6, 0.45];
    if ('mbp'.includes(ch)) return [0, 0.9];
    if ('fv'.includes(ch)) return [0.14, 0.95];
    if ('lnt d'.includes(ch)) return [0.3, 1];
    if (/[a-z]/.test(ch)) return [0.35, 0.95];
    return [0.05, 1];
  };
  const wordDur = w => Math.max(0.16, w.replace(/[^a-z']/gi, '').length * 0.068) / rate;
  const pauseAfter = w => /[.,:;!?]$/.test(w) ? (/[.!?]$/.test(w) ? 0.34 : 0.18) / rate : 0.04 / rate;
  let rate = 1;
  function scheduleWord(k, t0) {
    const w = words[k].w, letters = w.replace(/[^a-z']/gi, '') || 'a', d = wordDur(w);
    for (let j = 0; j < letters.length; j++) visemes.push({ t: t0 + d * j / letters.length, v: visemeOf(letters[j]) });
    visemes.push({ t: t0 + d, v: [0.04, 1] });
    return t0 + d + pauseAfter(w);
  }
  function highlight(k) {
    if (k === curWord) return; curWord = k;
    capSpans.forEach((s, j) => { s.classList.toggle('is-now', j === k); s.classList.toggle('is-done', j < k); });
    const s = capSpans[k]; if (s) capEl.scrollTo?.({ top: s.offsetTop - capEl.clientHeight / 2, behavior: 'auto' });
  }
  function timedRun(fromWord, now) { // used when no boundary events (or no speechSynthesis)
    visemes = []; vStart = now; let t = 0; const starts = [];
    for (let k = fromWord; k < words.length; k++) { starts.push([k, t]); t = scheduleWord(k, t); }
    return { starts, total: t };
  }
  let timed = null;
  const synth = 'speechSynthesis' in window ? speechSynthesis : null;
  const pickVoice = () => {
    const vs = synth?.getVoices() || []; const en = vs.filter(v => /^en(-|_|$)/i.test(v.lang));
    const pref = [/Microsoft (Guy|Andrew|Brian|Christopher|Eric|Ryan|Davis|Roger|Steffan) Online/i, /Google UK English Male/i, /Daniel/i, /(Guy|Andrew|Brian|Ryan|Christopher|Davis|Eric|Thomas|Oliver|Alex|Fred|Arthur|Aaron|Rishi)/i, /male/i, /David|Mark|George|James/i];
    for (const r of pref) { const v = en.find(v => r.test(v.name)); if (v) return v; }
    return en[0] || vs[0] || null;
  };
  synth?.addEventListener?.('voiceschanged', () => {});
  const talkBtn = $('[data-np-talk]'), stopBtn = $('[data-np-stop]'), voiceEl = $('[data-np-voice]');
  function setSpeaking(on) {
    mouth.speaking = on; root.classList.toggle('is-speaking', on);
    talkBtn.setAttribute('aria-pressed', String(on)); talkBtn.querySelector('span').textContent = on ? 'Speaking…' : 'Talk to me';
    stopBtn.disabled = !on; kick();
    if (on && !ready) requestAnimationFrame(capLoop);
  }
  function capLoop() { if (!mouth.speaking || ready) return; driveMouth(performance.now() / 1000); requestAnimationFrame(capLoop); }
  function stop() {
    clearTimeout(timer); timed = null; visemes = []; mouth.target = 0; mouth.wTarget = 1;
    if (synth) synth.cancel();
    setSpeaking(false);
  }
  function speak() {
    stop(); curWord = -1; highlight(-1); capEl.hidden = false;
    const now = performance.now() / 1000;
    boundarySeen = false;
    if (!synth) { voiceEl.textContent = 'Captions only (no speech in this browser)'; timed = timedRun(0, now); setSpeaking(true); return; }
    const u = new SpeechSynthesisUtterance(SCRIPT);
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.rate = rate = 0.98; u.pitch = 0.92;
    voiceEl.textContent = `Synthetic voice${v ? ` · ${v.name.replace(/Microsoft |Google | Online \(Natural\)|\(.*?\)/g, '').trim()}` : ''}`;
    let started = false;
    u.onstart = () => { started = true; setSpeaking(true); timer = setTimeout(() => { if (!boundarySeen && mouth.speaking) timed = timedRun(Math.max(0, curWord), performance.now() / 1000); }, 700); };
    u.onboundary = e => {
      if (e.name && e.name !== 'word') return;
      boundarySeen = true; timed = null;
      const k = words.findIndex((w, j) => w.i <= e.charIndex && (j === words.length - 1 || words[j + 1].i > e.charIndex));
      if (k < 0) return;
      highlight(k); visemes = []; vStart = performance.now() / 1000; scheduleWord(k, 0);
    };
    u.onend = () => { highlight(words.length); setSpeaking(false); mouth.target = 0; };
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') { voiceEl.textContent = 'Speech unavailable · captions only'; timed = timedRun(0, performance.now() / 1000); setSpeaking(true); } };
    synth.speak(u);
    setSpeaking(true);
    setTimeout(() => { if (!started && mouth.speaking && !timed && !boundarySeen) { voiceEl.textContent += ' · captions timed (no audio events)'; timed = timedRun(0, performance.now() / 1000); } }, 1500);
  }
  talkBtn.addEventListener('click', () => mouth.speaking ? stop() : speak());
  stopBtn.addEventListener('click', stop);
  addEventListener('pagehide', stop);
  function driveMouth(now) {
    if (!mouth.speaking) { mouth.target = 0; mouth.wTarget = 1; }
    else {
      if (timed) {
        const t = now - vStart; let k = -1;
        for (const [w, st] of timed.starts) if (st <= t) k = w; else break;
        highlight(k);
        if (t > timed.total + 0.2) { timed = null; highlight(words.length); setSpeaking(false); }
      }
      const t = now - vStart; let cur = null;
      for (const v of visemes) if (v.t <= t) cur = v; else break;
      if (cur) { const amp = 0.78 + 0.22 * Math.sin(now * 23) * Math.sin(now * 9.7); mouth.target = cur.v[0] * amp; mouth.wTarget = cur.v[1]; }
      if (visemes.length && t > visemes[visemes.length - 1].t + 0.25) mouth.target *= 0.9;
    }
    mouth.open += (mouth.target - mouth.open) * 0.38;
    mouth.width += (mouth.wTarget - mouth.width) * 0.3;
    const lips = $('.np-lips'); if (lips) lips.style.setProperty('--open', mouth.open.toFixed(3));
  }

  let ready = false, vis = false, raf = 0;
  /* ---------- WebGL head ---------- */
  // Load three.js only when the portrait is near the viewport.
  await new Promise(res => { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); res(); } }, { rootMargin: '600px 0px' }); io.observe(root); });
  let THREE;
  try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'); } catch (e) { throw new Error('three.js failed to load'); }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false }); } catch (e) { throw new Error('WebGL unavailable'); }
  renderer.debug.checkShaderErrors = false; // avoid synchronous shader-status stalls
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x050912, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050912);
  scene.fog = new THREE.FogExp2(0x050912, 0.09);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0.15, 6.2);
  const meshData = await (await fetch(BASE + 'mesh.json')).json();
  const loader = new THREE.TextureLoader();
  const [faceTex, zBuf] = await Promise.all([
    loader.loadAsync(BASE + 'face.webp'), new Promise((res, rej) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
      const q = new Uint16Array(c.width * c.height); for (let i = 0; i < q.length; i++) q[i] = (d[i * 4] << 8) | d[i * 4 + 1]; res(q.buffer); }; im.onerror = rej; im.src = BASE + 'zgrid.png'; })
  ]);
  faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
  const IW = meshData.w, IH = meshData.h;
  const PW = 2.85, PH = PW * IH / IW, PX = PW / IW;
  const uvToLocal = (u, v, zpx, lift = 0) => new THREE.Vector3((u - 0.5) * PW, (0.5 - v) * PH, zpx * PX + lift);
  const lm = i => [meshData.pts[i][0] * IW, meshData.pts[i][1] * IH];
  const up = lm(13), lo = lm(14), cl = lm(61), cr = lm(291), chin = lm(152);
  const MC = [(up[0] + lo[0]) / 2, (up[1] + lo[1]) / 2], MHW = Math.abs(cr[0] - cl[0]) / 2, CHIN = chin[1];
  const stageGroup = new THREE.Group(); scene.add(stageGroup);
  const headGroup = new THREE.Group(); stageGroup.add(headGroup);
  const pivotY = 0.35; headGroup.position.y = pivotY;
  const headInner = new THREE.Group(); headInner.position.set(0, -pivotY, -0.3); headGroup.add(headInner);
/* ---------- the head: displaced relief with eyelids + gaze in shader ---------- */
const E = meshData.eyes;
const headUniforms = {
  uFace:{value:faceTex},
  uTime:{value:0}, uLight:{value:new THREE.Vector3(1.2,1,3)},
  uBlink:{value:new THREE.Vector2(0,0)}, uGaze:{value:new THREE.Vector2(0,0)},
  uScan:{value:1}, uRes:{value:new THREE.Vector2(IW,IH)}, uPW:{value:PW}, uPH:{value:PH},
  uE0:{value:new THREE.Vector4(E[0].c[0],E[0].c[1],E[0].ang,E[0].hw)}, uE0b:{value:new THREE.Vector2(E[0].tu,E[0].tl)},
  uE1:{value:new THREE.Vector4(E[1].c[0],E[1].c[1],E[1].ang,E[1].hw)}, uE1b:{value:new THREE.Vector2(E[1].tu,E[1].tl)},
  uGold:{value:new THREE.Color(0xff7a45)}, uSignal:{value:new THREE.Color(0x6ea0ff)},
  uMouth:{value:new THREE.Vector3(0,1,0)}, uMC:{value:new THREE.Vector4(MC[0],MC[1],MHW,CHIN)}
};
const headMat = new THREE.ShaderMaterial({
  uniforms: headUniforms, transparent:false, alphaToCoverage:true, side:THREE.FrontSide,
  vertexShader:`
    attribute float aD;
    uniform vec3 uMouth; uniform vec4 uMC; uniform vec2 uRes; uniform float uPW;
    varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vD;
    void main(){
      vUv = uv; vD = aD;
      vN = normalize(mat3(modelMatrix)*normal);
      vec3 p = position;
      vec2 px = vec2(uv.x*uRes.x, (1.0-uv.y)*uRes.y);
      float PXs = uPW/uRes.x;
      float dx = (px.x-uMC.x)/uMC.z;
      float wx = 1.0 - smoothstep(0.85, 1.9, abs(dx));
      float wy = smoothstep(uMC.y-2.0, uMC.y+6.0, px.y) * (1.0 - smoothstep(uMC.w+8.0, uMC.w+80.0, px.y));
      p.y -= uMouth.x * 15.0 * PXs * wx * wy;
      float near = (1.0 - smoothstep(8.0, 22.0, abs(px.y-uMC.y))) * (1.0 - smoothstep(1.0, 1.6, abs(dx)));
      p.x -= (px.x-uMC.x) * (1.0-uMouth.y) * 0.22 * PXs * near;
      p.z += (1.0-uMouth.y) * 4.0 * PXs * near;
      vec4 w = modelMatrix*vec4(p,1.); vW = w.xyz;
      gl_Position = projectionMatrix*viewMatrix*w;
    }`,
  fragmentShader:`
    uniform sampler2D uFace; uniform float uTime, uScan; uniform vec3 uLight, uGold, uSignal;
    uniform vec2 uBlink, uGaze, uRes; uniform vec4 uE0, uE1; uniform vec2 uE0b, uE1b; uniform vec3 uMouth; uniform vec4 uMC;
    varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying float vD;
    mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
    vec4 tex(vec2 px){ return texture2D(uFace, vec2(px.x/uRes.x, 1.0-px.y/uRes.y)); }
    // one eye: returns sampling pixel (gaze shifted) and lid colour mix
    void eye(vec2 px, vec4 E, vec2 T, float blink, inout vec2 spx, inout vec4 lidCol, inout float lidAmt){
      vec2 q = rot(-E.z)*(px-E.xy);
      float u = q.x/E.w;
      if(abs(u) > 1.2) return;
      float f = pow(max(1.0-u*u,0.0),0.72);
      float up = -T.x*f*1.08 - 1.2;
      float lo =  T.y*f*1.05 + 0.8 - blink*T.y*0.25*f;
      float inside = smoothstep(up-1.0, up+2.5, q.y)*(1.0-smoothstep(lo-2.5, lo+1.0, q.y))*(1.0-smoothstep(0.7,1.0,abs(u)));
      spx -= rot(E.z)*uGaze*inside;
      if(blink < 0.005 || abs(u) >= 1.0) return;
      float lid = mix(up, lo, blink);
      if(q.y > up-1.5 && q.y < lid){
        float dd = lid - q.y;                            // distance above the lid edge
        float sy = up - 5.5 - dd*0.45;                   // lid skin comes from the smooth band above the upper lid
        vec2 sq = rot(E.z)*vec2(q.x*0.98, sy) + E.xy;
        vec4 c = tex(sq);
        vec4 skin = tex(rot(E.z)*vec2(q.x*0.9, -T.x*1.5 - 5.0) + E.xy);
        c.rgb = mix(c.rgb, skin.rgb, 0.45) * 1.06;
        c.rgb *= mix(0.22, 1.0, smoothstep(0.0, 2.8, dd)); // lash line
        c.rgb *= mix(1.0, 0.86, smoothstep(0.0, 1.0, (dd)/(lid-up+0.001)) * blink); // crease shade
        float edgeFade = 1.0 - smoothstep(0.82, 1.0, abs(u));
        lidCol = c; lidAmt = edgeFade;
      }
    }
    float grid(vec2 p, float n){ vec2 g = abs(fract(p*n)-0.5); float w = fwidth(p.x*n)*1.2; return 1.0 - smoothstep(0.0, w, min(g.x,g.y)); }
    void main(){
      vec2 px = vec2(vUv.x*uRes.x, (1.0-vUv.y)*uRes.y);
      vec2 spx = px; vec4 lidCol = vec4(0.); float lidAmt = 0.;
      eye(px, uE0, uE0b, uBlink.x, spx, lidCol, lidAmt);
      eye(px, uE1, uE1b, uBlink.y, spx, lidCol, lidAmt);
      vec4 c = tex(spx);
      c = mix(c, lidCol, lidAmt);
      { // lip-sync: the stretched band between the lips becomes the mouth opening
        float dxm = (px.x-uMC.x)/(uMC.z*mix(0.62,1.0,uMouth.y));
        float yy = px.y - uMC.y;
        float band = smoothstep(-2.6,-1.2,yy) * (1.0 - smoothstep(4.8,6.4,yy));
        float m = band * (1.0 - smoothstep(0.55, 0.95, abs(dxm))) * smoothstep(0.03, 0.18, uMouth.x);
        vec3 inside = mix(vec3(0.07,0.02,0.03), vec3(0.74,0.70,0.66), (1.0-smoothstep(-1.6,0.2,yy)) * smoothstep(0.25,0.5,uMouth.x));
        c.rgb = mix(c.rgb, inside, m);
      }
      // body dissolves into a dot screen toward the bottom
      float fade = smoothstep(0.0, 0.2, vUv.y);
      vec2 cell = fract(px/7.0)-0.5;
      float dots = step(length(cell), 0.46*fade + 0.05);
      float a = c.a * mix(dots, 1.0, smoothstep(0.55, 0.95, fade));
      if(a < 0.5) discard;
      vec3 N = normalize(vN);
      vec3 V = normalize(cameraPosition - vW);
      vec3 L = normalize(uLight - vW);
      float diff = max(dot(N,L),0.0);
      vec3 col = c.rgb * (0.8 + 0.3*diff);
      vec3 H = normalize(L+V);
      col += uGold * pow(max(dot(N,H),0.0), 38.0) * 0.12 * smoothstep(0.2,0.6,vD);
      float rim = pow(1.0 - max(dot(N,V),0.0), 2.6);
      col += uSignal * rim * 0.3 * (0.35 + dot(c.rgb, vec3(0.3,0.59,0.11)));
      float ndv = max(dot(N,V),0.0);
      col = mix(col, uSignal*0.55 + c.rgb*0.25, (1.0 - smoothstep(0.08, 0.32, ndv))*0.85); // grazing edges become a holographic seam instead of stretched pixels
      // digitised base
      col = mix(col, mix(uSignal, uGold, vUv.x)*0.9, (1.0-smoothstep(0.55,0.95,fade))*0.75);
      // neural scan band
      float band = fract(uTime*0.11);
      float y = 1.1 - band*1.5;
      float bd = vUv.y - y;
      float bandMask = exp(-bd*bd*900.0) * uScan;
      float trail = smoothstep(0.0, 0.14, bd) * (1.0 - smoothstep(0.14, 0.3, bd)) * uScan;
      float g = grid(vUv, 70.0);
      col += uSignal * (bandMask*1.1 + g*trail*0.22);
      col += uGold * bandMask * 0.25;
      col = min(col, vec3(0.86)); // keep studio highlights from blooming into hot spots
      gl_FragColor = vec4(col, 1.0);
    }`
});
headMat.extensions = { derivatives:true };
const G = meshData.grid;
const headGeo = new THREE.PlaneGeometry(PW, PH, G.w-1, G.h-1);
{
  const q = new Uint16Array(zBuf), pos = headGeo.attributes.position, aD = new Float32Array(q.length);
  for (let i=0;i<q.length;i++){ const zpx = G.zmin + q[i]/65535*(G.zmax-G.zmin); pos.setZ(i, zpx*PX); aD[i] = Math.max(0, zpx/G.zmax); }
  headGeo.setAttribute('aD', new THREE.BufferAttribute(aD,1));
  headGeo.computeVertexNormals();
}
const head = new THREE.Mesh(headGeo, headMat);
headInner.add(head);

/* ---------- face mesh constellation (MediaPipe topology over the relief) ---------- */
const P = meshData.pts;
const nose = P[1];
const lmPos = P.map(p => uvToLocal(p[0], p[1], p[2], 0.03));
{
  const pos = [], dist = [];
  for (const [a,b] of meshData.edges){
    if (a>=468||b>=468) continue;
    for (const i of [a,b]){ const v=lmPos[i]; pos.push(v.x,v.y,v.z); dist.push(lmPos[i].distanceTo(lmPos[1]) / PW); /* 3D distance from the nose tip: the pulse spreads evenly on both sides */ }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist,1));
  const m = new THREE.ShaderMaterial({
    uniforms:{ uTime:headUniforms.uTime, uScan:headUniforms.uScan, uA:{value:new THREE.Color(0x6ea0ff)}, uB:{value:new THREE.Color(0xff7a45)} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aDist; varying float vD; void main(){ vD=aDist; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform float uTime, uScan; uniform vec3 uA,uB; varying float vD;
      void main(){ float w = 0.09 + mod(uTime*0.09, 1.0)*0.5; float r = exp(-pow((vD-w)*38.0,2.0));
        float a = (0.035 + r*0.75) * uScan; gl_FragColor = vec4(mix(uA,uB,r)*a, a); }`
  });
  headInner.add(new THREE.LineSegments(g, m));

  const pg = new THREE.BufferGeometry();
  const pp = [], pd = [];
  P.forEach((p,i)=>{ if(i<468 && i%3===0){ const v=lmPos[i]; pp.push(v.x,v.y,v.z); pd.push(Math.random()); } });
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pp,3));
  pg.setAttribute('aSeed', new THREE.Float32BufferAttribute(pd,1));
  const pm = new THREE.ShaderMaterial({
    uniforms:{ uTime:headUniforms.uTime, uScan:headUniforms.uScan, uPR:{value:renderer.getPixelRatio()} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aSeed; uniform float uTime,uPR; varying float vA;
      void main(){ vA = pow(0.5+0.5*sin(uTime*2.2+aSeed*40.0), 6.0); gl_PointSize = (1.5+vA*3.5)*uPR; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform float uScan; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*(0.1+vA*0.35)*uScan; gl_FragColor=vec4(vec3(.6,.75,1.)*a,a); }`
  });
  headInner.add(new THREE.Points(pg, pm));
}

/* ---------- neural lattice behind the head ---------- */
const neural = new THREE.Group(); neural.position.set(0, 0.35, -0.9); scene.add(neural);
let synapseCount = 0;
{
  const N = 120, nodes = [];
  for (let i=0;i<N;i++){
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    const r = 1.35 + Math.random()*0.9;
    const v = new THREE.Vector3(Math.sin(ph)*Math.cos(th)*r*1.25, Math.cos(ph)*r*0.85, Math.sin(ph)*Math.sin(th)*r*0.7 - 0.4);
    nodes.push(v);
  }
  const pos=[], t=[], ph=[];
  const seen = new Set();
  nodes.forEach((a,i)=>{
    const near = nodes.map((b,j)=>[j,a.distanceTo(b)]).filter(x=>x[0]!==i).sort((x,y)=>x[1]-y[1]).slice(0,3);
    for (const [j,d] of near){
      const k = i<j?`${i}-${j}`:`${j}-${i}`; if (seen.has(k) || d>1.3) continue; seen.add(k);
      const b = nodes[j], p = Math.random();
      pos.push(a.x,a.y,a.z,b.x,b.y,b.z); t.push(0,1); ph.push(p,p);
    }
  });
  synapseCount = seen.size;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t,1));
  g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph,1));
  const m = new THREE.ShaderMaterial({
    uniforms:{ uTime:headUniforms.uTime, uA:{value:new THREE.Color(0x6ea0ff)}, uB:{value:new THREE.Color(0xff7a45)} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aT, aPh; varying float vT, vPh; void main(){ vT=aT; vPh=aPh; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform float uTime; uniform vec3 uA,uB; varying float vT, vPh;
      void main(){ float head = fract(uTime*(0.18+vPh*0.25)+vPh*7.0)*1.4-0.2; float s = exp(-pow((vT-head)*9.0,2.0));
        float a = 0.07 + s*0.75; gl_FragColor = vec4(mix(uA,uB,step(0.6,vPh))*a, a); }`
  });
  neural.add(new THREE.LineSegments(g, m));
  const ng = new THREE.BufferGeometry().setFromPoints(nodes);
  const seeds = new Float32Array(N).map(()=>Math.random());
  ng.setAttribute('aSeed', new THREE.BufferAttribute(seeds,1));
  neural.add(new THREE.Points(ng, new THREE.ShaderMaterial({
    uniforms:{ uTime:headUniforms.uTime, uPR:{value:renderer.getPixelRatio()} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute float aSeed; uniform float uTime,uPR; varying float vA; varying float vS;
      void main(){ vS=aSeed; vA = 0.35+0.65*pow(0.5+0.5*sin(uTime*1.3+aSeed*30.),4.); vec4 mv=modelViewMatrix*vec4(position,1.);
      gl_PointSize = min((3.0+vA*5.0)*uPR*(6.0/-mv.z), 10.0*uPR); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying float vA; varying float vS; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d)*vA;
      vec3 c = vS>0.7 ? vec3(1.,.48,.27) : vec3(.43,.63,1.); gl_FragColor=vec4(c*a,a); }`
  })));
}

/* ---------- knowledge stream: particles spiralling into the crown ---------- */
{
  const N = reduced ? 400 : 1400;
  const seeds = new Float32Array(N*3);
  for (let i=0;i<N*3;i++) seeds[i]=Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3),3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds,3));
  const m = new THREE.ShaderMaterial({
    uniforms:{ uTime:headUniforms.uTime, uPR:{value:renderer.getPixelRatio()} },
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 aSeed; uniform float uTime,uPR; varying float vA; varying float vG;
      void main(){
        float t = fract(uTime*(0.035+aSeed.y*0.05) + aSeed.x);
        float r = mix(3.2, 0.04, pow(t,1.35));
        float ang = aSeed.z*6.2831 + t*7.0;
        float y = mix(-1.4 + aSeed.y*3.2, 1.25, pow(t,2.2));
        vec3 p = vec3(cos(ang)*r*1.2, y, sin(ang)*r*0.75 - 0.2);
        vA = smoothstep(0.0,0.15,t)*(1.0-smoothstep(0.85,1.0,t)); vG = step(0.72, aSeed.y);
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_PointSize = min((1.0+aSeed.x*2.2)*uPR*(6.0/-mv.z), 4.0*uPR);
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`varying float vA; varying float vG; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*vA*0.8;
      vec3 c = mix(vec3(.45,.65,1.), vec3(1.,.55,.3), vG); gl_FragColor=vec4(c*a,a); }`
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; stageGroup.add(pts);
}

/* ---------- ambient dust ---------- */
{
  const N = reduced ? 300 : 900, arr = new Float32Array(N*3);
  for (let i=0;i<N;i++){ arr[i*3]=(Math.random()-.5)*14; arr[i*3+1]=(Math.random()-.5)*8; arr[i*3+2]=-Math.random()*8+1.5; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr,3));
  const dust = new THREE.Points(g, new THREE.PointsMaterial({ size:0.012, color:0x8a9296, transparent:true, opacity:0.55, depthWrite:false }));
  dust.name='dust'; scene.add(dust);
}

/* ---------- orbit: text ring + halo ---------- */
const orbit = new THREE.Group(); headGroup.add(orbit);
{
  const words = 'NEURAL SYSTEMS  ·  HEALTHTECH  ·  AI ARCHITECTURE  ·  PATIENT DATA  ·  DIGITAL TRANSFORMATION  ·  ENTERPRISE SOFTWARE  ·  MACHINE LEARNING  ·  ';
  const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 96;
  const cx = cv.getContext('2d');
  await document.fonts.load('500 44px "JetBrains Mono"').catch(()=>{});
  cx.font = '500 44px "JetBrains Mono", monospace'; cx.textBaseline='middle';
  let x = 0; const w = cx.measureText(words).width;
  cx.fillStyle = '#ff7a45';
  while (x < cv.width){ cx.fillText(words, x, 50); x += w; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.62,1.62,0.085,160,1,true),
    new THREE.MeshBasicMaterial({ map:t, transparent:true, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.9 }));
  ring.position.y = -0.62; ring.rotation.x = 0.16; ring.name='textRing';
  orbit.add(ring);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.34,1.345,256),
    new THREE.MeshBasicMaterial({ color:0xff7a45, transparent:true, opacity:0.45, side:THREE.DoubleSide, depthWrite:false }));
  halo.position.set(0, 0.05, -0.55); orbit.add(halo);
  const halo2 = new THREE.Mesh(new THREE.RingGeometry(1.52,1.524,256, 1, 0, Math.PI*1.35),
    new THREE.MeshBasicMaterial({ color:0x6ea0ff, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthWrite:false }));
  halo2.position.set(0, 0.05, -0.6); halo2.name='halo2'; orbit.add(halo2);
}


  /* ---------- layout ---------- */
  const stageEl = $('.np-stage');
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!(w > 0 && h > 0)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const s = Math.min(1, camera.aspect * 1.05); stageGroup.position.set(0, -0.22, 0); stageGroup.scale.setScalar(s * 0.92);
    kick();
  }
  new ResizeObserver(resize).observe(stageEl);
  /* ---------- input ---------- */
  const target = new THREE.Vector2(), look = new THREE.Vector2(), gazeT = new THREE.Vector2(), gaze = new THREE.Vector2();
  let lastInput = -10;
  function setPointer(x, y) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
    const hp = new THREE.Vector3(0, pivotY, 0).applyMatrix4(stageGroup.matrixWorld).project(camera);
    const nx = ((x - rect.left) / rect.width) * 2 - 1, ny = -((y - rect.top) / rect.height) * 2 + 1;
    if (!Number.isFinite(hp.x)) return;
    target.set(THREE.MathUtils.clamp((nx - hp.x) * 0.9, -1, 1), THREE.MathUtils.clamp((ny - hp.y) * 1.1, -1, 1));
    lastInput = performance.now() / 1000; kick();
  }
  root.addEventListener('pointermove', e => setPointer(e.clientX, e.clientY));
  canvas.addEventListener('pointerdown', e => setPointer(e.clientX, e.clientY));
  stageEl.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, .2], ArrowDown: [0, -.2] }[e.key];
    if (k) { e.preventDefault(); target.set(THREE.MathUtils.clamp(target.x + k[0], -1, 1), THREE.MathUtils.clamp(target.y + k[1], -1, 1)); lastInput = performance.now() / 1000; kick(); }
    if (e.key === 'Home') { target.set(0, 0); kick(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); queueBlink('left'); winkCount++; kick(); }
  });
  /* ---------- blinking ---------- */
  const clock = new THREE.Clock();
  let nextBlink = 1.6, blinkQ = [], blinkCount = 0, winkCount = 0;
  function queueBlink(which = 'both', t0) { const now = t0 ?? clock.elapsedTime; blinkQ.push({ start: now, which, dur: 0.245 }); if (which === 'both') blinkCount++; }
  function blinkCurve(t) { if (t < 0) return 0; if (t < 0.075) return THREE.MathUtils.smootherstep(t / 0.075, 0, 1); if (t < 0.105) return 1; if (t < 0.245) return 1 - THREE.MathUtils.smoothstep((t - 0.105) / 0.14, 0, 1); return 0; }
  canvas.addEventListener('click', () => { queueBlink('left'); winkCount++; kick(); });
  let scanOn = true;
  const scanBtn = $('[data-np-scan]');
  scanBtn?.addEventListener('click', () => { scanOn = !scanOn; scanBtn.setAttribute('aria-pressed', String(scanOn)); kick(); });
  if (matchMedia('(pointer:coarse)').matches) $('[data-np-hint]').innerHTML = 'Drag · <kbd>Tap</kbd> to wink';
  /* ---------- loop ---------- */
  const light = new THREE.Vector3();
  let saccadeAt = 0; const idleAim = new THREE.Vector2();
  const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '°';
  const hud = { yaw: $('[data-np-yaw]'), pitch: $('[data-np-pitch]'), blink: $('[data-np-blinks]'), syn: $('[data-np-syn]') };
  let hudT = 0, settle = 0;
  function frame() {
    raf = 0;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const calm = motionOff(); const speed = calm ? 0.25 : 1;
    headUniforms.uTime.value += dt * speed;
    const now = performance.now() / 1000;
    if (!calm && now - lastInput > 3.5 && !mouth.speaking) { if (t > saccadeAt) { idleAim.set((Math.random() - .5) * 1.3, (Math.random() - .5) * 0.7); saccadeAt = t + 1.2 + Math.random() * 2.4; } target.lerp(idleAim, 0.02); }
    if (mouth.speaking && now - lastInput > 2) target.lerp(new THREE.Vector2(0, 0.05), 0.04);
    for (const v of [target, look, gaze]) if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) v.set(0, 0);
    gazeT.set(target.x * 3.6, -target.y * 2.2);
    gaze.lerp(gazeT, 1 - Math.pow(0.0006, dt)); look.lerp(target, 1 - Math.pow(0.04, dt));
    headUniforms.uGaze.value.set(gaze.x - look.x * 1.4, gaze.y + look.y * 0.9);
    const breathe = calm ? 0 : Math.sin(t * 1.1) * 0.006;
    const nod = mouth.speaking && !calm ? Math.sin(t * 2.3) * 0.012 * mouth.open : 0;
    headGroup.rotation.y = look.x * 0.5; headGroup.rotation.x = -look.y * 0.26 + breathe + nod; headGroup.rotation.z = -look.x * 0.03;
    light.set(target.x * 3 + 0.6, target.y * 2 + 1.2, 3.2); headUniforms.uLight.value.copy(light);
    if (!calm && t > nextBlink) { queueBlink('both', t); if (Math.random() < 0.18) queueBlink('both', t + 0.32); nextBlink = t + 2.2 + Math.random() * 3.8; }
    let bl = 0, br = 0;
    blinkQ = blinkQ.filter(b => { const v = blinkCurve(t - b.start); if (b.which !== 'right') bl = Math.max(bl, v); if (b.which !== 'left') br = Math.max(br, v); return t - b.start < b.dur + 0.4; });
    headUniforms.uBlink.value.set(bl, br);
    driveMouth(now);
    headUniforms.uMouth.value.set(mouth.open, mouth.width, 0);
    headUniforms.uScan.value += ((scanOn ? 1 : 0) - headUniforms.uScan.value) * 0.08;
    neural.rotation.y = t * 0.03 * speed - look.x * 0.25; neural.rotation.x = look.y * 0.1;
    neural.position.x = stageGroup.position.x * 0.9; neural.position.y = stageGroup.position.y + 0.35; neural.scale.copy(stageGroup.scale);
    orbit.getObjectByName('textRing').rotation.y = -headUniforms.uTime.value * 0.12;
    orbit.getObjectByName('halo2').rotation.z = headUniforms.uTime.value * 0.18;
    orbit.rotation.y = -look.x * 0.2;
    const dust = scene.getObjectByName('dust'); dust.rotation.y = headUniforms.uTime.value * 0.01; dust.position.x = -look.x * 0.15;
    camera.position.x = look.x * 0.12; camera.position.y = 0.15 + look.y * 0.08; camera.lookAt(0, 0.1 + stageGroup.position.y * 0.3, 0);
    renderer.render(scene, camera);
    if (t - hudT > 0.1) {
      hudT = t;
      hud.yaw.textContent = fmt(THREE.MathUtils.radToDeg(headGroup.rotation.y));
      hud.pitch.textContent = fmt(THREE.MathUtils.radToDeg(-headGroup.rotation.x));
      hud.blink.textContent = (blinkCount + winkCount).toLocaleString('en');
      hud.syn.textContent = (synapseCount * 16 + Math.floor(headUniforms.uTime.value * 37) % 997).toLocaleString('en');
    }
    const moving = Math.abs(target.x - look.x) + Math.abs(target.y - look.y) > 0.002 || blinkQ.length || mouth.speaking || Math.abs(mouth.open) > 0.01;
    if (moving) settle = 0; else settle++;
    if (vis && !document.hidden && (!calm || moving || settle < 3)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (vis && !raf && ready) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) { clock.getDelta(); kick(); } }, { rootMargin: '120px' }).observe(root);
  new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', kick);
  ready = true; resize();
  root.classList.add('np-ready');
}
