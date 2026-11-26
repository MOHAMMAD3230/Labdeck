/* LabDeck security layer.
 *
 * 1. HTML sanitizer   — whitelist-based; every piece of course content is passed
 *                       through it before it reaches the DOM (no raw innerHTML).
 * 2. Integrity check  — SHA-256 of each course pack is compared against the hashes
 *                       shipped in assets/pack-hashes.js. A mismatch refuses to load.
 *                       Falls back to trust-on-first-use only when no hash is shipped.
 * 3. Storage guard    — localStorage payloads are shape-validated and stripped of
 *                       prototype-polluting keys before use.
 * 4. Input guards     — length/character limits for shell input and Python code,
 *                       plus a blocklist for runtime-escape attempts.
 */
(function () {
  'use strict';

  /* ---------------- 1. sanitizer ---------------- */
  const ALLOWED = new Set([
    'H2', 'H3', 'H4', 'P', 'UL', 'OL', 'LI', 'PRE', 'CODE', 'STRONG', 'EM', 'B', 'I',
    'BLOCKQUOTE', 'KBD', 'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'A', 'SPAN', 'DIV'
  ]);
  const DROP = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT',
    'BUTTON', 'SVG', 'MATH', 'BASE', 'TEMPLATE', 'NOSCRIPT'
  ]);

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function cleanNode(node, parent) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { // text
        parent.appendChild(document.createTextNode(child.nodeValue));
        continue;
      }
      if (child.nodeType !== 1) continue; // comments, PIs: dropped
      const tag = child.tagName;
      if (DROP.has(tag)) continue;
      if (!ALLOWED.has(tag)) { cleanNode(child, parent); continue; } // unwrap unknown tags

      const el = document.createElement(tag.toLowerCase());
      
       if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        const safe = /^https?:\/\//i.test(href) || /^#\//.test(href) || /^\.{0,2}\//.test(href);
        if (safe) {
          el.setAttribute('href', href);
          if (/^https?:/i.test(href)) {
            el.setAttribute('rel', 'noopener noreferrer');
            el.setAttribute('target', '_blank');
          }
        }
      }
      if (tag === 'CODE') {
        const cls = child.getAttribute('class');
        if (cls && /^[A-Za-z0-9 _-]{1,40}$/.test(cls)) el.setAttribute('class', cls);
      }
      cleanNode(child, el);
      parent.appendChild(el);
    }
  }

  function sanitizeHTML(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html');
    const out = document.createElement('div');
    cleanNode(doc.body, out);
    return out.innerHTML;
  }

  /* ---------------- 2. integrity ---------------- */
  const PINS_KEY = 'labdeck.pins.v1';

  async function sha256Hex(text) {
    if (!(window.crypto && crypto.subtle && crypto.subtle.digest)) return null;
    try {
      const data = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return null; }
  }

  function shippedHashes() {
    const table = window.PACK_HASHES || {};
    const out = {};
    for (const id of Object.keys(table)) {
      if (/^[a-f0-9]{64}$/.test(table[id])) out[id] = table[id];
    }
    return out;
  }

  function readPins() {
    try { return JSON.parse(localStorage.getItem(PINS_KEY)) || {}; } catch (e) { return {}; }
  }
  function writePins(pins) {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch (e) { /* ignore */ }
  }

  /** The hash the app currently trusts for a course: shipped first, then pinned. */
  function expectedHash(courseId) {
    const shipped = shippedHashes();
    if (shipped[courseId]) return shipped[courseId];
    const pins = readPins();
    return /^[a-f0-9]{64}$/.test(pins[courseId] || '') ? pins[courseId] : null;
  }

  /** 'shipped' when the app shell carries the expected hash, 'tofu' otherwise. */
  function integrityMode(courseId) {
    const shipped = shippedHashes();
    if (courseId) return shipped[courseId] ? 'shipped' : 'tofu';
    return Object.keys(shipped).length ? 'shipped' : 'tofu';
  }

  /**
   * Verifies a downloaded pack.
   * - shipped hash present  -> must match exactly, otherwise 'mismatch'
   * - no shipped hash       -> trust-on-first-use pin (legacy behaviour)
   */
  async function verifyPack(courseId, text) {
    const hash = await sha256Hex(text);
    if (!hash) return { status: 'unavailable', hash: null };

    const shipped = shippedHashes()[courseId];
    if (shipped) {
      if (shipped !== hash) return { status: 'mismatch', hash, expected: shipped, mode: 'shipped' };
      return { status: 'verified', hash, expected: shipped, mode: 'shipped' };
    }

    const pins = readPins();
    if (!pins[courseId]) {
      pins[courseId] = hash;
      writePins(pins);
      return { status: 'pinned', hash, mode: 'tofu' };
    }
    if (pins[courseId] !== hash) return { status: 'mismatch', hash, expected: pins[courseId], mode: 'tofu' };
    return { status: 'verified', hash, expected: pins[courseId], mode: 'tofu' };
  }

  /** Effective trusted hashes, for display on the security page. */
  function getPins() {
    const out = Object.assign({}, shippedHashes());
    const pins = readPins();
    for (const id of Object.keys(pins)) {
      if (!out[id] && /^[a-f0-9]{64}$/.test(pins[id] || '')) out[id] = pins[id];
    }
    return out;
  }

  function clearPins() { try { localStorage.removeItem(PINS_KEY); } catch (e) { /* ignore */ } }

  /* ---------------- 3. storage validation ---------------- */
  const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function validateStore(raw) {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return {}; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const key of Object.keys(parsed)) {
      if (UNSAFE_KEYS.has(key) || key.length > 120) continue;
      const value = parsed[key];
      if (typeof value === 'boolean') clean[key] = value;
      else if (value && typeof value === 'object' && Array.isArray(value.tasks)) {
        clean[key] = { tasks: value.tasks.map(v => v === true) };
      } else if (value && typeof value === 'object' &&
                 Number.isFinite(value.best) && Number.isFinite(value.total) &&
                 value.best >= 0 && value.total > 0 && value.best <= value.total) {
        clean[key] = { best: value.best, total: value.total };
      }
    }
    return clean;
  }

  /* ---------------- 4. input guards ---------------- */
  const MAX_COMMAND = 512;
  const MAX_CODE = 20000;

  function guardCommand(line) {
    const raw = String(line == null ? '' : line);
    if (raw.length > MAX_COMMAND) return { ok: false, reason: `Command too long (max ${MAX_COMMAND} characters).` };
    const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (cleaned !== raw) return { ok: false, reason: 'Command contains control characters.' };
    return { ok: true, line: cleaned };
  }

  const PY_BLOCKLIST = [
    { re: /\bfrom\s+js\s+import\b/, why: 'access to the JavaScript runtime is disabled in this lab' },
    { re: /\bimport\s+js\b/, why: 'access to the JavaScript runtime is disabled in this lab' },
    { re: /\bimport\s+pyodide\b/, why: 'access to the Pyodide internals is disabled in this lab' },
    { re: /\bpyodide_js\b/, why: 'access to the Pyodide internals is disabled in this lab' },
    { re: /\bimport\s+(subprocess|socket|ctypes|multiprocessing)\b/, why: 'this module is not available in the sandbox' },
    { re: /\bos\.system\s*\(/, why: 'os.system is disabled in the sandbox' }
  ];

  function guardPython(code) {
    const src = String(code == null ? '' : code);
    if (src.length > MAX_CODE) return { ok: false, reason: `Code too long (max ${MAX_CODE} characters).` };
    for (const rule of PY_BLOCKLIST) {
      if (rule.re.test(src)) return { ok: false, reason: 'Blocked: ' + rule.why + '.' };
    }
    return { ok: true };
  }

  /* ---------------- self-test (used by the Security page) ---------------- */
  function selfTest() {
    const results = [];
    const probe = sanitizeHTML('<img src=x onerror="alert(1)"><script>alert(2)</script><b onclick="x()">ok</b><a href="javascript:alert(3)">bad</a>');
    results.push({
      name: 'HTML sanitizer strips script, event handlers and javascript: URLs',
      pass: !/script|onerror|onclick|javascript:/i.test(probe) && /<b>ok<\/b>/.test(probe),
      detail: probe
    });
    results.push({
      name: 'Shell input guard rejects oversized commands',
      pass: guardCommand('a'.repeat(600)).ok === false,
      detail: `limit ${MAX_COMMAND} chars`
    });
    results.push({
      name: 'Python guard blocks runtime escape (import js)',
      pass: guardPython('from js import fetch').ok === false,
      detail: 'blocklist active'
    });

    const storeProbe = validateStore('{"__proto__":{"x":1},"a":true}');
    results.push({
      name: 'Storage guard drops prototype-polluting keys',
      pass: !Object.prototype.hasOwnProperty.call(storeProbe, '__proto__') && storeProbe.a === true,
      detail: 'validated on read'
    });
    
    const shipped = shippedHashes();
    results.push({
      name: 'Expected pack hashes shipped in the app shell',
      pass: Object.keys(shipped).length > 0,
      detail: Object.keys(shipped).length
        ? Object.keys(shipped).join(', ')
        : 'none — run node scripts/hash-packs.mjs (falling back to trust-on-first-use)'
    });
    return results;
  }

  window.Security = {
    sanitizeHTML,
    escapeHTML,
    sha256Hex,
    verifyPack,
    expectedHash,
    integrityMode,
    getPins,
    clearPins,
    validateStore,
    guardCommand,
    guardPython,
    selfTest,
    MAX_COMMAND,
    MAX_CODE
  };
})();
