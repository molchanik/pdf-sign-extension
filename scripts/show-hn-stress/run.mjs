// Phase-1c stress runner: replay the SafePDFSign editor's three PDF
// load paths against each fixture and report what the user would see.
//
// The three paths (mirroring src/components/FileDropzone.tsx,
// src/lib/pdf-renderer.ts, src/lib/pdf-signer.ts):
//
//   1. UPLOAD     PDFDocument.load(bytes, { ignoreEncryption: true })
//   2. RENDER     pdfjs.getDocument({ data, isEvalSupported: false })
//   3. SIGN       PDFDocument.load(bytes)  // no ignoreEncryption
//                 + embedFont + drawText/drawImage + save()
//
// Plus two cross-cutting cases:
//
//   4. NON-LATIN  signPdf-equivalent path with Arabic / CJK / Cyrillic text
//                 against Helvetica (WinAnsi) and Roboto (TTF)
//   5. RE-SIGN    sign the output of an earlier sign — does pdf-lib roundtrip?
//
// Run with:
//   node scripts/show-hn-stress/run.mjs
//
// The runner is read-only on the fixtures; it writes nothing back to disk.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.join(__dirname, 'corpus');
const robotoPath = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'fonts',
  'Roboto-Regular.ttf',
);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // FileDropzone limit

function summariseError(e) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 140 ? msg.slice(0, 137) + '...' : msg;
}

async function tryUpload(bytes) {
  // Mirror FileDropzone: enforce size limit, then load with ignoreEncryption.
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `rejected at FileDropzone (>${MAX_UPLOAD_BYTES / 1e6} MB)` };
  }
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return { ok: true, pageCount: doc.getPageCount() };
  } catch (e) {
    return { ok: false, reason: summariseError(e) };
  }
}

async function tryRender(bytes) {
  // Mirror PDFRenderer: load with pdfjs, fetch first page viewport.
  try {
    const data = new Uint8Array(bytes);
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    await doc.cleanup();
    return { ok: true, numPages: doc.numPages, firstPageSize: `${Math.round(vp.width)}x${Math.round(vp.height)}` };
  } catch (e) {
    return { ok: false, reason: summariseError(e) };
  }
}

async function trySign(bytes, options = {}) {
  // Mirror pdf-signer.signPdf: load WITHOUT ignoreEncryption, embed a font,
  // drop a tiny text overlay on page 1, save.
  try {
    const doc = await PDFDocument.load(bytes);
    doc.registerFontkit(fontkit);
    const font = options.useRoboto
      ? await doc.embedFont(readFileSync(robotoPath))
      : await doc.embedFont(StandardFonts.Helvetica);
    const text = options.text ?? 'stress';
    const pages = doc.getPages();
    if (pages.length === 0) return { ok: false, reason: 'PDF has zero pages' };
    pages[0].drawText(text, { x: 50, y: 50, size: 12, font, color: rgb(0, 0, 0) });
    const out = await doc.save();
    return { ok: true, outputBytes: out.length };
  } catch (e) {
    return { ok: false, reason: summariseError(e) };
  }
}

function fmtRow(label, result) {
  const status = result.ok ? 'ok' : 'fail';
  const detail = result.ok
    ? Object.entries(result)
        .filter(([k]) => k !== 'ok')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : result.reason;
  return `    ${label.padEnd(8)} ${status.padEnd(5)} ${detail}`;
}

async function runFixture(name, bytes) {
  console.log(`\n${name}  (${bytes.length.toLocaleString()} bytes)`);
  const upload = await tryUpload(bytes);
  console.log(fmtRow('UPLOAD', upload));
  if (!upload.ok) return;
  const render = await tryRender(bytes);
  console.log(fmtRow('RENDER', render));
  const sign = await trySign(bytes);
  console.log(fmtRow('SIGN', sign));
}

