// Interactive 3D orbit scene for the Space frontier. Loads three.js lazily; the 2D canvas in site.js stays as fallback.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';

const field = document.querySelector('[data-space]');
if (field && webglAvailable()) whenNear(field).then(init);

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function whenNear(el) {
  return new Promise(resolve => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); resolve(); } }, { rootMargin: '900px 0px' });
    io.observe(el);
  });
}

async function init() {
  const $ = s => field.querySelector(s);
  const loader = $('[data-sat-loader]'), progress = $('[data-sat-progress]');
  loader.hidden = false;
  let THREE;
  try { THREE = await import(THREE_URL); } catch { loader.hidden = true; return; }

  const root = document.documentElement;
  const R_ORBIT = 1.3, INCL = 0.92, RAAN = 0.5, PERIOD = 70;
  const sunDir = new THREE.Vector3(-1, 0.32, 0.55).normalize();

  /* ---------- Renderer, scene, camera ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.debug.checkShaderErrors = false; // avoid synchronous shader-status stalls
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.className = 'sat-gl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  field.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.002, 200);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, total) => { progress.textContent = `${Math.round(loaded / total * 100)}%`; loader.style.setProperty('--p', loaded / total); };
  const tl = new THREE.TextureLoader(manager);
  const tex = (name, srgb) => { const t = tl.load(TEX + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const dayMap = tex('earth_atmos_2048.jpg', true);
  const nightMap = tex('earth_lights_2048.png', true);
  const specMap = tex('earth_specular_2048.jpg', false);
  const cloudMap = tex('earth_clouds_1024.png', true);

  // Space environment for metal reflections: black sky with a hot sun
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float s = max(dot(normalize(vDir), sunDir), 0.0);
        float band = 0.5 + 0.5 * normalize(vDir).y;
        vec3 c = mix(vec3(0.05, 0.055, 0.065), vec3(0.16, 0.17, 0.19), band) + vec3(1.0, 0.94, 0.86) * pow(s, 60.0) * 16.0 + vec3(1.0, 0.78, 0.55) * pow(s, 4.0) * 0.5;
        gl_FragColor = vec4(c, 1.0); }`
  })));
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  const sunLight = new THREE.DirectionalLight(0xfff1e0, 3.4);
  sunLight.position.copy(sunDir).multiplyScalar(10);
  scene.add(sunLight, new THREE.AmbientLight(0x2a3240, 0.5));
  const earthShine = new THREE.DirectionalLight(0x5b86e0, 0.55);
  scene.add(earthShine);

  /* ---------- Stars ---------- */
  {
    const n = 3600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 20);
      pos.set([v.x, v.y, v.z], i * 3);
      c.setHSL([0.6, 0.08, 0.0][i % 3], 0.5, 0.55 + Math.random() * 0.45);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));
  }

  /* ---------- Earth ---------- */
  const earth = new THREE.Group();
  scene.add(earth);
  const commonVert = `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: dayMap }, nightMap: { value: nightMap }, specMap: { value: specMap }, sunDir: { value: sunDir } },
    vertexShader: commonVert,
    fragmentShader: `uniform sampler2D dayMap, nightMap, specMap; uniform vec3 sunDir;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float ndl = dot(n, sunDir);
        float dayAmt = smoothstep(-0.12, 0.25, ndl);
        vec3 day = texture2D(dayMap, vUv).rgb * (0.06 + 1.3 * max(ndl, 0.0));
        vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.7, 0.4) * 2.4;
        vec3 col = mix(night, day, dayAmt);
        float spec = texture2D(specMap, vUv).r;
        col += vec3(1.0, 0.9, 0.78) * pow(max(dot(n, normalize(sunDir + v)), 0.0), 70.0) * spec * 1.1 * dayAmt;
        col += vec3(1.0, 0.36, 0.12) * pow(1.0 - abs(ndl), 9.0) * 0.22;
        col += vec3(0.3, 0.55, 1.0) * pow(1.0 - max(dot(n, v), 0.0), 2.6) * 0.65 * smoothstep(-0.3, 0.5, ndl);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.011, 96, 72), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: cloudMap }, sunDir: { value: sunDir } },
    vertexShader: commonVert,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vec4 c = texture2D(map, vUv); float ndl = dot(normalize(vN), sunDir);
        float lit = 0.015 + 1.15 * max(ndl, 0.0) + 0.12 * smoothstep(-0.15, 0.1, ndl);
        gl_FragColor = vec4(c.rgb * lit, c.a * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  earth.add(clouds);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.065, 96, 72), new THREE.ShaderMaterial({
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    uniforms: { sunDir: { value: sunDir } },
    vertexShader: commonVert,
    fragmentShader: `uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
        float i = pow(smoothstep(0.0, 0.36, -dot(n, v)), 2.2);
        float lit = smoothstep(-0.45, 0.55, dot(n, sunDir));
        vec3 col = mix(vec3(1.0, 0.42, 0.16) * 0.5, vec3(0.32, 0.58, 1.0), lit) * i * (0.12 + 1.5 * lit);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })));

  /* ---------- Orbit path + trail ---------- */
  const orbitQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(INCL, RAAN, 0, 'YXZ'));
  const orbitPoint = (theta, r = R_ORBIT) => new THREE.Vector3(Math.cos(theta) * r, 0, -Math.sin(theta) * r).applyQuaternion(orbitQ);
  {
    const pts = Array.from({ length: 257 }, (_, i) => orbitPoint(i / 256 * Math.PI * 2));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xedeae3, dashSize: 0.02, gapSize: 0.025, transparent: true, opacity: 0.22 }));
    line.computeLineDistances();
    scene.add(line);
  }
  const TRAIL = 160;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trailCol = new Float32Array(TRAIL * 4);
  for (let i = 0; i < TRAIL; i++) trailCol.set([1, 0.36, 0.15, Math.pow(i / (TRAIL - 1), 2.2)], i * 4);
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 4));
  scene.add(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })));

  /* ---------- Satellite ---------- */
  const sat = buildSatellite(THREE);
  scene.add(sat.group);
  earthShine.target = sat.group;

  // Scan beam + ground footprint
  const beamGeo = new THREE.ConeGeometry(1, 1, 48, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, strength: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float time, strength; varying vec2 vUv;
      void main(){ float body = 0.05 + 0.18 * vUv.y; float band = smoothstep(0.9, 1.0, fract(vUv.y * 5.0 + time * 0.8)) * 0.45;
        gl_FragColor = vec4(vec3(1.0, 0.42, 0.18) * (body + band) * strength, 1.0); }`
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  scene.add(beam);
  const footprint = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5b26, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.052, 0.058, 64), ringMat);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.024, 48), ringMat.clone());
  footprint.add(ring, ring2);
  scene.add(footprint);

  /* ---------- State ---------- */
  const state = {
    theta: 0.6, earthRot: -1.2, mode: 'chase', weights: { chase: 1, orbit: 0, scan: 0 },
    yaw: { chase: 0.9, orbit: -0.15, scan: 0 }, pitch: { chase: 0.42, orbit: 0.35, scan: 0 },
    vel: { yaw: 0, pitch: 0 }, dragging: false, deploy: 1, deployTarget: 1, sunAmt: 1, captures: 0,
    orbitNo: 412, focusPart: null, lastInteract: 0
  };
  const tmp = { up: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(), camUp = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();

  function satFrame() {
    const pos = orbitPoint(state.theta);
    tmp.up.copy(pos).normalize();
    tmp.fwd.set(-Math.sin(state.theta), 0, -Math.cos(state.theta)).applyQuaternion(orbitQ).normalize();
    tmp.right.crossVectors(tmp.up, tmp.fwd).normalize();
    tmp.m.makeBasis(tmp.right, tmp.up, tmp.fwd);
    tmp.q.setFromRotationMatrix(tmp.m);
    return pos;
  }

  // Desired camera for each mode, recomputed every frame (no lag while the satellite moves)
  const desired = {
    chase(pos) {
      const d = 0.26, y = state.yaw.chase, p = state.pitch.chase;
      const local = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).multiplyScalar(d);
      return { pos: local.applyQuaternion(tmp.q).add(pos), target: pos.clone().addScaledVector(tmp.up, -0.045), up: tmp.up.clone() };
    },
    orbit() {
      const d = 3.6 / Math.min(1, camera.aspect * 1.15), y = state.yaw.orbit, p = state.pitch.orbit;
      return { pos: new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)).multiplyScalar(d), target: new THREE.Vector3(0, 0, 0), up: new THREE.Vector3(0, 1, 0) };
    },
    scan(pos) {
      const local = new THREE.Vector3(0.16, 0.2, 0.42);
      const ground = pos.clone().normalize();
      return { pos: local.applyQuaternion(tmp.q).add(pos), target: pos.clone().lerp(ground, 0.55), up: tmp.up.clone() };
    }
  };

  /* ---------- HUD ---------- */
  const tele = Object.fromEntries([...field.querySelectorAll('[data-t]')].map(el => [el.dataset.t, el]));
  const link = $('[data-sat-link]');
  const modeButtons = [...field.querySelectorAll('[data-sat-mode]')];
  const arraysBtn = $('[data-sat-action="arrays"]'), captureBtn = $('[data-sat-action="capture"]');
  const flash = $('.sat-flash'), tip = $('[data-sat-tip]'), hotLayer = $('[data-sat-hotspots]');
  const parts = [
    { key: 'payload', label: 'Optical payload', text: 'Earth-observation camera pointed at nadir. The same kind of imagery we built on at Andøya Space Hackathon 25.', view: [0.5, -0.15] },
    { key: 'array', label: 'Solar array', text: 'Sun-tracking wings. They rotate live to face the light in this scene, and go dark in Earth’s shadow.', view: [1.45, 0.25] },
    { key: 'antenna', label: 'High-gain antenna', text: 'Downlink to ground stations. Space data like this powers the AI tutors in Eduspaceno.com, our NASA Space Apps project.', view: [0.2, 0.75] }
  ];
  parts.forEach(part => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sat-hotspot';
    b.innerHTML = `<i aria-hidden="true"></i><span class="mono">${part.label}</span>`;
    b.setAttribute('aria-label', `Inspect ${part.label}`);
    b.addEventListener('click', () => focusPart(part));
    hotLayer.append(b);
    part.el = b;
  });
  function focusPart(part) {
    setMode('chase');
    state.focusPart = part;
    tip.hidden = false;
    tip.querySelector('b').textContent = part.label;
    tip.querySelector('p').textContent = part.text;
    parts.forEach(p => p.el.classList.toggle('is-active', p === part));
    state.lastInteract = performance.now();
    kick();
  }
  function setMode(mode) {
    state.mode = mode;
    modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.satMode === mode)));
    field.dataset.satMode = mode;
    captureBtn.hidden = mode !== 'scan';
    if (mode !== 'chase') { state.focusPart = null; tip.hidden = true; parts.forEach(p => p.el.classList.remove('is-active')); }
    kick();
  }
  modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.satMode)));
  arraysBtn.addEventListener('click', () => {
    state.deployTarget = state.deployTarget ? 0 : 1;
    arraysBtn.setAttribute('aria-pressed', String(!!state.deployTarget));
    arraysBtn.textContent = state.deployTarget ? 'Stow arrays' : 'Deploy arrays';
    kick();
  });
  captureBtn.addEventListener('click', () => {
    state.captures++;
    flash.classList.remove('is-flash'); void flash.offsetWidth; flash.classList.add('is-flash');
    tele.frames && (tele.frames.textContent = String(state.captures).padStart(3, '0'));
    kick();
  });

  // Drag to look around (with inertia)
  const canvas = renderer.domElement;
  let last = null;
  canvas.addEventListener('pointerdown', e => { last = { x: e.clientX, y: e.clientY }; state.dragging = true; try { canvas.setPointerCapture(e.pointerId); } catch {} field.classList.add('is-active'); });
  canvas.addEventListener('pointermove', e => {
    if (!state.dragging || !last) return;
    const dx = (e.clientX - last.x) / canvas.clientWidth, dy = (e.clientY - last.y) / canvas.clientHeight;
    last = { x: e.clientX, y: e.clientY };
    const m = state.mode === 'scan' ? 'chase' : state.mode;
    state.vel.yaw = -dx * 4.2; state.vel.pitch = dy * 2.6;
    state.yaw[m] += state.vel.yaw; state.pitch[m] = clamp(state.pitch[m] + state.vel.pitch, -1.2, 1.3);
    state.lastInteract = performance.now();
    kick();
  });
  const endDrag = () => { state.dragging = false; last = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- Sizing ---------- */
  function resize() {
    const w = field.clientWidth, h = field.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shift = matchMedia('(min-width: 981px)').matches ? w * 0.17 : 0;
    camera.setViewOffset(w, h, -shift, 0, w, h);
    camera.updateProjectionMatrix();
    kick();
  }
  new ResizeObserver(resize).observe(field);

  /* ---------- Loop ---------- */
  let visible = false, raf = 0, prev = 0, hudTimer = 0;
  const paused = () => root.classList.contains('motion-paused');
  function running() { return visible && !document.hidden && !paused(); }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { rootMargin: '120px' }).observe(field);
  document.addEventListener('visibilitychange', kick);
  new MutationObserver(kick).observe(root, { attributes: true, attributeFilter: ['class'] });

  const proj = new THREE.Vector3();
  function frame(now) {
    raf = 0;
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0.016;
    prev = now;
    const live = running();
    const t = live ? dt : 0;

    state.theta += t * (Math.PI * 2 / PERIOD);
    if (state.theta > Math.PI * 2) { state.theta -= Math.PI * 2; state.orbitNo++; }
    state.earthRot += t * 0.015;
    earth.rotation.y = state.earthRot;
    clouds.rotation.y += t * 0.004;

    // inertia + idle drift
    if (!state.dragging) {
      const m = state.mode === 'scan' ? 'chase' : state.mode;
      state.vel.yaw *= 0.92; state.vel.pitch *= 0.92;
      state.yaw[m] += state.vel.yaw * (live ? 1 : 0);
      state.pitch[m] = clamp(state.pitch[m] + state.vel.pitch * (live ? 1 : 0), -1.2, 1.3);
      if (state.focusPart) {
        const [fy, fp] = state.focusPart.view;
        state.yaw.chase += (fy - state.yaw.chase) * (1 - Math.exp(-dt * 3));
        state.pitch.chase += (fp - state.pitch.chase) * (1 - Math.exp(-dt * 3));
      } else if (live && now - state.lastInteract > 2500) {
        state.yaw[m] += t * (m === 'orbit' ? 0.05 : 0.06);
      }
    }

    // satellite pose
    const pos = satFrame();
    sat.group.position.copy(pos);
    sat.group.quaternion.copy(tmp.q);
    const blendK = 1 - Math.exp(-dt * 2.4);
    for (const m of Object.keys(state.weights)) state.weights[m] += ((m === state.mode ? 1 : 0) - state.weights[m]) * blendK;
    const scale = 0.018 + 0.034 * state.weights.orbit;
    sat.group.scale.setScalar(scale);

    // eclipse: is the satellite in Earth's shadow?
    const along = pos.dot(sunDir);
    const inShadow = along < 0 && pos.clone().addScaledVector(sunDir, -along).length() < 1;
    state.sunAmt += ((inShadow ? 0.04 : 1) - state.sunAmt) * (1 - Math.exp(-dt * 2));
    sunLight.intensity = 3.4 * state.sunAmt;

    // solar wings track the sun; deploy/stow animation
    sunLocal.copy(sunDir).applyQuaternion(tmp.q.clone().invert());
    const wingAngle = Math.atan2(sunLocal.z, sunLocal.y);
    state.deploy += (state.deployTarget - state.deploy) * (1 - Math.exp(-dt * 2.2));
    sat.update(wingAngle, state.deploy, now, dt);

    // trail
    const tp = trailGeo.attributes.position;
    for (let i = 0; i < TRAIL; i++) { const p = orbitPoint(state.theta - (TRAIL - 1 - i) * 0.006); tp.setXYZ(i, p.x, p.y, p.z); }
    tp.needsUpdate = true;

    // scan beam + footprint
    const scanW = state.weights.scan;
    const lens = sat.anchors.payload.getWorldPosition(new THREE.Vector3());
    const ground = pos.clone().normalize();
    const len = lens.distanceTo(ground);
    beam.position.copy(lens); beam.quaternion.copy(tmp.q);
    beam.scale.set(len * 0.16, len, len * 0.16);
    beamMat.uniforms.time.value = now / 1000;
    beamMat.uniforms.strength.value = scanW;
    beam.visible = scanW > 0.01;
    footprint.position.copy(ground).multiplyScalar(1.003);
    footprint.lookAt(0, 0, 0);
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    ring.material.opacity = 0.9 * scanW; ring2.material.opacity = (0.4 + 0.5 * pulse) * scanW;
    ring.scale.setScalar(1 + pulse * 0.08);
    footprint.visible = scanW > 0.01;

    // camera blend
    camPos.set(0, 0, 0); camTarget.set(0, 0, 0); camUp.set(0, 0, 0);
    let wsum = 0;
    for (const m of Object.keys(state.weights)) {
      const w = state.weights[m]; if (w < 0.001) continue;
      const d = desired[m](pos.clone());
      camPos.addScaledVector(d.pos, w); camTarget.addScaledVector(d.target, w); camUp.addScaledVector(d.up, w); wsum += w;
    }
    camera.position.copy(camPos.divideScalar(wsum));
    camera.up.copy(camUp.normalize());
    camera.lookAt(camTarget.divideScalar(wsum));

    renderer.render(scene, camera);

    // hotspots follow their 3D anchors
    const showHot = state.weights.chase > 0.85;
    hotLayer.classList.toggle('is-visible', showHot);
    if (showHot) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      parts.forEach(part => {
        sat.anchors[part.key].getWorldPosition(proj);
        proj.project(camera);
        const onScreen = proj.z < 1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 1;
        part.el.style.transform = `translate(${((proj.x + 1) / 2 * w).toFixed(1)}px, ${((1 - proj.y) / 2 * h).toFixed(1)}px)`;
        part.el.hidden = !onScreen;
      });
    }

    // telemetry (throttled)
    hudTimer += dt;
    if (hudTimer > 0.12 || !live) {
      hudTimer = 0;
      const local = ground.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -state.earthRot);
      const lat = Math.asin(local.y) * 180 / Math.PI;
      let lon = Math.atan2(local.z, -local.x) / (Math.PI * 2) * 360 - 180;
      lon = ((lon + 540) % 360) - 180;
      tele.alt.textContent = `${(550 + Math.sin(state.theta * 2) * 3.2).toFixed(1)} km`;
      tele.vel.textContent = `${(7.59 + Math.cos(state.theta * 2) * 0.004).toFixed(3)} km/s`;
      tele.lat.textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
      tele.lon.textContent = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
      tele.orbit.textContent = String(state.orbitNo).padStart(4, '0');
      tele.sun.textContent = state.sunAmt > 0.5 ? 'Sunlit' : 'Eclipse';
      field.classList.toggle('is-eclipse', state.sunAmt < 0.5);
      link.textContent = state.mode === 'scan' ? 'Imaging · downlink active' : 'Link stable';
    }

    if (live || state.dragging || Math.abs(state.vel.yaw) > 1e-4 || anyBlending()) kick();
  }
  const anyBlending = () => Object.entries(state.weights).some(([m, w]) => Math.abs((m === state.mode ? 1 : 0) - w) > 0.002) || Math.abs(state.deploy - state.deployTarget) > 0.002 || !!state.focusPart;

  manager.onLoad = () => {
    loader.classList.add('is-done');
    field.classList.add('is-3d');
    setTimeout(() => { loader.hidden = true; }, 700);
    resize();
  };
  manager.onError = () => { loader.hidden = true; renderer.domElement.remove(); };
  setMode('chase');
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

