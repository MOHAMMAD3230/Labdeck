/* LabDeck — live Python lab.
 * Runs real CPython (Pyodide/WebAssembly) in the browser. The runtime is downloaded
 * once from a pinned CDN version and then served from Cache Storage, so labs keep
 * working offline. Submitted code passes Security.guardPython() first. */
(function () {
  'use strict';

  const PYODIDE_VERSION = 'v0.26.4';
  const CDN = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
  const MIN_RUN_INTERVAL = 700; // ms — simple rate limit between runs

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not download the Python runtime'));
      document.head.appendChild(s);
    });
  }

  const PyLab = {
    _py: null,
    _loading: null,
    _lastRun: 0,
    isReady() { return !!this._py; },

    load(onStatus) {
      if (this._py) return Promise.resolve(this._py);
      if (this._loading) return this._loading;
      this._loading = (async () => {
        if (onStatus) onStatus('downloading Python runtime…');
        await injectScript(CDN + 'pyodide.js');
        if (onStatus) onStatus('starting interpreter…');
        const py = await window.loadPyodide({ indexURL: CDN });
        this._py = py;
        return py;
      })();
      this._loading.catch(() => { this._loading = null; });
      return this._loading;
    },

    async run(code) {
      const py = await this.load();
      const buf = [];
      py.setStdout({ batched: s => buf.push(s) });
      py.setStderr({ batched: s => buf.push(s) });
      let error = null;
      try {
        await py.runPythonAsync(code);
      } catch (e) {
        error = (e && (e.message || e.toString())) || 'Error';
      }
      return { out: buf.join(''), error };
    }
  };

  function mount(container, lab, opts) {
    opts = opts || {};
    const S = window.Security;
    const doneTasks = new Set(opts.done || []);
    const storageKey = opts.storageKey || 'labdeck.code';

    let saved = lab.starter || '';
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored.length < S.MAX_CODE) saved = stored;
    } catch (e) { /* ignore */ }

    container.innerHTML = `
      <section class="lab">
        <div class="lab-head">
          <span class="dot"></span>
          <h3>Live Python lab</h3>
          <span class="status" data-status>runtime: not loaded</span>
        </div>
        <div class="lab-grid">
          <div class="lab-main">
            <p class="lab-brief">${S.sanitizeHTML(lab.brief || '')}</p>
            <textarea class="py-editor" spellcheck="false" maxlength="${S.MAX_CODE}" data-code aria-label="Python code"></textarea>
            <div class="py-toolbar">
              <button class="btn primary small" data-run>▶ Run</button>
              <button class="btn small ghost" data-reset>Reset code</button>
              <span class="hint" data-hint>Saved locally as you type · Ctrl/Cmd+Enter runs</span>
            </div>
            <div class="py-out" data-out>Output appears here.</div>
          </div>
          <aside class="lab-side">
            <p class="side-title">Tasks</p>
            <ul class="tasks" data-tasks></ul>
          </aside>
        </div>
      </section>`;

    const code = container.querySelector('[data-code]');
    const out = container.querySelector('[data-out]');
    const status = container.querySelector('[data-status]');
    const taskList = container.querySelector('[data-tasks]');
    const runBtn = container.querySelector('[data-run]');

    code.value = saved;
    code.addEventListener('input', () => {
      try { localStorage.setItem(storageKey, code.value); } catch (e) { /* ignore */ }
    });
    code.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = code.selectionStart;
        code.value = code.value.slice(0, s) + '    ' + code.value.slice(code.selectionEnd);
        code.selectionStart = code.selectionEnd = s + 4;
      }
    });

    container.querySelector('[data-reset]').addEventListener('click', () => {
      code.value = lab.starter || '';
      try { localStorage.setItem(storageKey, code.value); } catch (e) { /* ignore */ }
    });

    function renderTasks() {
      taskList.innerHTML = lab.tasks.map((t, i) =>
        `<li class="${doneTasks.has(i) ? 'done' : ''}"><span class="box">✓</span><span>${S.sanitizeHTML(t.text)}</span></li>`).join('');
    }
    renderTasks();

    function evaluate(output) {
      lab.tasks.forEach((t, i) => {
        if (doneTasks.has(i)) return;
        let ok = false;
        try { ok = !!t.check(output); } catch (e) { ok = false; }
        if (ok) {
          doneTasks.add(i);
          if (opts.onTask) opts.onTask(i, true);
        }
      });
      renderTasks();
      if (doneTasks.size === lab.tasks.length && opts.onComplete) opts.onComplete();
    }

    function showError(message) {
      out.textContent = '';
      const div = document.createElement('div');
      div.className = 'err';
      div.textContent = message;
      out.appendChild(div);
    }

    async function run() {
      const now = Date.now();
      if (now - PyLab._lastRun < MIN_RUN_INTERVAL) return;
      PyLab._lastRun = now;

      const guard = S.guardPython(code.value);
      if (!guard.ok) { showError(guard.reason); return; }

      runBtn.disabled = true;
      const original = runBtn.textContent;
      runBtn.innerHTML = '<span class="spinner"></span> Running';
      out.textContent = '';
      try {
        await PyLab.load(s => { status.textContent = s; });
        status.textContent = 'runtime: ready';
        const { out: stdout, error } = await PyLab.run(code.value);
        out.textContent = stdout || (error ? '' : '(no output)');
        if (error) {
          const div = document.createElement('div');
          div.className = 'err';
          div.textContent = error;
          out.appendChild(div);
        }
        evaluate(stdout || '');
      } catch (err) {
        status.textContent = 'runtime: unavailable';
        showError((err.message || String(err)) +
          '\n\nThe Python runtime is downloaded on first use. Connect to the internet once, press Run, ' +
          'and it will be cached for offline use afterwards.');
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = original;
      }
    }

    runBtn.addEventListener('click', run);
    code.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });

    return { run };
  }

  window.PyLab = { mount, load: (s) => PyLab.load(s), isReady: () => PyLab.isReady() };
})();
