(function () {
  'use strict';

  // ---- Lenis smooth scroll (skipped under prefers-reduced-motion) ----
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && typeof Lenis === 'function') {
    const lenis = new Lenis({
      duration: 0.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
    });
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // ---- Scroll-reveal via IntersectionObserver ----
  const items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -80px 0px', threshold: 0.12 }
  );

  items.forEach((el) => io.observe(el));

  // ---- Word-by-word reveal on section H2s ----
  const headings = document.querySelectorAll('.section__h2');
  if (headings.length && 'IntersectionObserver' in window) {
    headings.forEach((h) => {
      const text = h.textContent;
      h.setAttribute('aria-label', text);
      h.textContent = '';
      text.split(/\s+/).forEach((word, i) => {
        if (!word) return;
        const span = document.createElement('span');
        span.className = 'word';
        span.style.setProperty('--word-i', i);
        span.textContent = word + ' ';
        h.appendChild(span);
      });
    });

    const h2io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            h2io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.2 }
    );
    headings.forEach((h) => h2io.observe(h));
  }
})();
