# Landing hosting plan — Cloudflare Pages

Free-tier plan for hosting `marketing/landing/` and turning it into a
promotion funnel for the Chrome extension.

## Why Cloudflare Pages

| Host           | Free bandwidth    | Preview deploys | CDN         |
| -------------- | ----------------- | --------------- | ----------- |
| CF Pages       | unlimited         | yes             | best        |
| GitHub Pages   | 100 GB / month    | no              | average     |
| Netlify        | 100 GB / month    | yes             | fast        |
| Vercel         | 100 GB / month    | yes             | fast        |

The privacy policy stays on its current GitHub Pages URL
(`https://molchanik.github.io/pdf-sign-extension/privacy-policy.html`) —
no point moving it, the landing footer link already works.

## Deploy steps (no CLI, browser only)

1. Push pending commits to `origin/main`. CF Pages reads from GitHub.
2. Sign in at `https://dash.cloudflare.com/` (no credit card required).
3. **Workers & Pages → Create → Pages → Connect to Git**, pick the
   `molchanik/pdf-sign-extension` repo.
4. Build settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: leave empty
   - Build output directory: `marketing`
5. Save & Deploy. In ~30 s the site is live at
   `pdf-sign-extension.pages.dev` (or similar).
6. Make the root redirect to the landing by committing
   `marketing/_redirects`:
   ```
   /  /landing/  301
   ```
7. Optional custom domain (~$10/yr at cost — Cloudflare Registrar
   doesn't mark up): buy `pdfsign.app` or `signpdf.app`, then
   **Pages → Custom domains → Add**. DNS is wired automatically.

## Things to set up so the landing actually works

- **Cloudflare Web Analytics** — free, cookie-free, GDPR-safe. One
  click inside the Pages project. Tracks `Add to Chrome` clicks via
  the UTM params already present on the CTA links in `index.html`
  (`?utm_source=landing`, `landing_free`, `landing_pro`).
- **OG / Twitter meta tags** — currently missing. Add to `<head>`:
  `og:title`, `og:description`, `og:image` (1200×630 preview),
  `twitter:card="summary_large_image"`. Without them the link shows
  up as a bare URL in Reddit/Twitter/HN previews — kills CTR.
- **`robots.txt` + `sitemap.xml`** — place next to `_redirects`.
  Google typically indexes inside 1–2 weeks.
- **CWS Developer Dashboard → Website field** — swap the github.io
  URL for the new landing domain so it becomes the official homepage
  shown on the extension's store page.

## How the landing converts into installs

External channel → landing → CWS → install.

1. **Reddit / HN / Product Hunt drops** — links to the landing read
   as "a project", links straight to CWS read as ads. The two Reddit
   drafts already prepared in the 2026-04-18 session both use the
   landing URL + UTM.
2. **SEO** — the landing title/description already contain the
   primary keywords ("Sign PDFs in your browser", "nothing uploads").
   Google indexing gives a passive trickle within 2–4 weeks of the
   first crawl.
3. **Attribution** — CWS does not surface install source. Analytics
   on the landing is the only way to tell which external channel
   produced paying users.
4. **A/B testing** — CF Pages gives every PR a preview URL, so copy
   experiments can ship without touching production.

## Pre-flight checklist (one commit, ~10 min)

- [ ] `marketing/_redirects` with `/ /landing/ 301`
- [ ] OG + Twitter meta tags in `marketing/landing/index.html`
- [ ] `marketing/robots.txt` (`Allow: /` + sitemap URL)
- [ ] `marketing/sitemap.xml` (single entry for the landing)
- [ ] Push → verify CF Pages deploy
- [ ] Enable CF Web Analytics
- [ ] Update CWS Developer Dashboard "Website" field
