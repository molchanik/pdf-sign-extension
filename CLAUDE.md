# PDF Sign — Chrome Extension

## Session Log

The file `docs/session-2026-04-13.md` is the **project decision log**. It records all architectural decisions, changes, fixes, rejected approaches, and context that is not derivable from code or git history alone.

### Rules

1. **Read before working.** At the start of every session, read `docs/session-2026-04-13.md` to understand project context, prior decisions, and outstanding issues.
2. **Write after changing.** After making any meaningful change (feature, fix, refactor, config change), append a summary to the appropriate section of the log. Include: what changed, why, and any decisions made.
3. **Never delete.** Do not delete, truncate, or overwrite the log file. Only append or update sections.
4. **Local only.** The `docs/` directory is in `.gitignore`. Do not commit it, do not remove it from `.gitignore`, do not suggest tracking it in git.
5. **Restore if missing.** If the file does not exist, recover it from git history (`git show 57bbbef^:docs/session-2026-04-13.md > docs/session-2026-04-13.md`) and inform the user.

### Log structure

- **Session header** with date
- **What was done** — grouped by area (Auth, UX, Payments, etc.)
- **What's NOT done / needs attention** — outstanding issues, risks, deferred work
- **Key URLs & IDs** — external service references
- **Git commits** — list of commits per session with hashes and descriptions

## Tech Stack

- Framework: Plasmo v0.89.5 (Chrome Extension, Manifest V3)
- UI: React 18, TypeScript, Tailwind CSS
- PDF: pdfjs-dist (read), pdf-lib + fontkit (write)
- Auth: Supabase (Google OAuth via chrome.identity)
- Payments: ExtensionPay (Stripe)
- Tests: Vitest + tsc --noEmit (typecheck runs before tests)
- Package manager: npm
