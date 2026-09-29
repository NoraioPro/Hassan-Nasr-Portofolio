(() => {
  const root = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = document.getElementById('motion-toggle');
  let paused = preference.matches;
  function applyMotion() {
    root.classList.toggle('motion-paused', paused);
    motionButton.textContent = paused ? 'Resume motion ▷' : 'Pause motion Ⅱ';
    motionButton.setAttribute('aria-pressed', String(paused));
  }
  motionButton.addEventListener('click', () => { paused = !paused; applyMotion(); });
  preference.addEventListener('change', event => { paused = event.matches; applyMotion(); });
  applyMotion();
  document.addEventListener('visibilitychange', () => root.classList.toggle('scene-paused', document.hidden));
  let scrollQueued = false;
  const updateScroll = () => {
    scrollQueued = false;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--scroll-progress', max > 0 ? `${scrollY / max * 100}%` : '0%');
    document.querySelector('.header').classList.toggle('is-scrolled', scrollY > 24);
  };
  addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  updateScroll();
  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  function closeMenu() { nav.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); }
  menu.addEventListener('click', () => { const open = nav.classList.toggle('menu-open'); menu.setAttribute('aria-expanded', String(open)); });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('menu-open')) { closeMenu(); menu.focus(); } });
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); }
    }), { threshold: .05 });
    if (!preference.matches) document.querySelectorAll('.frontiers-heading,.frontier-copy,.project,.deployment-card,.focus-list>div').forEach(element => { element.classList.add('reveal'); reveal.observe(element); });
    const scenes = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('scene-paused', !entry.isIntersecting)), { rootMargin: '100px' });
    document.querySelectorAll('.hero,.frontier-panel').forEach(element => scenes.observe(element));
  }
  document.querySelectorAll('.project').forEach(project => project.addEventListener('toggle', () => {
    if (project.open) document.querySelectorAll('.project[open]').forEach(other => { if (other !== project) other.open = false; });
  }));
  document.querySelectorAll('[data-repo-query]').forEach(link => link.addEventListener('click', () => {
    const search = document.getElementById('repo-search');
    document.getElementById('repo-owner').value = '';
    search.value = link.dataset.repoQuery;
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  document.querySelectorAll('[data-project]').forEach(link => link.addEventListener('click', event => {
    const project = [...document.querySelectorAll('.project')].find(item => item.querySelector('.project-name').textContent.startsWith(link.dataset.project));
    if (project) { event.preventDefault(); project.open = true; project.classList.add('is-visible'); project.scrollIntoView({ behavior: paused ? 'instant' : 'smooth', block: 'center' }); }
  }));
  document.querySelectorAll('[data-medical-signal]').forEach(field => {
    const canvas = field.querySelector('canvas');
    const context = canvas.getContext('2d');
    const pointer = { x: .74, y: .42, active: false };
    const dots = Array.from({ length: 36 }, (_, index) => ({
      x: .28 + ((index * 47) % 71) / 100,
      y: .08 + ((index * 29) % 83) / 100,
      phase: index * .61,
      size: 1 + (index % 3) * .42
    }));
    let frame;
    function render(time) {
      const box = field.getBoundingClientRect();
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, box.width, box.height);
      const glow = context.createRadialGradient(pointer.x * box.width, pointer.y * box.height, 0, pointer.x * box.width, pointer.y * box.height, box.width * .62);
      glow.addColorStop(0, 'rgba(101, 240, 211, .30)'); glow.addColorStop(.32, 'rgba(40, 157, 151, .14)'); glow.addColorStop(1, 'rgba(4, 20, 28, 0)');
      context.fillStyle = glow; context.fillRect(0, 0, box.width, box.height);
      const nodes = dots.map(dot => ({ x: dot.x * box.width + Math.sin(time * .00055 + dot.phase) * 10, y: dot.y * box.height + Math.cos(time * .00066 + dot.phase) * 8, dot }));
      context.lineWidth = 1;
      nodes.forEach((node, i) => nodes.slice(i + 1).forEach(other => {
        const distance = Math.hypot(node.x - other.x, node.y - other.y);
        if (distance < 92) { context.strokeStyle = `rgba(117, 239, 216, ${(.17 * (1 - distance / 92)).toFixed(3)})`; context.beginPath(); context.moveTo(node.x, node.y); context.lineTo(other.x, other.y); context.stroke(); }
      }));
      nodes.forEach(({ x, y, dot }) => {
        const influence = Math.max(0, 1 - Math.hypot(x - pointer.x * box.width, y - pointer.y * box.height) / 135);
        context.beginPath(); context.arc(x, y, dot.size + influence * 3.3, 0, Math.PI * 2); context.fillStyle = influence > .5 ? '#e6fff7' : 'rgba(126, 239, 216, .82)'; context.fill();
      });
      const waveY = box.height * .52;
      context.beginPath();
      for (let x = 0; x <= box.width; x += 5) { const y = waveY + Math.sin(x * .035 + time * .004) * 5 + Math.sin(x * .081 - time * .0024) * 3; x ? context.lineTo(x, y) : context.moveTo(x, y); }
      context.strokeStyle = 'rgba(146, 255, 232, .45)'; context.stroke();
      if (!paused && !document.hidden) frame = requestAnimationFrame(render);
    }
    const restart = () => { cancelAnimationFrame(frame); if (!preference.matches) frame = requestAnimationFrame(render); else render(0); };
    field.addEventListener('pointermove', event => { const rect = field.getBoundingClientRect(); pointer.x = (event.clientX - rect.left) / rect.width; pointer.y = (event.clientY - rect.top) / rect.height; pointer.active = true; });
    field.addEventListener('pointerleave', () => { pointer.x = .74; pointer.y = .42; pointer.active = false; });
    addEventListener('resize', restart, { passive: true });
    restart();
  });
  document.querySelectorAll('[data-robotics-console]').forEach(consoleField => {
    const status = consoleField.querySelector('[data-robot-status]');
    consoleField.addEventListener('pointermove', event => {
      const rect = consoleField.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      consoleField.style.setProperty('--robot-x', `${-y * 9}deg`);
      consoleField.style.setProperty('--robot-y', `${x * 12}deg`);
    });
    consoleField.addEventListener('pointerleave', () => { consoleField.style.setProperty('--robot-x', '0deg'); consoleField.style.setProperty('--robot-y', '0deg'); });
    consoleField.querySelectorAll('[data-robot-mode]').forEach(button => button.addEventListener('click', () => {
      const mode = button.dataset.robotMode;
      consoleField.dataset.robotMode = mode;
      consoleField.querySelectorAll('[data-robot-mode]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
      status.textContent = mode === 'calibrate' ? 'CALIBRATING / ACTIVE' : 'VISION / READY';
    }));
  });
  document.querySelectorAll('[data-portrait-field]').forEach(field => {
    const tracker = field.closest('.hero') || field;
    let pending = false;
    let lastX = 0;
    let lastY = 0;
    const updateHead = () => {
      field.style.setProperty('--head-x', `${-lastY * 13}deg`);
      field.style.setProperty('--head-y', `${lastX * 18}deg`);
      field.style.setProperty('--portrait-glow-x', `${68 + lastX * 16}%`);
      field.style.setProperty('--portrait-glow-y', `${44 + lastY * 12}%`);
      pending = false;
    };
    tracker.addEventListener('pointermove', event => {
      const rect = tracker.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      lastX = x;
      lastY = y;
      if (!pending) { pending = true; requestAnimationFrame(updateHead); }
    });
    tracker.addEventListener('pointerleave', () => { lastX = 0; lastY = 0; if (!pending) { pending = true; requestAnimationFrame(updateHead); } });
  });
})();
