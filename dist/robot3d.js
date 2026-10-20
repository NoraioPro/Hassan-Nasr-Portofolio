// Robotics lab: a 5-axis arm with analytic IK, a conveyor, overhead vision and an autonomous pick-and-sort planner.
// The 2D SVG arm in site.js stays as the fallback when WebGL or the CDN is unavailable.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const field = document.querySelector('[data-robot3d]');
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
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => t * t * t * (t * (t * 6 - 15) + 10); // minimum-jerk profile
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// Keep base rotation inside one sector (centred on the front of the cell) so the arm never spins a full turn.
const frontAngle = a => { while (a <= -Math.PI / 2) a += Math.PI * 2; while (a > Math.PI * 1.5) a -= Math.PI * 2; return a; };

async function init() {
  const $ = s => field.querySelector(s);
  const loader = $('[data-rl-loader]');
  loader.hidden = false;
  let THREE;
  try { THREE = await import(THREE_URL); } catch { loader.hidden = true; return; }
  const html = document.documentElement;

  /* ---------- Constants (metres) ---------- */
  const L1 = 1.0, L2 = 0.95, SHOULDER_Y = 0.55, TOOL = 0.3;
  const CUBE = 0.18, BELT_X = -1.3, BELT_Z0 = -2.2, BELT_Z1 = 0.4, BELT_TOP = 0.265, PICK_Z = 0.02;
  const BINS = [{ x: 1.3, z: -0.72 }, { x: 1.38, z: 0 }, { x: 1.3, z: 0.72 }];
  const COLORS = [{ name: 'Orange', hex: 0xff5b26 }, { name: 'White', hex: 0xe9e6df }, { name: 'Teal', hex: 0x2ec4b6 }];
  const HOME = new THREE.Vector3(0.15, 1.05, 0.95);

  /* ---------- Renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const small = matchMedia('(max-width: 767px)').matches;
  renderer.debug.checkShaderErrors = false; // avoid synchronous shader-status stalls
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'rl-gl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  field.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0c0e, 7.5, 15);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vDir; void main(){ float y = normalize(vDir).y;
        vec3 c = mix(vec3(0.04, 0.045, 0.05), vec3(0.75, 0.78, 0.82), smoothstep(-0.1, 0.9, y));
        c += vec3(1.0, 0.45, 0.2) * smoothstep(0.6, 1.0, normalize(vDir).x) * 0.25;
        gl_FragColor = vec4(c, 1.0); }`
    })));
    scene.environment = pmrem.fromScene(env, 0.04).texture;
  }
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x15171b, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 15 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa030, 1.4);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);

  /* ---------- Materials ---------- */
  const M = {
    white: new THREE.MeshStandardMaterial({ color: 0xebe9e4, roughness: 0.36, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24272d, roughness: 0.5, metalness: 0.55 }),
    darker: new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.7, metalness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.28, metalness: 1 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xffb020, roughness: 0.42, metalness: 0.1, emissive: 0x3a2400 }),
    status: new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffb020, emissiveIntensity: 1.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1626, roughness: 0.05, metalness: 0.6, emissive: 0x0d2a44, emissiveIntensity: 0.6 })
  };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };

  /* ---------- Floor ---------- */
  const floor = mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9, metalness: 0.05 }), scene, 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(24, 48, 0x2b2e35, 0x1b1d22);
  grid.position.y = 0.002;
  scene.add(grid);
  const zone = new THREE.Mesh(new THREE.RingGeometry(1.98, 2.02, 128), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.45 }));
  zone.rotation.x = -Math.PI / 2; zone.position.y = 0.004; scene.add(zone);
  const zoneFill = new THREE.Mesh(new THREE.CircleGeometry(1.98, 128), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.025 }));
  zoneFill.rotation.x = -Math.PI / 2; zoneFill.position.y = 0.003; scene.add(zoneFill);

  /* ---------- Robot ---------- */
  const robot = buildRobot();
  scene.add(robot.base);

  function buildRobot() {
    const base = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.1, 48), M.dark, base, 0, 0.05, 0);
    mesh(new THREE.TorusGeometry(0.34, 0.012, 8, 64).rotateX(Math.PI / 2), M.orange, base, 0, 0.1, 0, false);
    const j1 = new THREE.Group(); j1.position.y = 0.1; base.add(j1);
    mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.32, 48), M.white, j1, 0, 0.16, 0);
    const ring = mesh(new THREE.TorusGeometry(0.275, 0.014, 8, 64).rotateX(Math.PI / 2), M.status, j1, 0, 0.3, 0, false);
    mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.46, 40).rotateX(Math.PI / 2), M.white, j1, 0, SHOULDER_Y - 0.1, 0);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.47, 32).rotateX(Math.PI / 2), M.dark, j1, 0, SHOULDER_Y - 0.1, 0);

    const j2 = new THREE.Group(); j2.position.y = SHOULDER_Y - 0.1; j1.add(j2);
    mesh(new THREE.CapsuleGeometry(0.115, L1 - 0.12, 8, 24).rotateZ(Math.PI / 2), M.white, j2, L1 / 2, 0, 0.06);
    mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.05, 32).rotateZ(Math.PI / 2), M.orange, j2, L1 * 0.32, 0, 0.06, false);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 36).rotateX(Math.PI / 2), M.white, j2, L1, 0, 0.03);
    mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.37, 24).rotateX(Math.PI / 2), M.dark, j2, L1, 0, 0.03);

    const j3 = new THREE.Group(); j3.position.set(L1, 0, 0); j2.add(j3);
    mesh(new THREE.CapsuleGeometry(0.085, L2 - 0.1, 8, 24).rotateZ(Math.PI / 2), M.white, j3, L2 / 2, 0, -0.06);
    mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.04, 28).rotateZ(Math.PI / 2), M.orange, j3, L2 * 0.68, 0, -0.06, false);
    mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 32).rotateX(Math.PI / 2), M.white, j3, L2, 0, -0.04);

    const j4 = new THREE.Group(); j4.position.set(L2, 0, -0.04); j3.add(j4);
    mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.12, 28).rotateZ(Math.PI / 2), M.dark, j4, 0.06, 0, 0);
    const j5 = new THREE.Group(); j5.position.x = 0.12; j4.add(j5);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 28).rotateZ(Math.PI / 2), M.steel, j5, 0.02, 0, 0);
    mesh(new THREE.BoxGeometry(0.08, 0.13, 0.26), M.dark, j5, 0.08, 0, 0);
    mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), M.glass, j5, 0.08, 0.075, 0.08, false);
    const fingers = [-1, 1].map(s => {
      const f = new THREE.Group(); j5.add(f);
      mesh(new THREE.BoxGeometry(0.14, 0.06, 0.03), M.steel, f, 0.17, 0, 0);
      mesh(new THREE.BoxGeometry(0.06, 0.07, 0.008), M.darker, f, 0.21, 0, -s * 0.017, false);
      return { f, s };
    });
    const tcp = new THREE.Object3D(); tcp.position.x = TOOL - 0.12; j5.add(tcp);
    return { base, j1, j2, j3, j4, j5, fingers, tcp, ring };
  }

  // Analytic IK: tool pointing straight down, TCP at `p`, gripper yaw `yaw`
  const joints = { q1: 0, q2: 0.6, q3: -1.4, q4: 0, q5: 0 };
  function solveIK(p, yaw) {
    const wx = p.x, wz = p.z, wy = p.y + TOOL;
    const q1 = Math.atan2(-wz, wx);
    const r = Math.hypot(wx, wz), h = wy - SHOULDER_Y;
    let d = Math.hypot(r, h);
    const dMax = L1 + L2 - 0.01, dMin = Math.abs(L1 - L2) + 0.08;
    const scale = clamp(d, dMin, dMax) / d; d *= scale;
    const rr = r * scale, hh = h * scale;
    const c3 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const q3 = -Math.acos(c3);
    const q2 = Math.atan2(hh, rr) - Math.atan2(L2 * Math.sin(q3), L1 + L2 * Math.cos(q3));
    const q4 = -Math.PI / 2 - q2 - q3;
    return { q1, q2, q3, q4, q5: angDiff(q1, yaw) };
  }
  function applyJoints() {
    robot.j1.rotation.y = joints.q1;
    robot.j2.rotation.z = joints.q2;
    robot.j3.rotation.z = joints.q3;
    robot.j4.rotation.z = joints.q4;
    robot.j5.rotation.x = joints.q5;
  }

  /* ---------- Conveyor + photo-eye ---------- */
  const conveyor = new THREE.Group(); scene.add(conveyor);
  const beltLen = BELT_Z1 - BELT_Z0, beltMid = (BELT_Z0 + BELT_Z1) / 2;
  mesh(new THREE.BoxGeometry(0.62, 0.2, beltLen), M.dark, conveyor, BELT_X, 0.15, beltMid);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => mesh(new THREE.BoxGeometry(0.05, 0.06, 0.05), M.darker, conveyor, BELT_X + sx * 0.26, 0.03, beltMid + sz * (beltLen / 2 - 0.1)));
  [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.035, 0.07, beltLen), M.steel, conveyor, BELT_X + s * 0.3, 0.28, beltMid));
  [BELT_Z0, BELT_Z1].forEach(z => mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.56, 24).rotateZ(Math.PI / 2), M.steel, conveyor, BELT_X, 0.2, z));
  const beltTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#16181c'; g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#20232a'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 32, 64, 14);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, beltLen * 2); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const belt = mesh(new THREE.PlaneGeometry(0.52, beltLen), new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.85 }), conveyor, BELT_X, BELT_TOP, beltMid, false);
  belt.rotation.x = -Math.PI / 2;
  [-1, 1].forEach(s => mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), M.dark, conveyor, BELT_X + s * 0.34, 0.42, PICK_Z + 0.16));
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0.85 });
  mesh(new THREE.BoxGeometry(0.66, 0.006, 0.006), laserMat, conveyor, BELT_X, 0.36, PICK_Z + 0.16, false);

  /* ---------- Overhead vision camera ---------- */
  const visionGroup = new THREE.Group(); scene.add(visionGroup);
  const CAM_POS = new THREE.Vector3(BELT_X, 2.05, PICK_Z - 0.35);
  mesh(new THREE.BoxGeometry(0.06, 2.1, 0.06), M.dark, scene, BELT_X - 0.55, 1.05, PICK_Z - 0.35);
  mesh(new THREE.BoxGeometry(0.6, 0.05, 0.06), M.dark, scene, BELT_X - 0.27, 2.12, PICK_Z - 0.35);
  mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), M.white, scene, CAM_POS.x, CAM_POS.y, CAM_POS.z);
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 24), M.glass, scene, CAM_POS.x, CAM_POS.y - 0.08, CAM_POS.z, false);
  const fov = [[-0.42, -0.95], [0.42, -0.95], [0.42, 0.42], [-0.42, 0.42]].map(([dx, dz]) => new THREE.Vector3(BELT_X + dx, BELT_TOP, PICK_Z - 0.35 + dz));
  {
    const pts = [];
    fov.forEach((c, i) => { pts.push(CAM_POS.clone().setY(CAM_POS.y - 0.1), c, c, fov[(i + 1) % 4]); });
    visionGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.55 })));
    const area = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.37), new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.06, depthWrite: false }));
    area.rotation.x = -Math.PI / 2; area.position.set(BELT_X, BELT_TOP + 0.003, PICK_Z - 0.35 - 0.265); visionGroup.add(area);
  }
  const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.012), new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.9 }));
  scanLine.rotation.x = -Math.PI / 2; visionGroup.add(scanLine);

  /* ---------- Bins ---------- */
  const binState = BINS.map((b, i) => {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); scene.add(g);
    const S = 0.5, H = 0.3, T = 0.025;
    mesh(new THREE.BoxGeometry(S, 0.02, S), M.darker, g, 0, 0.01, 0);
    [[0, S / 2 - T / 2, S, T], [0, -S / 2 + T / 2, S, T], [S / 2 - T / 2, 0, T, S], [-S / 2 + T / 2, 0, T, S]].forEach(([x, z, w, d]) => mesh(new THREE.BoxGeometry(w, H, d), M.dark, g, x, H / 2, z));
    const rimMat = new THREE.MeshStandardMaterial({ color: COLORS[i].hex, emissive: COLORS[i].hex, emissiveIntensity: 0.35, roughness: 0.4 });
    [[0, S / 2 - T / 2, S + 0.01, T + 0.01], [0, -S / 2 + T / 2, S + 0.01, T + 0.01], [S / 2 - T / 2, 0, T + 0.01, S + 0.01], [-S / 2 + T / 2, 0, T + 0.01, S + 0.01]].forEach(([x, z, w, d]) => mesh(new THREE.BoxGeometry(w, 0.02, d), rimMat, g, x, H, z, false));
    return { ...b, count: 0, cubes: [] };
  });
  const SLOTS = [[-0.1, -0.1], [0.1, 0.1], [0.1, -0.1], [-0.1, 0.1]];
  const binSlot = bi => {
    const b = binState[bi], n = b.count;
    const [ox, oz] = SLOTS[n % 4];
    return new THREE.Vector3(b.x + ox, 0.02 + CUBE / 2 + Math.floor(n / 4) * CUBE, b.z + oz);
  };

  /* ---------- Parts ---------- */
  const cubeGeo = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
  const cubeMats = COLORS.map(c => new THREE.MeshStandardMaterial({ color: c.hex, roughness: 0.38, metalness: 0.05 }));
  const edgeGeo = new THREE.EdgesGeometry(cubeGeo);
  let partId = 0;
  const parts = [];
  function spawnPart(color = Math.random() * 3 | 0) {
    const m = new THREE.Mesh(cubeGeo, cubeMats[color]);
    m.castShadow = m.receiveShadow = true;
    m.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })));
    m.position.set(BELT_X + (Math.random() - 0.5) * 0.12, BELT_TOP + CUBE / 2, BELT_Z0 + 0.15);
    m.rotation.y = (Math.random() - 0.5) * 0.9;
    scene.add(m);
    const p = { id: ++partId, mesh: m, color, state: 'belt', vy: 0, conf: (0.93 + Math.random() * 0.06).toFixed(2), label: null };
    parts.push(p);
    return p;
  }

  /* ---------- Motion planner ---------- */
  const tcp = HOME.clone(); let tcpYaw = 0;
  let grip = 1; // 1 = open
  let held = null;
  const queue = [];
  let action = null;
  const stats = { picks: 0, cycleStart: 0, cycles: [], errors: 0 };
  const polar = v => ({ a: Math.atan2(v.z, v.x), r: Math.hypot(v.x, v.z), y: v.y });
  const fromPolar = (a, r, y) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  function move(to, yaw = null, speed = 1) { queue.push({ type: 'move', to: to.clone(), yaw, speed }); }
  function gripTo(value) { queue.push({ type: 'grip', value }); }
  function call(fn) { queue.push({ type: 'call', fn }); }
  function wait(dur) { queue.push({ type: 'wait', dur }); }
  function startAction(a) {
    a.t = 0;
    if (a.type === 'move') {
      a.from = tcp.clone(); a.yawFrom = tcpYaw; a.yawTo = a.yaw ?? tcpYaw;
      const P0 = polar(a.from), P1 = polar(a.to);
      a.p0 = P0; a.da = frontAngle(P1.a) - frontAngle(P0.a); a.p1 = P1;
      a.dur = (0.3 + Math.abs(a.da) * 0.34 + Math.abs(P1.r - P0.r) * 0.5 + Math.abs(P1.y - P0.y) * 0.65) / (a.speed * 1.15);
    } else if (a.type === 'grip') { a.from = grip; a.dur = 0.32; }
    else if (a.type === 'call') { a.dur = 0; }
  }
  function moveAt(a, k) {
    const e = ease(k);
    const pos = fromPolar(a.p0.a + a.da * e, a.p0.r + (a.p1.r - a.p0.r) * e, a.p0.y + (a.p1.y - a.p0.y) * e);
    return pos;
  }
  function stepPlanner(dt) {
    if (!action && queue.length) { action = queue.shift(); startAction(action); }
    if (!action) return;
    action.t += dt;
    const k = action.dur ? clamp(action.t / action.dur, 0, 1) : 1;
    if (action.type === 'move') {
      tcp.copy(moveAt(action, k));
      tcpYaw = action.yawFrom + angDiff(action.yawFrom, action.yawTo) * ease(k);
    } else if (action.type === 'grip') grip = action.from + (action.value - action.from) * ease(k);
    else if (action.type === 'call') action.fn();
    if (k >= 1) action = null;
  }
  const busy = () => !!action || queue.length > 0;

  /* ---------- Log + HUD ---------- */
  const logEl = $('[data-rl-log]');
  const t0 = performance.now();
  function log(tag, text, kind = '') {
    const s = Math.floor((performance.now() - t0) / 1000);
    const li = document.createElement('li');
    li.className = kind;
    li.innerHTML = `<time>${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</time><b></b><span></span>`;
    li.querySelector('b').textContent = tag; li.querySelector('span').textContent = text;
    logEl.prepend(li);
    while (logEl.children.length > 5) logEl.lastElementChild.remove();
  }
  const jointEls = [...field.querySelectorAll('[data-joint]')];
  const gripEl = $('[data-rl-grip]'), picksEl = $('[data-rl-picks]'), cycleEl = $('[data-rl-cycle]'), rateEl = $('[data-rl-rate]');
  const labelLayer = $('[data-rl-labels]');

  /* ---------- Tasks ---------- */
  const name = p => `PART-${String(p.id).padStart(2, '0')}`;
  function attach(p) {
    held = p; p.state = 'held';
    robot.j5.attach(p.mesh);
    log('GRIP', `${name(p)} secured · 18.4 N`);
  }
  function release(target) {
    const p = held; if (!p) return;
    held = null;
    scene.attach(p.mesh);
    p.mesh.rotation.x = p.mesh.rotation.z = 0;
    const bi = binState.findIndex(b => Math.abs(p.mesh.position.x - b.x) < 0.25 && Math.abs(p.mesh.position.z - b.z) < 0.25);
    if (bi >= 0) {
      const ok = bi === p.color;
      p.state = 'binned';
      binState[bi].count++; binState[bi].cubes.push(p);
      if (ok) {
        stats.picks++;
        if (stats.cycleStart) { stats.cycles.push((performance.now() - stats.cycleStart) / 1000); if (stats.cycles.length > 8) stats.cycles.shift(); }
        log('PLACE', `${name(p)} → bin ${'ABC'[bi]} ✓`, 'ok');
      } else { stats.errors++; log('CHECK', `${name(p)} in bin ${'ABC'[bi]} · sort mismatch`, 'warn'); }
      if (binState[bi].count >= 8) emptyBin(bi);
    } else if (Math.abs(p.mesh.position.x - BELT_X) < 0.28 && p.mesh.position.z > BELT_Z0 && p.mesh.position.z < BELT_Z1) {
      p.state = 'falling'; p.landOn = 'belt'; log('PLACE', `${name(p)} returned to conveyor`);
    } else { p.state = 'falling'; p.landOn = 'floor'; log('PLACE', `${name(p)} set down in cell`); }
  }
  function emptyBin(bi) {
    const b = binState[bi];
    const doomed = b.cubes.splice(0);
    b.count = 0;
    setTimeout(() => doomed.forEach(p => { scene.remove(p.mesh); parts.splice(parts.indexOf(p), 1); }), 600);
    log('BIN', `Bin ${'ABC'[bi]} full · swapped`);
  }
  function surfaceY(x, z, ignore) {
    let y = Math.abs(x - BELT_X) < 0.28 && z > BELT_Z0 && z < BELT_Z1 ? BELT_TOP : 0;
    parts.forEach(p => {
      if (p === ignore || p.state === 'held' || p.state === 'falling') return;
      const q = p.mesh.position;
      if (Math.abs(q.x - x) < CUBE * 0.9 && Math.abs(q.z - z) < CUBE * 0.9) y = Math.max(y, q.y + CUBE / 2);
    });
    return y;
  }
  function pickSequence(p, place) {
    const at = p.mesh.position.clone();
    const yaw = p.mesh.rotation.y;
    call(() => { p.reserved = true; stats.cycleStart = performance.now(); log('PLAN', `Pick ${name(p)} → ${place ? `bin ${'ABC'[p.color]}` : 'hold'}`); });
    gripTo(1);
    move(at.clone().setY(at.y + 0.32), yaw);
    move(at, yaw, 0.8);
    gripTo(0);
    call(() => attach(p));
    move(at.clone().setY(Math.max(0.95, at.y + 0.5)), yaw);
    if (place) placeSequence(binSlot(p.color));
  }
  function placeSequence(spot) {
    move(spot.clone().setY(Math.max(0.95, spot.y + 0.45)), 0);
    move(spot.clone().setY(spot.y + 0.01), 0, 0.8);
    gripTo(1);
    call(() => release());
    move(spot.clone().setY(Math.max(0.95, spot.y + 0.45)), 0);
  }

  /* ---------- Modes & controls ---------- */
  let mode = 'auto', vision = true, spawnTimer = 0;
  const modeBtns = [...field.querySelectorAll('[data-rl-mode]')];
  const visionBtn = $('[data-rl-action="vision"]'), spawnBtn = $('[data-rl-action="spawn"]'), hint = $('[data-rl-hint]');
  function setMode(m) {
    mode = m;
    field.dataset.rlMode = m;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rlMode === m)));
    hint.textContent = m === 'drive' ? 'Click a part to pick it · click again to place it anywhere' : 'Drag to orbit the cell';
    queue.length = 0;
    if (m === 'auto') {
      log('MODE', 'Autonomous sorting engaged');
      if (held) placeSequence(binSlot(held.color));
      move(HOME, 0);
    } else log('MODE', 'Manual drive · operator in control');
    kick();
  }
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.rlMode)));
  visionBtn.addEventListener('click', () => {
    vision = !vision;
    visionBtn.setAttribute('aria-pressed', String(vision));
    visionGroup.visible = vision; labelLayer.hidden = !vision;
    kick();
  });
  spawnBtn.addEventListener('click', () => {
    if (parts.filter(p => p.state === 'belt').length >= 6) { log('BELT', 'Infeed full · part held back', 'warn'); return; }
    const p = spawnPart(); log('INFEED', `${name(p)} · ${COLORS[p.color].name.toLowerCase()} added`);
    kick();
  });

  /* ---------- Camera + pointer ---------- */
  const view = { yaw: 0.62, pitch: 0.46, dist: 6.2, px: 0, py: 0 };
  const canvas = renderer.domElement;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
  const driveTarget = HOME.clone();
  let down = null;
  const toNdc = e => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  function pointOnPlane(e) { toNdc(e); ray.setFromCamera(ndc, camera); const hit = new THREE.Vector3(); return ray.ray.intersectPlane(workPlane, hit) ? hit : null; }
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch {} field.classList.add('is-active'); });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    view.px = (e.clientX - r.left) / r.width - 0.5; view.py = (e.clientY - r.top) / r.height - 0.5;
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (down.moved) { view.yaw = down.yaw - dx / r.width * 3; view.pitch = clamp(down.pitch + dy / r.height * 1.5, 0.18, 1.1); }
    } else if (mode === 'drive' && !busy()) {
      const hit = pointOnPlane(e);
      if (hit) {
        const pr = polar(hit), rr = clamp(pr.r, 0.6, 1.75);
        driveTarget.copy(fromPolar(pr.a, rr, held ? 0.95 : 0.8));
      }
    }
    kick();
  });
  canvas.addEventListener('pointerup', e => {
    const wasClick = down && !down.moved;
    down = null;
    if (!wasClick || mode !== 'drive' || busy()) return;
    const hit = pointOnPlane(e);
    if (!hit) return;
    if (held) {
      const pr = polar(hit), rr = clamp(pr.r, 0.6, 1.75), spot = fromPolar(pr.a, rr, 0);
      const bi = binState.findIndex(b => Math.abs(spot.x - b.x) < 0.3 && Math.abs(spot.z - b.z) < 0.3);
      if (bi >= 0) spot.copy(binSlot(bi)); else spot.y = surfaceY(spot.x, spot.z, held) + CUBE / 2;
      placeSequence(spot);
    } else {
      let best = null, bestD = 0.3;
      parts.forEach(p => {
        if (p.state === 'binned' || p.state === 'held') return;
        const d = Math.hypot(p.mesh.position.x - hit.x, p.mesh.position.z - hit.z);
        if (d < bestD) { best = p; bestD = d; }
      });
      if (best) { if (best.state === 'belt') best.state = 'staged'; pickSequence(best, false); }
      else log('VISION', 'No part at that location', 'warn');
    }
    kick();
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => { view.px = view.py = 0; });

  function resize() {
    const w = field.clientWidth, h = field.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shift = matchMedia('(min-width: 981px)').matches ? w * 0.16 : 0;
    camera.setViewOffset(w, h, shift, 0, w, h);
    view.dist = camera.aspect < 1 ? 6.4 / Math.max(camera.aspect, 0.55) * 0.75 : 6.2;
    camera.updateProjectionMatrix();
    kick();
  }
  new ResizeObserver(resize).observe(field);

  /* ---------- Main loop ---------- */
  let visible = false, raf = 0, prev = 0, hudAcc = 0, clock = 0;
  const running = () => visible && !document.hidden && !html.classList.contains('motion-paused');
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { rootMargin: '120px' }).observe(field);
  document.addEventListener('visibilitychange', kick);
  new MutationObserver(kick).observe(html, { attributes: true, attributeFilter: ['class'] });

  const target = new THREE.Vector3(-0.05, 0.55, -0.15);
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const proj = new THREE.Vector3();

  function frame(now) {
    raf = 0;
    const live = running();
    const dt = live ? (prev ? Math.min(0.05, (now - prev) / 1000) : 0.016) : 0;
    prev = live ? now : 0;
    clock += dt;

    // conveyor: accumulate parts, stop at the photo-eye
    const onBelt = parts.filter(p => p.state === 'belt').sort((a, b) => b.mesh.position.z - a.mesh.position.z);
    let moving = false, eyeBlocked = false;
    onBelt.forEach((p, i) => {
      const z = p.mesh.position.z;
      const limit = i === 0 ? PICK_Z : onBelt[i - 1].mesh.position.z - CUBE - 0.06;
      const nz = Math.min(limit, z + 0.38 * dt);
      if (nz > z + 1e-4) moving = true;
      p.mesh.position.z = nz;
      if (Math.abs(nz - PICK_Z) < 0.02) eyeBlocked = true;
    });
    if (moving) beltTex.offset.y -= 0.38 * dt * 2;
    laserMat.color.setHex(eyeBlocked ? 0x3ddc97 : 0xff3b2e);

    // falling parts
    parts.forEach(p => {
      if (p.state !== 'falling') return;
      p.vy -= 9.8 * dt;
      p.mesh.position.y += p.vy * dt;
      const floorY = surfaceY(p.mesh.position.x, p.mesh.position.z, p) + CUBE / 2;
      if (p.mesh.position.y <= floorY) { p.mesh.position.y = floorY; p.vy = 0; p.state = p.landOn === 'belt' ? 'belt' : 'floor'; }
    });

    // autonomy
    if (mode === 'auto' && live) {
      spawnTimer += dt;
      const beltCount = parts.filter(p => p.state === 'belt').length;
      const lastSpawn = parts.filter(p => p.state === 'belt').reduce((m, p) => Math.min(m, p.mesh.position.z), Infinity);
      if (spawnTimer > 2.2 && beltCount < 4 && lastSpawn > BELT_Z0 + 0.45) { spawnTimer = 0; spawnPart(); }
      if (!busy() && !held) {
        const ready = onBelt.find(p => Math.abs(p.mesh.position.z - PICK_Z) < 0.02);
        const loose = parts.find(p => p.state === 'floor' && polar(p.mesh.position).r < 1.8 && polar(p.mesh.position).r > 0.6);
        const next = ready || loose;
        if (next) {
          log('VISION', `${name(next)} · ${COLORS[next.color].name.toLowerCase()} · conf ${next.conf}`);
          next.state = 'staged';
          pickSequence(next, true);
          move(HOME, 0);
        } else if (tcp.distanceTo(HOME) > 0.05) move(HOME, 0);
      }
    }

    // motion
    if (mode === 'drive' && !busy()) {
      tcp.lerp(driveTarget, 1 - Math.exp(-dt * 5));
    }
    stepPlanner(dt);
    const ik = solveIK(tcp, tcpYaw);
    const k = dt ? 1 - Math.exp(-dt * 18) : 1;
    for (const j of Object.keys(joints)) joints[j] += angDiff(joints[j], ik[j]) * k;
    applyJoints();
    robot.fingers.forEach(({ f, s }) => { f.position.z = s * (CUBE / 2 + 0.017 + grip * 0.085); });
    robot.ring.material.emissive.setHex(busy() ? 0xffb020 : 0x3ddc97);
    robot.ring.material.color.copy(robot.ring.material.emissive);

    // vision scan line
    scanLine.position.set(BELT_X, BELT_TOP + 0.006, PICK_Z - 0.35 + 0.42 - ((clock * 0.6) % 1) * 1.37);

    // camera
    const yaw = view.yaw + view.px * 0.12 + Math.sin(clock * 0.12) * 0.04;
    const pitch = view.pitch + view.py * 0.05;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(view.dist).add(target);
    camera.lookAt(target);

    renderer.render(scene, camera);

    // vision labels follow parts
    if (vision) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      parts.forEach(p => {
        const show = p.state === 'belt' || p.state === 'staged' || p.state === 'floor' || p.state === 'held';
        if (!show) { if (p.label) { p.label.remove(); p.label = null; } return; }
        if (!p.label) {
          p.label = document.createElement('div');
          p.label.className = 'rl-box';
          p.label.innerHTML = `<span class="mono">${name(p)} · ${COLORS[p.color].name} · ${p.conf}</span>`;
          labelLayer.append(p.label);
        }
        p.mesh.updateWorldMatrix(true, false);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        let i = 0;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          proj.set(sx * CUBE / 2, sy * CUBE / 2, sz * CUBE / 2).applyMatrix4(p.mesh.matrixWorld).project(camera);
          corners[i++].copy(proj);
          x0 = Math.min(x0, proj.x); x1 = Math.max(x1, proj.x); y0 = Math.min(y0, proj.y); y1 = Math.max(y1, proj.y);
        }
        const L = (x0 + 1) / 2 * w, R = (x1 + 1) / 2 * w, T = (1 - y1) / 2 * h, B = (1 - y0) / 2 * h;
        p.label.style.transform = `translate(${L.toFixed(1)}px, ${T.toFixed(1)}px)`;
        p.label.style.width = `${(R - L).toFixed(1)}px`; p.label.style.height = `${(B - T).toFixed(1)}px`;
        p.label.classList.toggle('is-target', p.state === 'staged' || p.state === 'held');
        p.label.classList.toggle('c' + p.color, true);
      });
    }

    // HUD (throttled)
    hudAcc += dt;
    if (hudAcc > 0.1 || !live) {
      hudAcc = 0;
      const vals = [joints.q1, joints.q2, joints.q3, joints.q4, joints.q5];
      jointEls.forEach((el, i) => {
        const deg = ((vals[i] * 180 / Math.PI) % 360 + 540) % 360 - 180;
        el.querySelector('dd').textContent = `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
        el.style.setProperty('--v', (clamp(deg, -180, 180) / 360 + 0.5).toFixed(3));
      });
      gripEl.textContent = held ? 'Closed · 18.4 N' : grip > 0.5 ? 'Open' : 'Closed';
      picksEl.textContent = String(stats.picks).padStart(3, '0');
      const avg = stats.cycles.length ? stats.cycles.reduce((a, b) => a + b, 0) / stats.cycles.length : 0;
      cycleEl.textContent = avg ? `${avg.toFixed(1)} s` : '—';
      rateEl.textContent = avg ? `${(60 / avg).toFixed(1)}/min` : '—';
    }

    if (live || down || busy()) kick();
  }

  // boot
  for (let i = 0; i < 3; i++) { const p = spawnPart(i); p.mesh.position.z = PICK_Z - i * (CUBE + 0.12); }
  const lp = spawnPart(); lp.state = 'floor'; lp.mesh.position.set(0.55, CUBE / 2, 1.05);
  Object.assign(joints, solveIK(tcp, 0));
  applyJoints();
  log('SYSTEM', 'Cell online · vision calibrated');
  field.classList.add('is-3d');
  loader.classList.add('is-done');
  setTimeout(() => { loader.hidden = true; }, 600);
  setMode('auto');
  resize();
}
