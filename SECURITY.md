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
- Bypass of the course-pack integrity check (SHA-256 pinning)
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
| Integrity | `Security.verifyPack()` — SHA-256 pinned on first load |
| Storage | `Security.validateStore()` — shape + prototype-key checks |
| Input guards | `Security.guardCommand()` / `Security.guardPython()` |

`'unsafe-eval'` is required by the Pyodide/WebAssembly runtime. Everything else is locked
down (`object-src 'none'`, `base-uri 'none'`, `form-action 'none'`).

### Data stored in the browser

Nothing leaves the device. All state is local:

| Key | Contents | Validation on read |
| --- | --- | --- |
| `labdeck.progress.v1` | Lesson completion booleans | Boolean coercion only |
| `labdeck.labs.v1` | Per-task lab state | Array of booleans |
| `labdeck.quiz.v1` | Best quiz scores | `0 ≤ best ≤ total`, integers |
| `labdeck.game.v1` | XP, streak, last day, daily completion, experience | Numeric range checks, ISO date regex, experience whitelist |
| `labdeck.pins.v1` | SHA-256 pack pins | Hex strings, compared on every load |
| `labdeck.code.<course>.<lesson>` | Python editor contents | Length cap (`MAX_CODE`) |

No cookies, no analytics, no third-party requests other than the pinned Pyodide CDN
(`cdn.jsdelivr.net`), which is restricted by CSP and cached by the service worker.

### Known limitation

Pack integrity uses **trust-on-first-use**: the hash is pinned on the first download, so a
pack tampered with *before* that first load is trusted. The sanitizer remains the control for
that case. See `SECURITY-ADVISORIES.md` for the published advisory.

## Hardening checklist for maintainers

- [ ] Enable **Dependabot alerts** and **secret scanning** (Settings → Code security)
- [ ] Enable **Private vulnerability reporting** (Settings → Code security)
- [ ] Protect `main`: require PR review, require status checks, block force-push
- [ ] Require signed commits if you publish releases
- [ ] Keep the Pyodide version pinned in `assets/pylab.js`
- [ ] Re-run the checks on `#/security` after any change to `assets/security.js`
