// Canonicalizes the legacy pages.dev origin to the apex.
// Runs ONLY when the request hostname is the old origin; otherwise passes
// through to static-file serving + _redirects.
//
// Single-source-of-truth: this only swaps hostname. Path normalization
// (e.g. /landing/foo -> /foo) lives in marketing/_redirects and runs after
// the redirect is followed by the browser. Two redirects on legacy paths
// is acceptable; SEO penalty for short chains is negligible.
export const onRequest = async ({ request, next }) => {
  const url = new URL(request.url);
  if (url.hostname === 'pdf-sign-extension.pages.dev') {
    return Response.redirect(
      `https://safepdfsign.com${url.pathname}${url.search}`,
      301,
    );
  }
  return next();
};
