(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress = document.querySelector('.progress-bar span');
  const header = document.querySelector('.header');
  const hero = document.querySelector('.hero');
  const heroArt = document.querySelector('.hero-art');
  const aura = document.querySelector('.cursor-aura');

  const updateScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    root.style.setProperty('--scroll-progress', max > 0 ? `${scrollY / max * 100}%` : '0%');
    header?.classList.toggle('is-scrolled', scrollY > 24);
    if (!reduced && heroArt && scrollY < innerHeight * 1.2) {
      heroArt.style.setProperty('--hero-y', `${scrollY * .14}px`);
    }
  };
  addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  if (!reduced && matchMedia('(pointer:fine)').matches) {
    addEventListener('pointermove', event => {
      root.style.setProperty('--pointer-x', `${event.clientX}px`);
      root.style.setProperty('--pointer-y', `${event.clientY}px`);
      if (hero) {
        const x = (event.clientX / innerWidth - .5) * 12;
        const y = (event.clientY / innerHeight - .5) * 8;
        hero.style.setProperty('--tilt-x', `${x}px`);
        hero.style.setProperty('--tilt-y', `${y}px`);
      }
    }, { passive: true });
    aura?.classList.add('is-active');
  }

  const revealTargets = document.querySelectorAll('main > section, .project, .deployment-card, .repo-row, .focus-list > div');
  if ('IntersectionObserver' in window && !reduced) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: .08, rootMargin: '0px 0px -7% 0px' });
    revealTargets.forEach((element, index) => {
      element.classList.add('reveal');
      element.style.setProperty('--reveal-order', index % 6);
      observer.observe(element);
    });
  } else revealTargets.forEach(element => element.classList.add('is-visible'));

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.header nav a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      navLinks.forEach(link => link.classList.toggle('is-active', link.hash === `#${current.target.id}`));
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, .2, .6] });
    sections.forEach(section => sectionObserver.observe(section));
  }

  document.querySelectorAll('.project').forEach(project => project.addEventListener('toggle', () => {
    if (!project.open) return;
    document.querySelectorAll('.project[open]').forEach(other => { if (other !== project) other.open = false; });
  }));
})();
