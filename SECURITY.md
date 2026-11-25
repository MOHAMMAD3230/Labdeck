# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | ✅        |
| older tags | ❌    |

This is a static site with no backend. There is no server to patch — the security surface is
the browser code in `assets/` and the content in `data/packs/`.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

- Email: **mohammadashrafali96@gmail.com**  ← replace with your address
- Or use GitHub → *Security* → *Report a vulnerability* (private advisory)

Please include: affected file(s), a description, reproduction steps, and the browser/OS you
used. Expect an acknowledgement within 72 hours.

## Scope

In scope:

- Cross-site scripting via lesson content, quiz text or lab input
- Bypass of the HTML sanitizer (`assets/security.js`)
- Bypass of the course-pack integrity check (SHA-256 verification)
- Escaping the terminal or Python sandbox into the page context
- Prototype pollution through `localStorage` payloads
- Tampering with XP, streak or quiz scores through `localStorage`

Out of scope:

- The lab sandbox being able to run arbitrary *Python* — that is by design (Pyodide is
  WebAssembly; it cannot touch the host filesystem)
- Denial of service by pasting an infinite loop into the Python editor
- A user editing their own `localStorage` to give themselves XP — there is no server-side
  scoreboard, so there is nothing to cheat against
- Missing security headers on a deployment you control (see `_headers`)
- Vulnerabilities in third-party CDNs other than the pinned Pyodide version

## Security model

| Control | Implementation |
| --- | --- |
| CSP | `index.html` meta tag + `_headers` |
| Sanitizer | `Security.sanitizeHTML()` — tag whitelist, no event handlers |
| Integrity | `Security.verifyPack()` — SHA-256 compared against `assets/pack-hashes.js` |
| Storage | `Security.validateStore()` — shape + prototype-key checks |
| Input guards | `Security.guardCommand()` / `Security.guardPython()` |

`'unsafe-eval'` is required by the Pyodide/WebAssembly runtime. Everything else is locked
down (`object-src 'none'`, `base-uri 'none'`, `form-action 'none'`).

### Pack integrity

The expected SHA-256 of every course pack is generated at build time by
`scripts/hash-packs.mjs` and shipped in `assets/pack-hashes.js`, inside the app shell. A
downloaded or cached pack is hashed and compared before it is rendered; a mismatch aborts the
load and the lesson body is never injected.

Trust-on-first-use remains only as a fallback for a course with no shipped hash. The
`#/security` page reports that state as a failing self-test, so it cannot go unnoticed.

**After editing anything in `data/packs/`, regenerate the hashes:**
