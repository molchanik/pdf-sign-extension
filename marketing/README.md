# CWS Screenshots

Automated 1280×800 screenshots for the Chrome Web Store listing. Rendered via headless Chrome from HTML/CSS templates.

## Files

- `templates/` — one HTML per screenshot, uses shared `styles.css`
- `assets/` — product screenshots (copied from project root) and icon
- `output/` — generated PNGs, 1280×800, compliant with CWS listing specs
- `render.sh` — renders all templates via headless Chrome

## Regenerate

```bash
bash render.sh
```

Requires Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.

Fonts (Inter) are loaded from Google Fonts at render time — needs internet.

## Upload to CWS

Chrome Developer Dashboard → PDF Sign → Store listing → Screenshots.
Upload `output/*.png` in order (01 → 05).

## Tuning

- Change headline text, colors, layout: edit `templates/*.html` and `styles.css`
- Higher resolution (retina): add `--force-device-scale-factor=2` to `render.sh` — gives 2560×1600 output, but CWS requires exactly 1280×800 or 640×400, so downscale before uploading (ImageMagick `magick input.png -resize 1280x800 output.png`)
- Different product shots: replace files in `assets/` matching the filename

## Per-screenshot

| File                | Template         | Product shot(s) used                                                     |
| ------------------- | ---------------- | ------------------------------------------------------------------------ |
| 01-hero.png         | 01-hero.html     | `product-signed.png`                                                     |
| 02-signature.png    | 02-signature.html| `product-signature.png`                                                  |
| 03-text.png         | 03-text.html     | `product-text-edit.png`                                                  |
| 04-privacy.png      | 04-privacy.html  | `product-signature-thick.png` (shows real "Processing locally" UI pill)  |
| 05-usecases.png     | 05-usecases.html | `product-dropzone.png` + `product-form-filled.png` + `product-downloaded.png` (3-step flow) |
