# LabDeck — Linux & Python courses with live labs, quizzes and projects

A static, dependency-free site: two complete courses, 12 live labs, 4 quizzes, 2 projects,
a first-run onboarding flow, a daily challenge, and a security layer that verifies itself in
the browser. No backend, no build step.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | App shell + CSP meta tag (hash router mounts views into `#app`) |
| `_headers` | CSP and security headers for Cloudflare static hosting |
| `manifest.webmanifest` | Installable PWA metadata |
| `sw.js` | Service worker: app shell + runtime caching |
| `SECURITY.md` | Disclosure policy and security model |
| `SECURITY-ADVISORIES.md` | Published and draft advisories |
| `assets/styles.css` | Dark theme, layout, terminal and lab styling |
| `assets/onboarding.css` | Onboarding screen, ticket banner, daily/next cards, streak badge |
| `assets/pack-hashes.js` | **Generated** — expected SHA-256 of each course pack |
| `assets/security.js` | Sanitizer, pack integrity, storage validation, input guards |
| `assets/catalog.js` | Courses, modules, lessons, labs, quizzes, projects, task checks |
| `assets/onboarding.js` | First-run flow, game state (XP/streak), tickets, daily challenge |
| `assets/app.js` | Router, progress store, integrity-checked pack loader, all views |
| `assets/terminal.js` | Virtual Linux filesystem + shell with pipes, redirection, script execution |
| `assets/pylab.js` | Live Python lab — real CPython via Pyodide (WebAssembly) |
| `data/packs/linux.json` | Linux lesson content (downloaded, verified, cached) |
| `data/packs/python.json` | Python lesson content (downloaded, verified, cached) |
| `scripts/hash-packs.mjs` | Regenerates `pack-hashes.js`; `--check` mode for CI |
| `.github/workflows/` | `security.yml` (CodeQL, secret scan, static checks) and `deploy.yml` |
| `wrangler.jsonc` | Workers static-assets config for deployment |

## Courses

Lesson kinds: `reading`, `lab` (live terminal or Python), `quiz` (multiple choice, graded in the browser).

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

**Live projects**
- *Server health check* (Linux) — write, chmod and run a real shell script
- *Expense tracker* (Python) — totals, averages, per-category sums, top category

## Engagement layer

| Feature | How it works |
| --- | --- |
| **First-run flow** (`#/start`) | Auto-typing terminal demo, then one question (*Never / A little / Every day*). The answer only changes the starting point. |
| **Ticket #001** (`#/mission/first`) | A 3-task lab (`ls`, `cat deploy.sh`, `chmod 755`) that closes the onboarding loop with a real fix. |
| **Ticket framing** | Every lab shows `TICKET #1004 — The deploy script will not run.` above the terminal. |
| **Next up card** | Home shows a single next lesson, computed from progress and experience level. |
| **Daily challenge** (`#/daily`) | One task per day, deterministic from `YYYY-MM-DD` (FNV hash), drawn from all quiz questions plus 5 terminal micro-tasks. No backend. |
| **XP and streak** | Header badge `🔥 3 · 420 XP · L2`. Streak advances on any completion; a missed day resets it to 1. |

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

## Storage

| Key / cache | Contents |
| --- | --- |
| `labdeck.progress.v1` | Lesson completion flags |
| `labdeck.labs.v1` | Per-task lab state |
| `labdeck.quiz.v1` | Best quiz scores (`{best, total}`) |
| `labdeck.game.v1` | XP, streak, last active day, daily completion, experience level |
| `labdeck.pins.v1` | Fallback pack pins (only used when no hash is shipped) |
| `labdeck.code.<course>.<lesson>` | Python editor contents |
| `labdeck-shell-v4` (Cache Storage) | App shell |
| `labdeck-runtime-v4` (Cache Storage) | Pyodide runtime from the pinned CDN |
| `labdeck-packs-v1` (Cache Storage) | Course packs |

Every `localStorage` payload is shape-validated on read and stripped of prototype-polluting
keys. Course packs are hashed with SHA-256 and compared against the hashes shipped in
`assets/pack-hashes.js`; a mismatch refuses to render.

### Regenerating pack hashes

Run this after **any** edit to `data/packs/`:

```bash
node scripts/hash-packs.mjs          # rewrite assets/pack-hashes.js
node scripts/hash-packs.mjs --check  # exit 1 if the file is stale (used in CI)
