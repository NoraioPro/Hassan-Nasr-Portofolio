/**
 * Procedural interactive 3D satellite for the Space panel.
 * Named parts with hover/click feedback; drag orbit + idle spin.
 * Falls back by returning false so caller can enable PNG tilt.
 */
import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';

const PART_COPY = {
  body: { eyebrow: 'ORBITAL SYSTEM', title: 'BUS CORE', hint: 'STRUCTURAL LOCK' },
  solarLeft: { eyebrow: 'ENERGY ARRAY', title: 'SOLAR WING L', hint: 'PANEL CHARGE' },
  solarRight: { eyebrow: 'ENERGY ARRAY', title: 'SOLAR WING R', hint: 'PANEL CHARGE' },
  dish: { eyebrow: 'UPLINK ARRAY', title: 'DEEP SPACE LINK', hint: 'SIGNAL LOCK' },
  sensor: { eyebrow: 'EARTH OBSERVATION', title: 'OPTICAL BAY', hint: 'MOVE TO ORBIT' },
  thrusters: { eyebrow: 'PROPULSION', title: 'ATTITUDE BURN', hint: 'DELTA-V READY' },
  ringInner: { eyebrow: 'ORBITAL PATH', title: 'INNER TRAJECTORY', hint: 'KEEP STATION' },
  ringOuter: { eyebrow: 'ORBITAL PATH', title: 'OUTER TRAJECTORY', hint: 'KEEP STATION' }
};

const DEFAULT_COPY = { eyebrow: 'ORBITAL SYSTEM', title: 'EARTH OBSERVATION', hint: 'MOVE TO ORBIT' };

function goldMaterial(emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color: 0xe0bf6a,
    metalness: 0.92,
    roughness: 0.28,
    emissive,
    emissiveIntensity: 0.28
  });
}

function panelMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0b1c33,
    metalness: 0.55,
    roughness: 0.35,
    emissive: 0x123a62,
    emissiveIntensity: 0.35
  });
}

function accentMaterial(color = 0x7ad7ff) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.4,
    emissive: color,
    emissiveIntensity: 0.55
  });
}

function makeSolarWing() {
  const group = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.82), panelMaterial());
  group.add(board);
  const cellGeo = new THREE.PlaneGeometry(0.28, 0.26);
  const cellMat = new THREE.MeshStandardMaterial({
    color: 0x143a66,
    metalness: 0.3,
    roughness: 0.45,
    emissive: 0x1a6aa8,
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide
  });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const cell = new THREE.Mesh(cellGeo, cellMat.clone());
      cell.position.set(-0.58 + col * 0.38, 0.03, -0.18 + row * 0.36);
      cell.rotation.x = -Math.PI / 2;
      group.add(cell);
    }
  }
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), goldMaterial());
  boom.rotation.z = Math.PI / 2;
  boom.position.x = -0.95;
  group.add(boom);
  return group;
}

