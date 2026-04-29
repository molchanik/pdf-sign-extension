// Tree-shakeable entry stub for the self-hosted motion bundle.
// Bundler proof: only the symbols listed below are reachable, so esbuild
// drops the rest of the motion package (springs, timeline-internal, gesture
// helpers we don't call, etc.).
//
// To rebuild the bundle, run:
//   npx esbuild scripts/motion-entry.mjs \
//     --bundle --minify --format=esm --legal-comments=none \
//     --outfile=marketing/assets/vendor/motion-12.38.0.min.js
//
// The output filename keeps the version pin so HTML cache busting still
// works after a motion upgrade — bump the number when you upgrade the dep.
export { animate, scroll, inView, stagger, hover, press } from 'motion';
