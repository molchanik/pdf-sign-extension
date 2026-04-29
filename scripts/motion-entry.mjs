// Tree-shakeable entry stub for the self-hosted motion bundle.
// Bundler proof: only the symbols listed below are reachable, so esbuild
// drops the rest of the motion package (springs, timeline-internal, gesture
// helpers we don't call, etc.).
//
// To rebuild the bundle, run `node scripts/build-motion.mjs`. That script
// bundles this entry, computes a content hash, names the output
// `motion-<version>-<hash>.min.js`, and patches the import path in
// marketing/script.js so the HTML always references the latest content.
export { animate, scroll, inView, stagger, hover, press } from 'motion';