function buildSatellite() {
  const root = new THREE.Group();
  root.name = 'satelliteRoot';

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.58, 0.58), goldMaterial(0x6a4a18));
  body.name = 'body';
  body.userData.part = 'body';
  root.add(body);

  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.08, 0.56),
    new THREE.MeshStandardMaterial({ color: 0xd4b06a, metalness: 0.95, roughness: 0.22, emissive: 0x8a6a28, emissiveIntensity: 0.35 })
  );
  band.position.y = 0.05;
  band.name = 'body';
  band.userData.part = 'body';
  root.add(band);

  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 16), accentMaterial(0x9ef0ff));
  sensor.rotation.x = Math.PI / 2;
  sensor.position.set(0, -0.05, 0.38);
  sensor.name = 'sensor';
  sensor.userData.part = 'sensor';
  root.add(sensor);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshStandardMaterial({
    color: 0x041018, metalness: 1, roughness: 0.1, emissive: 0x33cfff, emissiveIntensity: 0.8
  }));
  lens.position.set(0, -0.05, 0.5);
  lens.name = 'sensor';
  lens.userData.part = 'sensor';
  root.add(lens);

  const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), goldMaterial());
  dishArm.position.set(0.15, 0.45, -0.1);
  dishArm.name = 'dish';
  dishArm.userData.part = 'dish';
  root.add(dishArm);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), goldMaterial(0x5a4010));
  dish.rotation.x = Math.PI;
  dish.position.set(0.15, 0.62, -0.1);
  dish.name = 'dish';
  dish.userData.part = 'dish';
  root.add(dish);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), accentMaterial(0xffd27a));
  feed.position.set(0.15, 0.52, -0.1);
  feed.name = 'dish';
  feed.userData.part = 'dish';
  root.add(feed);

  const solarLeft = makeSolarWing();
  solarLeft.position.set(-1.5, 0, 0);
  solarLeft.name = 'solarLeft';
  solarLeft.traverse(o => { if (o.isMesh) { o.userData.part = 'solarLeft'; o.name = 'solarLeft'; } });
  root.add(solarLeft);

  const solarRight = makeSolarWing();
  solarRight.scale.x = -1;
  solarRight.position.set(1.5, 0, 0);
  solarRight.name = 'solarRight';
  solarRight.traverse(o => { if (o.isMesh) { o.userData.part = 'solarRight'; o.name = 'solarRight'; } });
  root.add(solarRight);

  const thrusterGroup = new THREE.Group();
  thrusterGroup.name = 'thrusters';
  [-0.2, 0.2].forEach((x, i) => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.16, 10), goldMaterial(0x402010));
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, -0.12, -0.42);
    nozzle.userData.part = 'thrusters';
    nozzle.name = 'thrusters';
    thrusterGroup.add(nozzle);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), accentMaterial(0x66e0ff));
    glow.position.set(x, -0.12, -0.55);
    glow.scale.setScalar(1.35);
    glow.userData.part = 'thrusters';
    glow.name = 'thrusters';
    thrusterGroup.add(glow);
  });
  root.add(thrusterGroup);

  // Larger invisible pick proxies so each part feels easy to target
  const proxies = [
    { part: 'body', geo: new THREE.BoxGeometry(0.95, 0.75, 0.75), pos: [0, 0, 0] },
    { part: 'solarLeft', geo: new THREE.BoxGeometry(1.9, 0.2, 0.95), pos: [-1.5, 0, 0] },
    { part: 'solarRight', geo: new THREE.BoxGeometry(1.9, 0.2, 0.95), pos: [1.5, 0, 0] },
    { part: 'dish', geo: new THREE.SphereGeometry(0.38, 12, 12), pos: [0.15, 0.62, -0.1] },
    { part: 'sensor', geo: new THREE.SphereGeometry(0.28, 12, 12), pos: [0, -0.05, 0.45] },
    { part: 'thrusters', geo: new THREE.BoxGeometry(0.7, 0.35, 0.45), pos: [0, -0.12, -0.5] }
  ];
  proxies.forEach(p => {
    const mesh = new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.position.set(...p.pos);
    mesh.name = p.part;
    mesh.userData.part = p.part;
    mesh.userData.proxy = true;
    root.add(mesh);
  });

  return root;

}

function makeOrbitRing(radius, part, dashed = false) {
  const points = [];
  const segments = 96;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: dashed ? 0x5aa8d8 : 0x7ecfff,
    transparent: true,
    opacity: dashed ? 0.35 : 0.45
  });
  const line = new THREE.LineLoop(geo, mat);
  line.name = part;
  line.userData.part = part;
  // Invisible hit torus for raycasting
  const hit = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.14, 8, 64),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  );
  hit.name = part;
  hit.userData.part = part;
  hit.rotation.x = Math.PI / 2;
  const group = new THREE.Group();
  group.name = part;
  group.add(line);
  group.add(hit);
  return group;
}

