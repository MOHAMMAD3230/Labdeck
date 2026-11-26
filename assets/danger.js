/* LabDeck — storage danger zone.
 * Clicking the cache badge opens a panel listing Cache Storage and localStorage,
 * with destructive actions that require typing DELETE to confirm. */
(function () {
  'use strict';
  const S = window.Security;
  const APP_PREFIX = 'labdeck.';
  let overlay = null;

  /* ---------------- inspection ---------------- */
  async function listCaches() {
    if (!('caches' in window)) return [];
    try {
      const names = await caches.keys();
      const out = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        out.push({ name, count: keys.length });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) { return []; }
  }

  function listKeys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(APP_PREFIX)) continue;
        out.push({ key, size: (localStorage.getItem(key) || '').length });
      }
    } catch (e) { /* ignore */ }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  function fmt(n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  async function estimate() {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try { return await navigator.storage.estimate(); } catch (e) { return null; }
  }

  /* ---------------- actions ---------------- */
  async function clearCaches() {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }

  function clearProgress() {
    listKeys()
      .map(k => k.key)
      .filter(k => !k.startsWith('labdeck.accounts.') && !k.startsWith('labdeck.session.'))
      .forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
  }

  async function clearEverything() {
    await clearCaches();
    try { localStorage.clear(); } catch (e) { /* ignore */ }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.unregister();
    } catch (e) { /* ignore */ }
  }

  const ACTIONS = {
    caches: {
      title: 'Cached content',
      desc: 'Service worker caches: app shell, course packs and the Python runtime. The site will re-download them on the next visit.',
      danger: false,
      run: clearCaches
    },
    progress: {
      title: 'Progress and scores',
      desc: 'Lesson completion, lab task state, quiz scores, XP and streak. Accounts are kept, so you can sign back in.',
      danger: true,
      run: clearProgress
    },
    everything: {
      title: 'Everything',
      desc: 'All caches, all local data including accounts, and the service worker registration. This cannot be undone.',
      danger: true,
      run: clearEverything
    }
  };

  /* ---------------- ui ---------------- */
  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-modal dz-modal" role="dialog" aria-modal="true" aria-labelledby="dzTitle">
        <button class="auth-close" type="button" aria-label="Close">×</button>
        <h2 id="dzTitle">Storage</h2>
        <div data-body></div>
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
    const el = build();
    el.hidden = false;
    render();
  }

  function close() { if (overlay) overlay.hidden = true; }

  async function render() {
    const body = overlay.querySelector('[data-body]');
    body.innerHTML = '<p class="auth-status">Reading storage…</p>';

    const caches = await listCaches();
    const keys = listKeys();
    const est = await estimate();

    const cacheRows = caches.length
      ? caches.map(c => `<li><code>${S.escapeHTML(c.name)}</code><span>${c.count} entries</span></li>`).join('')
      : '<li><span>No caches</span></li>';

    const keyRows = keys.length
      ? keys.map(k => `<li><code>${S.escapeHTML(k.key)}</code><span>${fmt(k.size)}</span></li>`).join('')
      : '<li><span>No local data</span></li>';

    body.innerHTML = `
      <p class="dz-summary">
        <b>${fmt(est && est.usage)}</b> used${est && est.quota ? ` of ${fmt(est.quota)}` : ''}
        · ${caches.length} cache${caches.length === 1 ? '' : 's'} · ${keys.length} local key${keys.length === 1 ? '' : 's'}
      </p>

      <details class="dz-details">
        <summary>Cache Storage</summary>
        <ul class="dz-list">${cacheRows}</ul>
      </details>
      <details class="dz-details">
        <summary>localStorage</summary>
        <ul class="dz-list">${keyRows}</ul>
      </details>

      <h3 class="dz-heading">Danger zone</h3>
      <p class="dz-warn">These actions are permanent. Each one asks you to type <code>DELETE</code> before it runs.</p>

      ${Object.entries(ACTIONS).map(([id, a]) => `
        <div class="dz-row" data-row="${id}">
          <div class="dz-info">
            <b>${S.escapeHTML(a.title)}</b>
            <span>${S.escapeHTML(a.desc)}</span>
          </div>
          <button class="btn small ${a.danger ? 'danger' : ''}" data-arm="${id}">Delete</button>
        </div>`).join('')}

      <div class="auth-actions" style="margin-top:16px">
        <button class="btn small ghost" data-close>Close</button>
      </div>`;

    body.querySelector('[data-close]').addEventListener('click', close);

    body.querySelectorAll('[data-arm]').forEach(btn => {
      btn.addEventListener('click', () => armRow(btn.dataset.arm));
    });
  }

  function armRow(id) {
    const action = ACTIONS[id];
    const row = overlay.querySelector(`[data-row="${id}"]`);
    if (!action || !row) return;

    row.classList.add('armed');
    row.innerHTML = `
      <div class="dz-info">
        <b>Delete ${S.escapeHTML(action.title.toLowerCase())}?</b>
        <span>Type <code>DELETE</code> to confirm. This cannot be undone.</span>
      </div>
      <div class="dz-confirm">
        <input type="text" data-confirm placeholder="DELETE" autocomplete="off" spellcheck="false" />
        <button class="btn small danger" data-go disabled>Confirm</button>
        <button class="btn small ghost" data-cancel>Cancel</button>
      </div>`;

    const input = row.querySelector('[data-confirm]');
    const go = row.querySelector('[data-go]');

    input.addEventListener('input', () => {
      go.disabled = input.value.trim().toUpperCase() !== 'DELETE';
    });
    input.focus();

    row.querySelector('[data-cancel]').addEventListener('click', () => render());

    go.addEventListener('click', async () => {
      go.disabled = true;
      go.textContent = 'Working…';
      try { await action.run(); } catch (e) { /* ignore */ }
      close();
      location.reload();
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('storageBadge');
    if (!badge) return;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('title', 'Storage — click to manage');
    badge.addEventListener('click', open);
    badge.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  window.DangerZone = { open, close };
})();
