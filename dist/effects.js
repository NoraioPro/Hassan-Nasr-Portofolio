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
})();
