# LabDeck — Linux, Python, SQL & networking courses with live labs

A static, dependency-free site: four courses, live labs that run in the browser, quizzes,
projects, a first-run onboarding flow, a daily challenge, and a security layer that verifies
itself. No backend, no build step.

## About

LabDeck is a self-contained learning platform for people who want to *use* a terminal, not
watch someone else use one. Every lab runs client-side: a virtual Linux filesystem, CPython
compiled to WebAssembly, an in-memory SQL engine and a simulated network stack. There is no
server, no account and no tracking — progress lives in your browser and the course content is
cached for offline use.

- **Live site:** https://mohammad3230.github.io/Labdeck/
- **Courses:** Linux Essentials · Python Foundations · SQL · Networking
- **Labs:** interactive, graded against real state rather than multiple choice
- **Offline:** service worker + Cache Storage
- **Security:** CSP, HTML sanitizer, SHA-256 pack integrity — see [SECURITY.md](SECURITY.md)

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | App shell + CSP meta tag (hash router mounts views into `#app`) |
| `_headers` | CSP and security headers (honoured by Cloudflare, ignored by GitHub Pages) |
| `manifest.webmanifest` | Installable PWA metadata |
| `sw.js` | Service worker: app shell + runtime caching |
| `LICENSE` | MIT |
| `SECURITY.md` | Disclosure policy and security model |
| `SECURITY-ADVISORIES.md` | Published and draft advisories |
| `assets/styles.css` | Dark theme, layout, terminal and lab styling |
| `assets/onboarding.css` | Onboarding screen, ticket banner, daily/next cards, streak badge |
| `assets/feedback.css` | Feedback form styling |
| `assets/security.js` | Sanitizer, pack integrity, storage validation, input guards |
| `assets/pack-hashes.js` | **Generated** — expected SHA-256 of each course pack |
| `assets/catalog.js` | Core courses, modules, lessons, labs, quizzes, projects |
| `assets/extensions.js` | Merges courses registered by `assets/courses/*.js` |
| `assets/courses/sql.js` | SQL course definition |
| `assets/courses/networking.js` | Networking course definition |
| `assets/labs/console.js` | Shared console UI for the SQL and networking labs |
| `assets/labs/sql.js` | In-memory SQL engine (SELECT/INSERT/UPDATE/DELETE, aggregates) |
| `assets/labs/net.js` | Simulated network stack (ping, dig, curl, ss, traceroute) |
| `assets/onboarding.js` | First-run flow, game state (XP/streak), tickets, daily challenge |
| `assets/feedback.js` | Feedback forms → Web3Forms → email, with hCaptcha |
| `assets/app.js` | Router, progress store, integrity-checked pack loader, all views |
| `assets/terminal.js` | Virtual Linux filesystem + shell with pipes, redirection, script execution |
| `assets/pylab.js` | Live Python lab — real CPython via Pyodide (WebAssembly) |
| `data/packs/*.json` | Lesson content per course (downloaded, verified, cached) |
| `scripts/hash-packs.mjs` | Regenerates `pack-hashes.js`; `--check` mode for CI |
| `.gitleaks.toml` | Allows the two public client-side keys, keeps everything else scanned |
| `.github/workflows/` | `security.yml` (CodeQL, secret scan, static checks) |

## Courses

Lesson kinds: `reading`, `lab` (terminal, Python, SQL or network console), `quiz`.

**Linux Essentials** — 6 modules, 15 lessons, 6 labs, 2 quizzes
1. Getting started — *Lab: your first commands*
2. Files and paths — *Lab: build a project tree*
3. Text and pipelines — *Lab: search the logs* · *Quiz: modules 1–3 recap*
4. Users and permissions — *Lab: fix the permissions*
5. Processes and packages — *Lab: inspect and stop a process*
6. Scripting and networking — *Lab: write a backup script* · *Final assessment*

**Python Foundations** — 6 modules, 15 lessons, 6 labs, 2 quizzes
1. Python basics — *Lab: variables and printing*
2. Control flow — *Lab: FizzBuzz*
3. Functions — *Lab: write a function* · *Quiz: modules 1–3 recap*
4. Data structures — *Lab: word counter*
5. Files and errors — *Lab: parse a log file*
6. Classes and testing — *Lab: build a class* · *Final assessment*

**SQL** — 3 modules, 7 lessons, 3 labs
Querying, aggregates, and changing data — against a real in-memory engine.

**Networking** — 3 modules, 7 lessons, 3 labs
IPs and ports, DNS, HTTP, and diagnosing a broken service.

**Live projects**
- *Server health check* (Linux) — write, chmod and run a real shell script
- *Expense tracker* (Python) — totals, averages, per-category sums, top category

## Engagement layer

| Feature | How it works |
| --- | --- |
| **First-run flow** (`#/start`) | Auto-typing terminal demo, then one question (*Never / A little / Every day*). |
| **Ticket #001** (`#/mission/first`) | A 3-task lab that closes the onboarding loop with a real fix. |
| **Ticket framing** | Every lab shows `TICKET #1004 — The deploy script will not run.` above the console. |
| **Next up card** | Home shows a single next lesson, computed from progress and experience level. |
| **Daily challenge** (`#/daily`) | One task per day, deterministic from `YYYY-MM-DD`, drawn from the course content. |
| **XP and streak** | Header badge `🔥 3 · 420 XP · L2`. A missed day resets the streak to 1. |

### XP

| Event | XP |
| --- | --- |
| Lab task checked | +10 |
| Lesson marked complete | +15 |
| Lab fully complete | +25 |
| Quiz passed | +50 |
| First mission closed | +40 |
| Daily challenge | +30 correct / +10 otherwise |

Level = `floor(XP / 250) + 1`.

## Feedback

Course and lesson pages carry a feedback form (rating, what worked, what was confusing,
optional email). Submissions are written to `localStorage` first, then POSTed to Web3Forms,
which emails the owner. hCaptcha gates the endpoint; a honeypot field catches naive bots.

Both keys in `assets/feedback.js` are **public by design**:

- `ACCESS_KEY` — Web3Forms access key (identifies the form, cannot read submissions)
- `HCAPTCHA_SITEKEY` — hCaptcha site key (rendered into the page anyway)

The hCaptcha **secret** key never appears in this repository — it lives in the Web3Forms
dashboard, where the token is validated server-side. Restrict *Allowed Domains* to your site
so the public access key cannot be reused elsewhere.

## Storage

| Key / cache | Contents |
| --- | --- |
| `labdeck.progress.v1` | Lesson completion flags |
| `labdeck.labs.v1` | Per-task lab state |
| `labdeck.quiz.v1` | Best quiz scores |
| `labdeck.game.v1` | XP, streak, last active day, daily completion, experience level |
| `labdeck.feedback.v1` | Feedback submissions and their send status |
| `labdeck.pins.v1` | Fallback pack pins (only when no hash is shipped) |
| `labdeck.code.<course>.<lesson>` | Python editor contents |
| `labdeck-shell-v*` (Cache Storage) | App shell |
| `labdeck-runtime-v*` (Cache Storage) | Pyodide runtime from the pinned CDN |
| `labdeck-packs-v1` (Cache Storage) | Course packs |

Every `localStorage` payload is shape-validated on read and stripped of prototype-polluting
keys. Course packs are hashed with SHA-256 and compared against `assets/pack-hashes.js`; a
mismatch refuses to render.

### Regenerating pack hashes

Run this after **any** edit to `data/packs/`:

```bash
node scripts/hash-packs.mjs          # rewrite assets/pack-hashes.js
node scripts/hash-packs.mjs --check  # exit 1 if the file is stale (used in CI)