/* ---------- Procedural satellite ---------- */
function buildSatellite(THREE) {
  const group = new THREE.Group();
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  // crinkled multi-layer insulation
  const foil = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const v = 112 + Math.random() * 36 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); const x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 60, y + (Math.random() - .5) * 60); g.lineTo(x + (Math.random() - .5) * 60, y + (Math.random() - .5) * 60);
      g.fill();
    }
  }, false);
  const cells = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c9d2e3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8ecf2'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
    const n = 8, pad = 3, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const grd = g.createLinearGradient(i * s, j * s, (i + 1) * s, (j + 1) * s);
      grd.addColorStop(0, '#1f3f9c'); grd.addColorStop(0.55, '#0e2463'); grd.addColorStop(1, '#183584');
      g.fillStyle = grd; g.fillRect(i * s + pad, j * s + pad, s - pad * 2, s - pad * 2);
      g.strokeStyle = 'rgba(160,185,230,.25)'; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(i * s + pad, j * s + k * s / 4); g.lineTo((i + 1) * s - pad, j * s + k * s / 4); g.stroke(); }
    }
  });
  const M = {
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c25a, metalness: 1, roughness: 0.24, bumpMap: foil, bumpScale: 0.45 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xe4e6ea, metalness: 1, roughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.7, roughness: 0.45 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeceae6, metalness: 0.1, roughness: 0.5 }),
    cells: new THREE.MeshStandardMaterial({ map: cells, metalness: 0.6, roughness: 0.26 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x0a1424, metalness: 0.3, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x1a4a7a, emissiveIntensity: 0.35 })
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // bus
  add(new THREE.BoxGeometry(1, 1.1, 1), M.gold);
  for (const [x, z] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) add(new THREE.BoxGeometry(0.035, 1.12, 0.035), M.silver, x, 0, z);
  add(new THREE.BoxGeometry(0.42, 0.5, 0.02), M.white, -0.24, -0.18, 0.51);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8).rotateX(Math.PI / 2), M.silver, -0.38, 0.45, 0.95);
  add(new THREE.BoxGeometry(0.08, 0.08, 0.08), M.dark, -0.38, 0.45, 1.4);
  add(new THREE.BoxGeometry(1.06, 0.06, 1.06), M.silver, 0, 0.58, 0);
  add(new THREE.BoxGeometry(1.06, 0.06, 1.06), M.silver, 0, -0.58, 0);
  add(new THREE.BoxGeometry(0.8, 0.86, 0.02), M.dark, 0, 0, -0.51);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.8, 0.02, 0.025), M.silver, 0, -0.36 + i * 0.145, -0.52);
  add(new THREE.BoxGeometry(0.34, 0.3, 0.04), M.silver, 0.18, 0.12, 0.52);

  // star trackers
  [[-0.32, 0.72, 0.3], [-0.32, 0.72, -0.1]].forEach(([x, y, z]) => {
    add(new THREE.BoxGeometry(0.14, 0.14, 0.14), M.dark, x, y, z);
    add(new THREE.CylinderGeometry(0.05, 0.065, 0.14, 20, 1, true), M.dark, x, y + 0.13, z);
  });

  // thrusters
  [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]].forEach(([x, z]) => {
    add(new THREE.CylinderGeometry(0.03, 0.06, 0.1, 16, 1, true), M.nozzle, x, -0.66, z);
  });

  // optical payload (nadir, -y)
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 40), M.silver, 0, -0.8, 0.05);
  add(new THREE.TorusGeometry(0.31, 0.03, 12, 40).rotateX(Math.PI / 2), M.gold, 0, -0.62, 0.05);
  add(new THREE.CylinderGeometry(0.34, 0.31, 0.22, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide }), 0, -1.12, 0.05);
  const lens = add(new THREE.CircleGeometry(0.25, 40).rotateX(Math.PI / 2), M.lens, 0, -1.02, 0.05);
  const payloadAnchor = new THREE.Object3D(); payloadAnchor.position.set(0, -1.18, 0.05); group.add(payloadAnchor);

  // high-gain antenna
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), M.silver, 0.22, 0.83, 0.22);
  const dish = new THREE.Group(); dish.position.set(0.22, 1.05, 0.22); dish.rotation.set(-0.5, 0, 0.35); group.add(dish);
  const prof = []; for (let i = 0; i <= 16; i++) { const r = i / 16 * 0.44; prof.push(new THREE.Vector2(r, r * r * 1.1)); }
  add(new THREE.LatheGeometry(prof, 48), new THREE.MeshStandardMaterial({ color: 0xf1efe9, metalness: 0.25, roughness: 0.35, side: THREE.DoubleSide }), 0, 0, 0, dish);
  const f = 0.23;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2, rim = new THREE.Vector3(Math.cos(a) * 0.42, 0.42 * 0.42 * 1.1, Math.sin(a) * 0.42), focus = new THREE.Vector3(0, f, 0);
    const strut = add(new THREE.CylinderGeometry(0.008, 0.008, rim.distanceTo(focus), 6), M.silver, 0, 0, 0, dish);
    strut.position.copy(rim).lerp(focus, 0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), focus.clone().sub(rim).normalize());
  }
  add(new THREE.ConeGeometry(0.045, 0.09, 16).rotateX(Math.PI), M.gold, 0, f, 0, dish);
  const antennaAnchor = new THREE.Object3D(); antennaAnchor.position.set(0, 0.2, 0); dish.add(antennaAnchor);

  // solar wings
  const wings = [];
  [1, -1].forEach(s => {
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10).rotateZ(Math.PI / 2), M.silver, s * 0.78, 0, 0);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16).rotateZ(Math.PI / 2), M.dark, s * 1.05, 0, 0);
    const pivot = new THREE.Group(); pivot.position.set(s * 1.1, 0, 0); group.add(pivot);
    const panels = [];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.02, 0.86), [M.silver, M.silver, M.cells, M.white, M.silver, M.silver]);
      pivot.add(p); panels.push(p);
    }
    wings.push({ s, pivot, panels });
  });
  const arrayAnchor = new THREE.Object3D(); wings[0].panels[1].add(arrayAnchor); arrayAnchor.position.set(0, 0.03, 0);

  // nav lights
  const navRed = add(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b2e }), 0.5, 0.63, 0.5);
  const navGreen = add(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3ddc97 }), -0.5, 0.63, 0.5);

  return {
    group,
    anchors: { payload: payloadAnchor, array: arrayAnchor, antenna: antennaAnchor },
    update(wingAngle, deploy, now) {
      wings.forEach(w => {
        w.pivot.rotation.x += (wingAngle - w.pivot.rotation.x) * 0.08;
        w.panels.forEach((p, i) => {
          p.position.x = w.s * (0.1 + 0.47 + i * 0.97 * deploy);
          p.position.y = (1 - deploy) * i * 0.03;
          p.visible = deploy > 0.02 || i === 0;
        });
      });
      const blink = (now / 1000) % 1.6;
      navRed.visible = blink < 0.12;
      navGreen.visible = blink > 0.8 && blink < 0.92;
    }
  };
}
