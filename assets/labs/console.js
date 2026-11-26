/* A minimal console UI shared by the SQL and networking labs. */
(function () {
  'use strict';
  window.LabTypes = window.LabTypes || {};

  function mount(el, opts) {
    const S = window.Security;
    el.innerHTML = `
      <div class="term">
        <div class="term-bar"><i class="r"></i><i class="y"></i><i class="g"></i><span>${S.escapeHTML(opts.title || '')}</span></div>
        <div class="term-out" data-out></div>
        <form class="term-form" data-form>
          <span class="ps1" data-ps1>${S.escapeHTML(opts.prompt || '$')}</span>
          <input data-input maxlength="${S.MAX_COMMAND}" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </form>
      </div>`;

    const out = el.querySelector('[data-out]');
    const form = el.querySelector('[data-form]');
    const input = el.querySelector('[data-input]');
    const history = [];

    function print(text, cls) {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.textContent = text;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    if (opts.banner) print(opts.banner);

    form.addEventListener('submit', e => {
      e.preventDefault();
      const guard = S.guardCommand(input.value);
      const line = guard.ok ? guard.line : '';
      input.value = '';
      if (!guard.ok) { print(guard.reason, 'err'); return; }
      print(`${opts.prompt || '$'} ${line}`, 'cmd');
      history.push(line);
      let res;
      try { res = opts.run(line, history) || {}; }
      catch (err) { res = { err: String((err && err.message) || err) }; }
      if (res.clear) out.innerHTML = '';
      else {
        if (res.out) print(res.out);
        if (res.err) print(res.err, 'err');
      }
      if (opts.after) opts.after(line, res);
    });

    let idx = -1;
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        idx = idx === -1 ? history.length - 1 : Math.max(0, idx - 1);
        input.value = history[idx];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx === -1) return;
        idx += 1;
        if (idx >= history.length) { idx = -1; input.value = ''; }
        else input.value = history[idx];
      }
    });

    setTimeout(() => input.focus(), 60);
    return { print, history };
  }

  window.Console = { mount };
})();
