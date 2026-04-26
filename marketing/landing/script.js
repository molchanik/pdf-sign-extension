// Module form. `type="module"` is set on the <script> tag; defer is implicit.
// motion library is imported directly from CDN — pinned version, no SRI
// (ESM SRI is unevenly supported across browsers for transitive sub-modules).
import { animate, scroll, inView, stagger, hover, press } from "https://cdn.jsdelivr.net/npm/motion@12.38.0/+esm";

// ---- Reduced-motion preference (single source of truth for this module) ----
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Lenis smooth scroll (skipped under prefers-reduced-motion) ----
let lenis = null;
if (!prefersReducedMotion && typeof Lenis === 'function') {
  lenis = new Lenis({
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

// ---- In-page anchor clicks → Lenis smooth-scroll ----
const NAV_OFFSET = 56;
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    if (lenis) {
      lenis.scrollTo(target, { offset: -NAV_OFFSET });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
      window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
    history.pushState(null, '', href);
  });
});

// ---- Scroll-reveal via IntersectionObserver (existing behaviour, unchanged) ----
const items = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
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
} else {
  items.forEach((el) => el.classList.add('in-view'));
}

// ---- Word-by-word reveal on section H2s (existing behaviour, unchanged) ----
const headings = document.querySelectorAll('.section__h2');
if (headings.length && 'IntersectionObserver' in window) {
  headings.forEach((h) => {
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.textContent = '';
    const words = text.split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--word-i', i);
      span.textContent = word;
      h.appendChild(span);
      if (i < words.length - 1) {
        h.appendChild(document.createTextNode(' '));
      }
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

// ---- Scroll progress bar (driven by motion.scroll) ----
const progressBar = document.getElementById('scroll-progress');
if (progressBar && !prefersReducedMotion) {
  scroll((progress) => {
    progressBar.style.transform = `scaleX(${progress})`;
  });
}

// ---- Magnetic CTA on .btn--primary ----
if (!prefersReducedMotion) {
  const STRENGTH = 0.3;
  document.querySelectorAll('.btn--primary').forEach((btn) => {
    let raf = null;
    btn.addEventListener('mousemove', (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * STRENGTH;
        const dy = (e.clientY - r.top - r.height / 2) * STRENGTH;
        animate(btn, { x: dx, y: dy }, {
          type: 'spring', stiffness: 300, damping: 20, mass: 0.5,
        });
      });
    });
    btn.addEventListener('mouseleave', () => {
      if (raf) cancelAnimationFrame(raf);
      animate(btn, { x: 0, y: 0 }, {
        type: 'spring', stiffness: 300, damping: 22,
      });
    });
  });
}

// ---- Spring hover-lift on bento cards ----
if (!prefersReducedMotion) {
  hover('.bento .card', (el) => {
    el.style.willChange = 'transform';
    animate(el, { y: -6, scale: 1.015 }, {
      type: 'spring', stiffness: 350, damping: 22,
    });
    return () => {
      animate(el, { y: 0, scale: 1 }, {
        type: 'spring', stiffness: 350, damping: 22,
      }).finished.then(() => {
        el.style.willChange = 'auto';
      });
    };
  });
}

// ---- Per-character hero H1 reveal (replaces per-word + bounce) ----
const heroH1 = document.querySelector('.hero__h1');
if (heroH1 && !prefersReducedMotion) {
  // Split each existing .word into per-character .char spans.
  // Order is preserved — index is the global character index across the title.
  let charIndex = 0;
  const words = heroH1.querySelectorAll('.word');
  words.forEach((word) => {
    const text = word.textContent;
    word.textContent = '';
    [...text].forEach((char) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--char-i', charIndex);
      span.textContent = char;
      word.appendChild(span);
      charIndex++;
    });
  });

  // Switch the body class so CSS hides .word and reveals .char in from-state.
  document.body.classList.add('js-hero-chars');

  // Animate characters with stagger. Opacity-only — chars stay `display: inline`
  // to preserve kerning and avoid font-swap layout shift; transform on inline is
  // a no-op anyway, so we drop the y-translation.
  animate(
    '.hero__h1 .char',
    { opacity: [0, 1] },
    { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: stagger(0.025) }
  );
}

// ---- Privacy diagram: continuous Disk → Browser → Signed cycle ----
// CSS-only loop (see `privacy-pulse` keyframes in styles.css). The cycle
// itself is the message — data moves inside the client's machine, never
// leaves. No JS needed; reduced-motion override in styles.css freezes it.

// ---- Pause feature-card SVG illustrations when out of viewport ----
// Selectors target every CSS-animated element inside the bento section so
// each card's local rhythm stays in sync (the SVG markup defines its own
// per-row delays via inline `style="--i: N"`).
const ILLUS_SELECTORS = [
  '.illus-text__name tspan',
  '.illus-text__caret',
  '.illus-form__fill',
  '.illus-form__check',
  '.illus-noauth__progress',
  '.illus-noauth__ring',
  '.illus-noauth__shackle',
].join(', ');

if (!prefersReducedMotion) {
  inView('.bento .card', (card) => {
    const animatedEls = card.querySelectorAll(ILLUS_SELECTORS);
    animatedEls.forEach((el) => {
      el.style.animationPlayState = 'running';
    });
    return () => {
      animatedEls.forEach((el) => {
        el.style.animationPlayState = 'paused';
      });
    };
  }, { margin: '0px 0px 0px 0px' });
}
