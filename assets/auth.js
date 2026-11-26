/* LabDeck — local accounts.
 *
 * Signup / signin with PBKDF2-hashed passwords stored in localStorage.
 * Each account gets its own progress namespace. On sign-in the app's existing
 * keys are swapped for that account's copy, so no other file needs to change.
 *
 * This is a local profile, NOT a security boundary: the course content is made
 * of public files, and anyone with access to this browser can read this storage.
 */
(function () {
  'use strict';
  const S = window.Security;

  const LS_ACCOUNTS = 'labdeck.accounts.v1';
  const LS_SESSION = 'labdeck.session.v1';
  const ITERATIONS = 150000;

  /* Keys that belong to a person rather than to the browser. */
  const TRACKED = [
    'labdeck.progress.v1',
    'labdeck.labs.v1',
    'labdeck.quiz.v1',
    'labdeck.game.v1',
    'labdeck.feedback.v1'
  ];

  /* ---------------- storage ---------------- */
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v && typeof v === 'object' ? v : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
  }

  const readAccounts = () => readJSON(LS_ACCOUNTS, {});
  const writeAccounts = a => writeJSON(LS_ACCOUNTS, a);
  const readSession = () => {
    const s = readJSON(LS_SESSION, null);
    return s && typeof s.id === 'string' && s.id ? s : null;
  };
  const writeSession = s => writeJSON(LS_SESSION, s);
  const clearSession = () => { try { localStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ } };

  /* ---------------- crypto ---------------- */
  const toHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  function fromHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function cryptoReady() {
    return !!(window.crypto && crypto.subtle && crypto.subtle.importKey);
  }

  async function derive(password, saltHex) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: fromHex(saltHex), iterations: ITERATIONS, hash: 'SHA-256' },
      material, 256
    );
    return toHex(new Uint8Array(bits));
  }

  function newSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
  }

  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------- per-account namespace ---------------- */
  const acctKey = (id, key) => 'labdeck.acct.' + id + '.' + key;

  function activate(id) {
    for (const key of TRACKED) {
      const stored = localStorage.getItem(acctKey(id, key));
      if (stored !== null) localStorage.setItem(key, stored);
      else localStorage.removeItem(key);
    }
  }

  function deactivate(id) {
    if (!id) return;
    for (const key of TRACKED) {
      const live = localStorage.getItem(key);
      if (live !== null) localStorage.setItem(acctKey(id, key), live);
      else localStorage.removeItem(acctKey(id, key));
    }
  }

  /** Copy whatever is currently live into an account (used on first signup). */
  function snapshotTo(id) {
    for (const key of TRACKED) {
      const live = localStorage.getItem(key);
      if (live !== null) localStorage.setItem(acctKey(id, key), live);
    }
  }

  /* ---------------- validation ---------------- */
  function cleanEmail(v) { return String(v || '').trim().toLowerCase().slice(0, 200); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  /* ---------------- api ---------------- */
  async function signup(email, password, name) {
    if (!cryptoReady()) return { ok: false, reason: 'Accounts need https:// or localhost (Web Crypto unavailable).' };
    const mail = cleanEmail(email);
    if (!validEmail(mail)) return { ok: false, reason: 'Enter a valid email address.' };
    if (String(password || '').length < 8) return { ok: false, reason: 'Password must be at least 8 characters.' };

    const accounts = readAccounts();
    if (accounts[mail]) return { ok: false, reason: 'An account with that email already exists on this device.' };

    const salt = newSalt();
    const hash = await derive(password, salt);
    const id = newId();

    accounts[mail] = {
      id,
      email: mail,
      name: String(name || '').trim().slice(0, 40) || mail.split('@')[0],
      salt,
      hash,
      createdAt: new Date().toISOString()
    };
    writeAccounts(accounts);

    snapshotTo(id);                 // carry over any guest progress
    writeSession({ id, email: mail, name: accounts[mail].name, since: new Date().toISOString() });
    return { ok: true };
  }

  async function signin(email, password) {
    if (!cryptoReady()) return { ok: false, reason: 'Accounts need https:// or localhost (Web Crypto unavailable).' };
    const mail = cleanEmail(email);
    const accounts = readAccounts();
    const account = accounts[mail];
    if (!account) return { ok: false, reason: 'No account with that email on this device.' };

    const hash = await derive(password, account.salt);
    if (hash !== account.hash) return { ok: false, reason: 'Incorrect password.' };

    writeSession({ id: account.id, email: account.email, name: account.name, since: new Date().toISOString() });
    return { ok: true };
  }

  function signout() {
    const session = readSession();
    if (session) deactivate(session.id);
    clearSession();
  }

  function current() { return readSession(); }

  function stats() {
    const game = readJSON('labdeck.game.v1', {});
    const progress = readJSON('labdeck.progress.v1', {});
    const done = Object.keys(progress).filter(k => progress[k] === true).length;
    return {
      xp: Number(game.xp) || 0,
      streak: Number(game.streak) || 0,
      lessons: done
    };
  }

  /* ---------------- ui ---------------- */
  let overlay = null;

  function buildOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="auth-close" type="button" aria-label="Close">×</button>
        <h2 id="authTitle">Account</h2>
        <div data-auth-body></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('.auth-close')) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !overlay.hidden) close();
    });
    return overlay;
  }

  function open() {
    const el = buildOverlay();
    el.hidden = false;
    render();
    const first = el.querySelector('input');
    if (first) setTimeout(() => first.focus(), 60);
  }

  function close() { if (overlay) overlay.hidden = true; }

  function render(mode) {
    const el = buildOverlay();
    const body = el.querySelector('[data-auth-body]');
    const session = current();

    if (session) {
      const s = stats();
      body.innerHTML = `
        <p class="auth-who">Signed in as <strong>${S.escapeHTML(session.name)}</strong><br>
          <span class="auth-mail">${S.escapeHTML(session.email)}</span></p>
        <div class="auth-stats">
          <div><b>${s.lessons}</b><span>lessons</span></div>
          <div><b>${s.xp}</b><span>XP</span></div>
          <div><b>${s.streak}</b><span>day streak</span></div>
        </div>
        <div class="auth-actions">
          <button class="btn small" data-act="signout">Sign out</button>
          <button class="btn small ghost" data-act="close">Close</button>
        </div>
        <p class="auth-note">Your progress is stored in this browser under this account. Signing out keeps it — sign back in to get it back.</p>`;

      body.querySelector('[data-act="signout"]').addEventListener('click', () => {
        signout();
        location.reload();
      });
      body.querySelector('[data-act="close"]').addEventListener('click', close);
      return;
    }

    const active = mode || 'signin';
    body.innerHTML = `
      <div class="auth-tabs">
        <button type="button" data-mode="signin" class="${active === 'signin' ? 'on' : ''}">Sign in</button>
        <button type="button" data-mode="signup" class="${active === 'signup' ? 'on' : ''}">Create account</button>
      </div>
      <form data-auth-form novalidate>
        <label class="auth-field" data-only="signup">
          <span>Name <em>(optional)</em></span>
          <input name="name" maxlength="40" autocomplete="nickname" />
        </label>
        <label class="auth-field">
          <span>Email</span>
          <input name="email" type="email" maxlength="200" autocomplete="email" required />
        </label>
        <label class="auth-field">
          <span>Password</span>
          <input name="password" type="password" maxlength="200" autocomplete="${active === 'signup' ? 'new-password' : 'current-password'}" required />
        </label>
        <p class="auth-status" data-status></p>
        <div class="auth-actions">
          <button class="btn primary small" type="submit" data-submit>${active === 'signup' ? 'Create account' : 'Sign in'}</button>
        </div>
      </form>
      <p class="auth-note">Accounts live in this browser only — no server, no email verification, no password reset.
        This is a local profile for keeping progress separate, not a way to protect the content.</p>`;

    const form = body.querySelector('[data-auth-form]');
    const status = body.querySelector('[data-status]');
    const nameField = body.querySelector('[data-only="signup"]');
    const submit = body.querySelector('[data-submit]');
    let currentMode = active;

    function applyMode(next) {
      currentMode = next;
      body.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === next));
      nameField.style.display = next === 'signup' ? '' : 'none';
      submit.textContent = next === 'signup' ? 'Create account' : 'Sign in';
      form.querySelector('[name="password"]').setAttribute('autocomplete', next === 'signup' ? 'new-password' : 'current-password');
      status.textContent = '';
    }
    applyMode(active);

    body.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => applyMode(btn.dataset.mode));
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = new FormData(form);
      const email = data.get('email');
      const password = data.get('password');
      const name = data.get('name');

      submit.disabled = true;
      status.className = 'auth-status';
      status.textContent = 'Working…';

      const result = currentMode === 'signup'
        ? await signup(email, password, name)
        : await signin(email, password);

      submit.disabled = false;

      if (!result.ok) {
        status.className = 'auth-status err';
        status.textContent = result.reason;
        return;
      }
      status.className = 'auth-status ok';
      status.textContent = 'Signed in — reloading…';
      setTimeout(() => location.reload(), 400);
    });
  }

  function updateChip() {
    const chip = document.getElementById('accountChip');
    if (!chip) return;
    const session = current();
    chip.textContent = session ? '👤 ' + (session.name || session.email) : 'Sign in';
    chip.title = session ? session.email : 'Sign in or create a local account';
  }

  /* ---------------- boot ---------------- */
  // Swap in the signed-in account's data before app.js reads localStorage.
  const bootSession = readSession();
  if (bootSession) activate(bootSession.id);

  document.addEventListener('DOMContentLoaded', () => {
    updateChip();
    const chip = document.getElementById('accountChip');
    if (chip) chip.addEventListener('click', open);
  });

  window.Auth = { open, close, signup, signin, signout, current, stats, updateChip };
})();
