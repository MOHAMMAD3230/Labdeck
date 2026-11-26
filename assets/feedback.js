/* LabDeck — course and lesson feedback.
 * Every submission is written to localStorage first, then POSTed to /api/feedback.
 * If the endpoint is missing (static-only deploy) or the user is offline, it stays
 * queued and is retried on the next visit or when the connection returns. */
(function () {
  'use strict';
  const S = window.Security;
  const LS = 'labdeck.feedback.v1';
  const MAX_LOCAL = 50;
  const MAX_TEXT = 1000;
  const ENDPOINT = '/api/feedback';

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'fb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  const Store = {
    all() {
      try { const a = JSON.parse(localStorage.getItem(LS)); return Array.isArray(a) ? a : []; }
      catch (e) { return []; }
    },
    save(list) {
      try { localStorage.setItem(LS, JSON.stringify(list.slice(-MAX_LOCAL))); } catch (e) { /* quota */ }
    },
    add(entry) { const l = this.all(); l.push(entry); this.save(l); },
    markSent(id) {
      this.save(this.all().map(e => (e.id === id ? Object.assign({}, e, { sent: true, sentAt: new Date().toISOString() }) : e)));
    },
    pending() { return this.all().filter(e => !e.sent); },
    clear() { try { localStorage.removeItem(LS); } catch (e) { /* ignore */ } }
  };

  function cleanText(value, max) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  function build(courseId, lessonId, rating, helpful, confusing, email) {
    return {
      id: uid(),
      v: 1,
      courseId: cleanText(courseId, 40),
      lessonId: lessonId ? cleanText(lessonId, 40) : null,
      rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 0)),
      helpful: cleanText(helpful, MAX_TEXT),
      confusing: cleanText(confusing, MAX_TEXT),
      email: cleanText(email, 200),
      createdAt: new Date().toISOString(),
      sent: false
    };
  }

  async function send(entry) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!res.ok) return false;
      Store.markSent(entry.id);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function flush() {
    for (const entry of Store.pending()) {
      const ok = await send(entry);
      if (!ok) break;
    }
  }

  /* ---------------- form ---------------- */
  function render(container, opts) {
    opts = opts || {};
    if (!container) return;

    container.innerHTML = `
      <section class="feedback">
        <h3>${S.escapeHTML(opts.title || 'How was this course?')}</h3>
        <p class="fb-sub">Two questions, thirty seconds. Your answer is saved on this device first, then sent if the endpoint is reachable.</p>
        <form data-fb novalidate>
          <fieldset class="fb-rating">
            <legend>Overall, how useful was it?</legend>
            <div class="fb-stars">
              ${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" /><span>${n}</span></label>`).join('')}
            </div>
          </fieldset>

          <label class="fb-field">
            <span>What worked well?</span>
            <textarea name="helpful" rows="3" maxlength="${MAX_TEXT}" placeholder="The permissions lab finally made chmod click."></textarea>
          </label>

          <label class="fb-field">
            <span>What was confusing or missing?</span>
            <textarea name="confusing" rows="3" maxlength="${MAX_TEXT}" placeholder="I got stuck on the pipe syntax."></textarea>
          </label>

          <label class="fb-field">
            <span>Email <em>(optional — only if you want a reply)</em></span>
            <input type="email" name="email" maxlength="200" placeholder="you@example.com" />
          </label>

          <div class="fb-actions">
            <button type="submit" class="btn primary small">Send feedback</button>
            <span class="fb-status" data-status></span>
          </div>
        </form>
      </section>`;

    const form = container.querySelector('[data-fb]');
    const status = container.querySelector('[data-status]');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = new FormData(form);
      const rating = Number(data.get('rating') || 0);
      if (!rating) {
        status.textContent = 'Pick a rating first.';
        status.className = 'fb-status err';
        return;
      }

      const entry = build(opts.courseId, opts.lessonId, rating, data.get('helpful'), data.get('confusing'), data.get('email'));
      Store.add(entry);
      status.textContent = 'Saving…';
      status.className = 'fb-status';

      const ok = await send(entry);
      form.reset();
      if (ok) {
        status.textContent = 'Thanks — received.';
        status.className = 'fb-status ok';
      } else {
        status.textContent = 'Saved on this device. It will be sent automatically when the endpoint is reachable.';
        status.className = 'fb-status warn';
      }
    });
  }

  /* ---------------- inbox ---------------- */
  function renderInbox(container) {
    const all = Store.all();
    const rows = all.slice().reverse().map(e => `
      <tr>
        <td>${S.escapeHTML(String(e.createdAt || '').slice(0, 10))}</td>
        <td>${S.escapeHTML(e.courseId)}${e.lessonId ? ' / ' + S.escapeHTML(e.lessonId) : ''}</td>
        <td>${Number(e.rating) || 0}/5</td>
        <td>${e.sent ? 'sent' : 'queued'}</td>
        <td>${S.escapeHTML(String(e.helpful || '').slice(0, 60))}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="meta" style="margin-bottom:14px">
        <span class="pill">${all.length} stored</span>
        <span class="pill">${Store.pending().length} queued</span>
      </div>
      ${all.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:var(--muted)">
          <th style="padding:8px 0;border-bottom:1px solid var(--line)">Date</th>
          <th style="border-bottom:1px solid var(--line)">Course</th>
          <th style="border-bottom:1px solid var(--line)">Rating</th>
          <th style="border-bottom:1px solid var(--line)">Status</th>
          <th style="border-bottom:1px solid var(--line)">What worked</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="notice">No feedback from this browser yet.</div>'}

      <div class="hero-actions" style="margin-top:20px">
        <button class="btn small" id="fbFlush">Retry queued</button>
        <button class="btn small ghost" id="fbExport">Show JSON</button>
        <button class="btn small ghost" id="fbClear">Clear local copy</button>
      </div>
      <pre id="fbJson" hidden style="margin-top:16px;max-height:320px"></pre>`;

    container.querySelector('#fbFlush').addEventListener('click', async () => {
      await flush();
      renderInbox(container);
    });
    container.querySelector('#fbExport').addEventListener('click', () => {
      const pre = container.querySelector('#fbJson');
      pre.hidden = false;
      pre.textContent = JSON.stringify(Store.all(), null, 2);
    });
    container.querySelector('#fbClear').addEventListener('click', () => {
      Store.clear();
      renderInbox(container);
    });
  }

  window.addEventListener('online', flush);
  setTimeout(flush, 2000);

  window.Feedback = { render, renderInbox, flush, all: () => Store.all() };
})();
