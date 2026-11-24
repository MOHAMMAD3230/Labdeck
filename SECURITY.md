# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | ✅        |
| older tags | ❌    |

This is a static site with no backend. There is no server to patch — the
security surface is the browser code in `assets/` and the content in `data/packs/`.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

- Email: **security@example.com**  ← replace with your address
- Or use GitHub → *Security* → *Report a vulnerability* (private advisory)

Please include: affected file(s), a description, reproduction steps, and the
browser/OS you used. Expect an acknowledgement within 72 hours.

## Scope

In scope:
- Cross-site scripting via lesson content or lab input
- Bypass of the HTML sanitizer (`assets/security.js`)
- Bypass of the course-pack integrity check (SHA-256 pinning)
- Escaping the terminal or Python sandbox into the page context
- Prototype pollution through `localStorage` payloads

Out of scope:
- The lab sandbox being able to run arbitrary *Python* — that is by design
  (Pyodide is WebAssembly; it cannot touch the host filesystem)
- Denial of service by pasting an infinite loop into the Python editor
- Missing security headers on a deployment you control (see `_headers`)
- Vulnerabilities in third-party CDNs other than the pinned Pyodide version

## Security model

| Control | Implementation |
| --- | --- |
| CSP | `index.html` meta tag + `_headers` |
| Sanitizer | `Security.sanitizeHTML()` — tag whitelist, no event handlers |
| Integrity | `Security.verifyPack()` — SHA-256 pinned on first load |
| Storage | `Security.validateStore()` — shape + prototype-key checks |
| Input guards | `Security.guardCommand()` / `Security.guardPython()` |

`'unsafe-eval'` is required by the Pyodide/WebAssembly runtime. Everything else
is locked down (`object-src 'none'`, `base-uri 'none'`, `form-action 'none'`).

## Hardening checklist for maintainers

- [ ] Enable **Dependabot alerts** and **secret scanning** (Settings → Code security)
- [ ] Enable **Private vulnerability reporting** (Settings → Code security)
- [ ] Protect `main`: require PR review, require status checks, block force-push
- [ ] Require signed commits if you publish releases
- [ ] Keep the Pyodide version pinned in `assets/pylab.js`