async function runNonLatinTests() {
  // Use the simplest fixture as carrier — we are testing fonts, not the carrier.
  const carrier = readFileSync(path.join(corpusDir, 'image-only-scan.pdf'));
  const cases = [
    { label: 'Latin/cyrillic via Helvetica', text: 'Привет', useRoboto: false },
    { label: 'Latin/cyrillic via Roboto',    text: 'Привет', useRoboto: true },
    { label: 'Arabic via Helvetica',         text: 'السلام',  useRoboto: false },
    { label: 'Arabic via Roboto',            text: 'السلام',  useRoboto: true },
    { label: 'CJK via Helvetica',            text: '你好',    useRoboto: false },
    { label: 'CJK via Roboto',               text: '你好',    useRoboto: true },
  ];
  console.log('\nNON-LATIN script handling (text overlay on first page)');
  // Glyph coverage check: if the font is missing a script, fontkit returns
  // glyph id 0 (.notdef) — pdf-lib doesn't error, but the output PDF shows
  // empty boxes instead of letters. We must flag that explicitly so the
  // "Roboto handles Arabic" answer doesn't quietly mean "saves a broken PDF".
  const robotoFont = fontkit.create(readFileSync(robotoPath));
  for (const c of cases) {
    const r = await trySign(carrier, { text: c.text, useRoboto: c.useRoboto });
    let coverageNote = '';
    if (c.useRoboto && r.ok) {
      const run = robotoFont.layout(c.text);
      const missing = run.glyphs.filter((g) => g.id === 0).length;
      if (missing > 0) {
        coverageNote = ` ⚠ ${missing}/${run.glyphs.length} glyphs missing — output will render as empty boxes`;
      }
    }
    const status = r.ok && !coverageNote ? 'ok' : r.ok ? 'ok-but-broken' : 'fail';
    console.log(`    ${c.label.padEnd(34)} ${status.padEnd(13)} ${r.ok ? `out=${r.outputBytes}b` : r.reason}${coverageNote}`);
  }
}

async function runReSignTest() {
  // Sign once with Helvetica; sign the output of pass 1 again — this is
  // what the user does when they re-open a previously-signed download to
  // add another signature.
  const base = readFileSync(path.join(corpusDir, 'already-overlaid.pdf'));
  console.log('\nRE-SIGN — sign output of an earlier sign');
  const first = await (async () => {
    const d = await PDFDocument.load(base);
    d.registerFontkit(fontkit);
    const f = await d.embedFont(StandardFonts.Helvetica);
    d.getPages()[0].drawText('first sign', { x: 50, y: 50, size: 12, font: f });
    return { ok: true, bytes: await d.save() };
  })().catch((e) => ({ ok: false, reason: summariseError(e) }));
  console.log(fmtRow('first', first.ok ? { ok: true, outputBytes: first.bytes.length } : first));
  if (!first.ok) return;
  const second = await trySign(first.bytes, { text: 'second sign' });
  console.log(fmtRow('second', second));
}

async function main() {
  if (!statSync(corpusDir, { throwIfNoEntry: false })) {
    console.error('Corpus dir missing. Run: python scripts/show-hn-stress/generate.py');
    process.exit(1);
  }

  // Silence pdfjs's own console.warn / console.error noise during the runs.
  const origWarn = console.warn;
  const origErr = console.error;
  console.warn = () => {};
  console.error = () => {};

  const fixtures = readdirSync(corpusDir)
    .filter((f) => f.endsWith('.pdf'))
    .sort();

  console.log(`Stress-running ${fixtures.length} fixtures from ${corpusDir}\n`);
  console.log('Format:  UPLOAD = pdf-lib load with ignoreEncryption');
  console.log('         RENDER = pdfjs-dist getDocument + first-page viewport');
  console.log('         SIGN   = pdf-lib load + drawText + save');

  for (const name of fixtures) {
    const bytes = readFileSync(path.join(corpusDir, name));
    await runFixture(name, bytes);
  }

  await runNonLatinTests();
  await runReSignTest();

  console.warn = origWarn;
  console.error = origErr;
}

main().catch((e) => {
  console.error('Runner crashed:', e);
  process.exit(1);
});
