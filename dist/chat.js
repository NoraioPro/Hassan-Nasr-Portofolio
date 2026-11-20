/* chat.js: the floating WhatsApp button. Each page gets a message that fits it (a workshop enquiry on the workshops page, a
   project question on projects, and so on). It shows whether it is a usual answering time in Cairo, where the number is,
   and offers a short hello card once per visitor, remembered for a week. It steps aside while the contact section or
   search is on screen, since both have their own way to reach you. */
(() => {
  const NUMBER = '201111113628';
  const float = document.querySelector('[data-wa-float]');
  if (!float) return;
  const phone = matchMedia('(max-width: 760px)');

  // the message depends on the page; keys are page paths (the home page is '/')
  const MESSAGES = {
    '/': 'Hi Hassan, I found your website and would like to talk.',
    '/space/': 'Hi Hassan, I would like to talk about your space and satellite work.',
    '/medical/': 'Hi Hassan, I would like to talk about healthcare AI and clinical platforms.',
    '/robotics/': 'Hi Hassan, I would like to talk about your robotics work.',
    '/digital-twin/': 'Hi Hassan, I would like to talk about digital twins.',
    '/projects/': 'Hi Hassan, I saw your projects and would like to talk.',
    '/credentials/': 'Hi Hassan, I saw your credentials and would like to connect.',
    '/workshops/': 'Hi Hassan, I am interested in an AI workshop for my team.',
    '/about/': 'Hi Hassan, I would like to learn more about your work.',
    '/labs/': 'Hi Hassan, I saw your labs and games and would like to talk.',
  };
  const path = location.pathname.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');
  const text = MESSAGES[path] || MESSAGES['/'];
  const href = `https://wa.me/${NUMBER}?text=${encodeURIComponent(text)}`;
  float.querySelectorAll('[data-wa-link]').forEach(a => { a.href = href; });
  const dockWa = document.querySelector('.m-dock-wa');
  if (dockWa) dockWa.href = href; // the phone bar uses the same page-specific message

  // status from Cairo time: a usual answering window of 08:00 to 22:00
  const cairoHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const usual = cairoHour >= 8 && cairoHour < 22;
  float.classList.toggle('is-away', !usual);
  float.querySelector('[data-wa-status]').textContent = usual ? 'Usually online now' : 'Replies from 8am Cairo time';

  // the hello card: once per visitor, dismissed for a week
  const card = float.querySelector('[data-wa-card]');
  const SEEN = 'wa-card-dismissed';
  let dismissed = false;
  try { dismissed = Date.now() - Number(localStorage.getItem(SEEN) || 0) < 7 * 864e5; } catch {}
  let shown = false;
  const show = () => {
    if (shown || dismissed || phone.matches) return;
    shown = true;
    card.hidden = false;
  };
  const hide = remember => {
    card.hidden = true;
    if (remember) {
      dismissed = true;
      try { localStorage.setItem(SEEN, String(Date.now())); } catch {}
    }
  };
  float.querySelector('[data-wa-close]').addEventListener('click', () => hide(true));
  float.querySelector('[data-wa-btn]').addEventListener('click', () => hide(true));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) hide(false); });
  // appear after a while, or once the visitor is halfway down the page
  setTimeout(show, 25000);
  addEventListener('scroll', () => {
    if (scrollY > (document.documentElement.scrollHeight - innerHeight) * 0.5) show();
  }, { passive: true });

  // step aside while the contact section or search is on screen
  const contact = document.getElementById('contact');
  let contactIn = false, searchOpen = false;
  const quiet = () => float.classList.toggle('is-quiet', contactIn || searchOpen);
  if (contact) new IntersectionObserver(([e]) => { contactIn = e.isIntersecting; quiet(); }, { threshold: 0.15 }).observe(contact);
  const palette = document.getElementById('palette');
  if (palette) new MutationObserver(() => { searchOpen = palette.hasAttribute('open'); quiet(); }).observe(palette, { attributes: true, attributeFilter: ['open'] });
})();
