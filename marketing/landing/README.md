# PDF Sign — landing page (preview)

Static single-page landing for the PDF Sign Chrome extension. Pure HTML + CSS + one ~20-line vanilla JS file for scroll-reveal. No build step.

## Preview locally

Open `marketing/landing/index.html` directly in Chrome — the page renders stand-alone from `file://`. The hero and bento illustrations are inline SVG with CSS keyframe animations.

## Files

- `index.html` — full page markup, inline SVG hero scene + 4 bento illustrations + privacy flow
- `styles.css` — design tokens + all keyframe animations + scroll-reveal classes
- `script.js` — IntersectionObserver that toggles `.in-view` on `.reveal` elements

## Assets used

- `../assets/icon.png` — favicon, nav brand, footer brand

Product screenshots are no longer referenced (prior version used 5 PNGs in hero + bento; replaced by SVG animations). The PNGs still live in `../assets/` for the CWS templates under `marketing/templates/`.

## Design direction

Linear structural simplicity + Raycast visual weight. Dark-first, single cherry-scarlet accent (`#B91C1C`), Inter for prose, JetBrains Mono for numbers.

## Animation summary

- **Hero**: 8s one-shot quill sequence — enters from top-right, dips into inkwell, drops ink, traces an abstract signature squiggle across a parchment on a wooden desk, stamp presses at the end, quill rests. Synced via CSS keyframes (no JS).
- **Bento**: 4 looping mini-illustrations — sig squiggle, font cycle, form fill+check stagger, wifi-off + padlock pulse.
- **Privacy flow**: animated PDF packet travels the Browser → Signed PDF track with 2 fading trail copies; "No server" dot pulses.
- **Scroll-reveal**: each section's content fades + slides up as it enters the viewport, staggered by `nth-child` inside `.reveal-stagger` containers.
- **Reduced-motion**: all animations freeze to their final visible state under `@media (prefers-reduced-motion: reduce)`.

## Status

Preview round. Domain, analytics, and GitHub star-count widget are deliberately deferred — the page works without them.