function makeStarField() {
  const count = 280;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xb8e7ff, size: 0.035, transparent: true, opacity: 0.75, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

function makeEnergyTrail() {
  const count = 48;
  const positions = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x7af0ff, size: 0.06, transparent: true, opacity: 0, depthAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  return { points, positions, geo, mat, life: 0, origin: new THREE.Vector3() };
}

function setReadout(field, copy) {
  const readout = field.querySelector('.satellite-readout');
  if (!readout) return;
  const span = readout.querySelector('span');
  const b = readout.querySelector('b');
  const i = readout.querySelector('i');
  if (span) span.textContent = copy.eyebrow;
  if (b) b.textContent = copy.title;
  if (i) i.textContent = copy.hint;
  readout.classList.remove('is-flash');
  void readout.offsetWidth;
  readout.classList.add('is-flash');
}

function collectPartMeshes(root) {
  const map = new Map();
  root.traverse(obj => {
    if (!obj.isMesh || !obj.userData.part || obj.userData.proxy) return;
    const key = obj.userData.part;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(obj);
    if (obj.material && !obj.userData._baseEmissive) {
      obj.userData._baseEmissive = obj.material.emissive ? obj.material.emissive.clone() : new THREE.Color(0x000000);
      obj.userData._baseEmissiveIntensity = obj.material.emissiveIntensity ?? 0;
      obj.userData._baseColor = obj.material.color ? obj.material.color.clone() : null;
    }
  });
  return map;
}

function highlightPart(partMap, partKey, on) {
  const meshes = partMap.get(partKey) || [];
  meshes.forEach(mesh => {
    if (!mesh.material || mesh.material.visible === false) return;
    if (mesh.material.visible === false) return;
    if (on) {
      if (mesh.material.emissive) mesh.material.emissive.set(0x9fe8ff);
      mesh.material.emissiveIntensity = Math.max(0.85, mesh.userData._baseEmissiveIntensity || 0);
      if (mesh.material.color && mesh.userData._baseColor) mesh.material.color.offsetHSL(0, 0.05, 0.08);
    } else {
      if (mesh.material.emissive && mesh.userData._baseEmissive) mesh.material.emissive.copy(mesh.userData._baseEmissive);
      mesh.material.emissiveIntensity = mesh.userData._baseEmissiveIntensity || 0;
      if (mesh.material.color && mesh.userData._baseColor) mesh.material.color.copy(mesh.userData._baseColor);
    }
  });
}

export async function mountSatelliteVisual(field, { pausedRef, preference, root } = {}) {
  const canvas = field.querySelector('[data-sat-canvas], [data-spline-canvas]');
  if (!canvas) return false;
  if (preference?.matches) return false;

  const motionBlocked = () =>
    (pausedRef ? pausedRef() : false) ||
    preference?.matches ||
    root?.classList.contains('motion-paused') ||
    field.closest('.frontier-panel')?.classList.contains('scene-paused');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL unavailable for satellite.', err);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0.2, 0.35, 4.35);

  const ambient = new THREE.AmbientLight(0x6a8aab, 0.55);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffe2b0, 1.35);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x66cfff, 0.7);
  rim.position.set(-5, -1, -3);
  scene.add(rim);
  const fill = new THREE.PointLight(0x3a6a9a, 1.1, 20);
  fill.position.set(0, 0, 3);
  scene.add(fill);

  scene.add(makeStarField());

  const stage = new THREE.Group();
  scene.add(stage);

  const ringOuter = makeOrbitRing(2.55, 'ringOuter', false);
  const ringInner = makeOrbitRing(1.85, 'ringInner', true);
  ringOuter.rotation.x = 0.55;
  ringOuter.rotation.z = 0.2;
  ringInner.rotation.x = 0.9;
  ringInner.rotation.y = 0.15;
  stage.add(ringOuter);
  stage.add(ringInner);

  const satellite = buildSatellite();
  satellite.scale.setScalar(1.15);
  stage.add(satellite);

  const trail = makeEnergyTrail();
  scene.add(trail.points);

  const partMap = collectPartMeshes(stage);
  // Include ring hit meshes
  stage.traverse(o => {
    if (o.isMesh && o.userData.part && (o.userData.part === 'ringInner' || o.userData.part === 'ringOuter')) {
      if (!partMap.has(o.userData.part)) partMap.set(o.userData.part, []);
      if (!partMap.get(o.userData.part).includes(o)) partMap.get(o.userData.part).push(o);
    }
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let focused = null;
  let focusT = 0;
  let dragging = false;
  let dragMoved = false;
  let downX = 0;
  let downY = 0;
  let lastX = 0;
  let lastY = 0;
  let yaw = 0.35;
  let pitch = 0.18;
  let targetYaw = yaw;
  let targetPitch = pitch;
  let autoSpin = true;
  let idleTimer = 0;
  let pulse = 0;
  let disposed = false;

  const resize = () => {
    const rect = field.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  const pick = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [];
    partMap.forEach(list => list.forEach(m => meshes.push(m)));
    const hits = raycaster.intersectObjects(meshes, true);
    return hits[0]?.object?.userData?.part || null;
  };

  const onPointerDown = event => {
    if (event.button != null && event.button !== 0) return;
    dragging = true;
    autoSpin = false;
    clearTimeout(idleTimer);
    field.classList.add('is-dragging');
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = event => {
    if (dragging) {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      targetYaw += dx * 0.0055;
      targetPitch = Math.max(-0.55, Math.min(0.55, targetPitch + dy * 0.0035));
      return;
    }
    const part = pick(event.clientX, event.clientY);
    if (part !== hovered) {
      if (hovered) highlightPart(partMap, hovered, false);
      hovered = part;
      if (hovered) {
        highlightPart(partMap, hovered, true);
        setReadout(field, PART_COPY[hovered] || DEFAULT_COPY);
        field.classList.add('is-part-hot');
      } else {
        field.classList.remove('is-part-hot');
        if (!focused) setReadout(field, DEFAULT_COPY);
      }
    }
  };

  const endDrag = event => {
    if (!dragging) return;
    dragging = false;
    field.classList.remove('is-dragging');
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
    idleTimer = setTimeout(() => { if (!motionBlocked()) autoSpin = true; }, 1100);
  };

  const onClick = event => {
    if (Math.abs(event.clientX - lastX) > 4) return;
    const part = pick(event.clientX, event.clientY);
    if (!part) return;
    focused = part;
    focusT = 1;
    pulse = 1;
    highlightPart(partMap, part, true);
    setReadout(field, PART_COPY[part] || DEFAULT_COPY);
    const meshes = partMap.get(part) || [];
    const center = new THREE.Vector3();
    if (meshes[0]) {
      meshes[0].getWorldPosition(center);
      trail.origin.copy(center);
      trail.life = 1;
      trail.points.visible = true;
      trail.mat.opacity = 0.9;
    }
    field.classList.add('is-part-focus');
    setTimeout(() => field.classList.remove('is-part-focus'), 700);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (hovered && hovered !== focused) highlightPart(partMap, hovered, false);
    hovered = null;
    field.classList.remove('is-part-hot');
    if (!focused) setReadout(field, DEFAULT_COPY);
  });
  canvas.addEventListener('click', onClick);

  const ro = new ResizeObserver(resize);
  ro.observe(field);

  let raf = 0;
  const clock = new THREE.Clock();

  const tick = () => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const blocked = motionBlocked();

    if (autoSpin && !dragging && !blocked) targetYaw += dt * 0.35;

    yaw += (targetYaw - yaw) * 0.12;
    pitch += (targetPitch - pitch) * 0.12;
    stage.rotation.y = yaw;
    stage.rotation.x = pitch;

    ringOuter.rotation.z += blocked ? 0 : dt * 0.15;
    ringInner.rotation.z -= blocked ? 0 : dt * 0.22;

    // Subtle solar wing flex
    const flex = Math.sin(clock.elapsedTime * 1.2) * 0.03;
    const left = satellite.getObjectByName('solarLeft');
    const right = satellite.getObjectByName('solarRight');
    if (left) left.rotation.z = flex;
    if (right) right.rotation.z = -flex;

    if (focusT > 0) {
      focusT = Math.max(0, focusT - dt * 0.9);
      const zoom = 4.35 - Math.sin(focusT * Math.PI) * 0.65;
      camera.position.z += (zoom - camera.position.z) * 0.15;
    } else {
      camera.position.z += (4.35 - camera.position.z) * 0.06;
    }

    if (pulse > 0) pulse = Math.max(0, pulse - dt * 1.4);

    if (trail.life > 0) {
      trail.life = Math.max(0, trail.life - dt * 1.2);
      trail.mat.opacity = trail.life * 0.9;
      for (let i = 0; i < 48; i++) {
        const t = i / 48;
        trail.positions[i * 3] = trail.origin.x + Math.cos(t * 12 + clock.elapsedTime * 6) * t * 0.6;
        trail.positions[i * 3 + 1] = trail.origin.y + Math.sin(t * 9 + clock.elapsedTime * 4) * t * 0.4;
        trail.positions[i * 3 + 2] = trail.origin.z + t * 0.8;
      }
      trail.geo.attributes.position.needsUpdate = true;
      if (trail.life <= 0) trail.points.visible = false;
    }

    renderer.render(scene, camera);
  };

  field.classList.add('is-spline-live', 'is-sat3d-live');
  setReadout(field, DEFAULT_COPY);
  raf = requestAnimationFrame(tick);

  field._disposeSatellite3d = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    canvas.removeEventListener('click', onClick);
    renderer.dispose();
    field.classList.remove('is-spline-live', 'is-sat3d-live');
  };

  return true;
}