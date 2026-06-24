// src/nav.mjs
export const NAV_SCRIPT = `
const links = [...document.querySelectorAll('.nav__link')];
const map = new Map(links.map(l => [l.getAttribute('href').slice(1), l]));
const obs = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      links.forEach(l => l.classList.remove('is-active'));
      map.get(e.target.id)?.classList.add('is-active');
    }
  }
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('.op').forEach(s => obs.observe(s));
`;
