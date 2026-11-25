/* LabDeck app shell: hash router, progress store, integrity-checked pack loader,
 * onboarding gate, ticket framing, XP/streak and the daily challenge. */
(function () {
  'use strict';

  const CATALOG = window.CATALOG;
  const S = window.Security;
  const G = window.Onboarding;
  const PACK_CACHE = 'labdeck-packs-v1';
  const LS_PROGRESS = 'labdeck.progress.v1';
  const LS_LABS = 'labdeck.labs.v1';
  const LS_QUIZ = 'labdeck.quiz.v1';

  /* ---------------- store (localStorage, validated on read) ---------------- */
  const Store = {
    progress: {},
    labs: {},
    quiz: {},
    init() {
      try { this.progress = S.validateStore(localStorage.getItem(LS_PROGRESS)); } catch (e) { this.progress = {}; }
      try { this.labs = S.validateStore(localStorage.getItem(LS_LABS)); } catch (e) { this.labs = {}; }
      try { this.quiz = S.validateStore(localStorage.getItem(LS_QUIZ)); } catch (e) { this.quiz = {}; }
    },
    save() {
      try { localStorage.setItem(LS_PROGRESS, JSON.stringify(this.progress)); } catch (e) { /* quota */ }
      try { localStorage.setItem(LS_LABS, JSON.stringify(this.labs)); } catch (e) { /* quota */ }
    },
    key(courseId, lessonId) { return courseId + ':' + lessonId; },
    isDone(courseId, lessonId) { return !!this.progress[this.key(courseId, lessonId)]; },
    setDone(courseId, lessonId, v) { this.progress[this.key(courseId, lessonId)] = !!v; this.save(); },
    labTasks(courseId, lessonId) {
      const s = this.labs[this.key(courseId, lessonId)];
      return s && Array.isArray(s.tasks) ? s.tasks : [];
    },
    setLabTask(courseId, lessonId, index) {
      const k = this.key(courseId, lessonId);
      const s = this.labs[k] || { tasks: [] };
      s.tasks[index] = true;
      this.labs[k] = s;
      this.save();
    },
    quizResult(key) { return this.quiz[key] || null; },
    setQuizResult(key, best, total) {
      const cur = this.quiz[key];
      if (!cur || best > cur.best) this.quiz[key] = { best, total };
      try { localStorage.setItem(LS_QUIZ, JSON.stringify(this.quiz)); } catch (e) { /* quota */ }
    },
    courseStats(course) {
      const lessons = course.modules.flatMap(m => m.lessons);
      const done = lessons.filter(l => this.isDone(course.id, l.id)).length;
      return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
    }
  };

  /* ---------------- course packs: fetch → verify → cache ---------------- */
  const Packs = {
    mem: {},
    async get(courseId, force) {
      if (!force && this.mem[courseId]) return this.mem[courseId];
      const url = `data/packs/${courseId}.json`;

      if (!force && 'caches' in window) {
        try {
          const cache = await caches.open(PACK_CACHE);
          const hit = await cache.match(url);
          if (hit) {
            const text = await hit.text();
            const verdict = await S.verifyPack(courseId, text);
            if (verdict.status === 'mismatch') throw new Error('Integrity check failed for the cached pack.');
            const json = JSON.parse(text);
            this.mem[courseId] = json;
            return json;
          }
        } catch (e) { if (/Integrity/.test(e.message)) throw e; }
      }

      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Could not load the ${courseId} pack (${res.status})`);
      const text = await res.text();

      const verdict = await S.verifyPack(courseId, text);
      if (verdict.status === 'mismatch') {
        throw new Error('Integrity check failed: the downloaded content does not match the pinned hash. Refusing to load it.');
      }

      const json = JSON.parse(text);
      this.mem[courseId] = json;
      if ('caches' in window) {
        try {
          const cache = await caches.open(PACK_CACHE);
          await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
        } catch (e) { /* ignore */ }
      }
      return json;
    },
    async isCached(courseId) {
      if (!('caches' in window)) return false;
      try {
        const cache = await caches.open(PACK_CACHE);
        return !!(await cache.match(`data/packs/${courseId}.json`));
      } catch (e) { return false; }
    },
    async clear() {
      this.mem = {};
      if (!('caches' in window)) return;
      try { await caches.delete(PACK_CACHE); } catch (e) { /* ignore */ }
    }
  };

  /* ---------------- helpers ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const app = $('#app');
  const esc = S.escapeHTML;

  const findCourse = id => CATALOG.courses.find(c => c.id === id);
  const findProject = id => CATALOG.projects.find(p => p.id === id);
  function findLesson(course, lessonId) {
    for (const m of course.modules) {
      const l = m.lessons.find(x => x.id === lessonId);
      if (l) return { module: m, lesson: l };
    }
    return null;
  }
  const flatLessons = course => course.modules.flatMap(m => m.lessons);

  let toastTimer = null;
  function toast(msg) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function fmtBytes(n) {
    if (!n) return '0 KB';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function updateHeader() {
    const el = $('#gameBadge');
    if (!el) return;
    const st = G.Game.state;
    el.textContent = `🔥 ${st.streak} · ${st.xp} XP · L${G.Game.level()}`;
    el.title = `Streak ${st.streak} day(s) · ${st.xp} XP · level ${G.Game.level()}`;
  }

  async function updateBadge() {
    const badge = $('#storageBadge');
    if (!badge) return;
    let usage = null;
    if (navigator.storage && navigator.storage.estimate) {
      try { usage = (await navigator.storage.estimate()).usage; } catch (e) { /* ignore */ }
    }
    let cached = 0;
    for (const c of CATALOG.courses) if (await Packs.isCached(c.id)) cached++;
    badge.textContent = `cache: ${cached}/${CATALOG.courses.length} packs · ${fmtBytes(usage)}`;
  }

  /** Award XP + streak on any completion event. */
  function reward(xp) {
    G.Game.addXp(xp);
    G.Game.touchDay();
    updateHeader();
  }

  /* ---------------- views ---------------- */
  function viewHome() {
    const cards = CATALOG.courses.map(c => {
      const s = Store.courseStats(c);
      const lessons = flatLessons(c).length;
      const labs = flatLessons(c).filter(l => l.kind === 'lab').length;
      return `
        <article class="card">
          <div class="icon">${c.icon}</div>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.tagline)}</p>
          <div class="meta">
            <span class="pill">${esc(c.level)}</span>
            <span class="pill">${lessons} lessons</span>
            <span class="pill">${labs} labs</span>
            <span class="pill">~${c.hours}h</span>
          </div>
          <div class="progress-row">
            <div class="bar"><i style="width:${s.pct}%"></i></div>
            <span>${s.done}/${s.total}</span>
          </div>
          <div class="hero-actions">
            <a class="btn primary small" href="#/course/${c.id}">${s.done ? 'Continue' : 'Start course'}</a>
            <button class="btn small ghost" data-download="${c.id}">Download for offline</button>
          </div>
        </article>`;
    }).join('');

    const projectCards = CATALOG.projects.map(p => `
      <article class="card">
        <div class="icon">${p.icon}</div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="meta">
          <span class="pill">${esc(p.course)}</span>
          <span class="pill">${p.minutes} min</span>
          <span class="pill">${p.lab.tasks.length} checks</span>
        </div>
        <div class="hero-actions">
          <a class="btn small" href="#/project/${p.id}">Open project</a>
        </div>
      </article>`).join('');

    const next = G.nextAction((cid, lid) => Store.isDone(cid, lid));
    const nextCard = next ? `
      <section class="next-card">
        <div>
          <p class="kicker">Next up</p>
          <h3>${esc(next.lesson.title)}</h3>
          <p>${esc(next.course.title)} · ${next.lesson.minutes} min · ${esc(next.lesson.kind)}</p>
        </div>
        <a class="btn primary" href="#/lesson/${next.course.id}/${next.lesson.id}">Continue →</a>
      </section>` : `
      <section class="next-card">
        <div>
          <p class="kicker">Complete</p>
          <h3>You finished every lesson.</h3>
          <p>Try a project, or reset a course to go again.</p>
        </div>
        <a class="btn primary" href="#/projects">Open projects →</a>
      </section>`;

    const d = G.daily();
    const dailyDone = G.Game.dailyDoneToday();
    const dailyTitle = dailyDone
      ? 'Done for today ✓'
      : (d.pick.kind === 'quiz' ? 'One question' : d.pick.micro.title);
    const dailyCard = `
      <section class="daily-card">
        <div>
          <p class="kicker">Daily challenge · ${esc(d.key)}</p>
          <h3>${esc(dailyTitle)}</h3>
          <p>${dailyDone ? 'Come back tomorrow to keep the streak.' : 'About 60 seconds. Keeps your streak alive.'}</p>
        </div>
        <a class="btn ${dailyDone ? 'ghost' : 'primary'}" href="#/daily">${dailyDone ? 'View' : 'Start'} →</a>
      </section>`;

    app.innerHTML = `
      <section class="hero">
        <h1>Learn Linux and Python by <em>doing</em>, not watching.</h1>
        <p>Two complete courses — 30 lessons, 12 live labs, 4 quizzes and 2 projects — with a real shell and a
        real Python interpreter running in your browser. Content is downloaded once, integrity-checked and
        cached locally, so you can keep practising offline.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#/course/linux">Start Linux Essentials</a>
          <a class="btn" href="#/course/python">Start Python Foundations</a>
          <button class="btn ghost" id="downloadAll">Download all courses</button>
        </div>
      </section>
      ${nextCard}
      ${dailyCard}
      <div class="grid">${cards}</div>
      <h2 style="margin:38px 0 0;font-size:22px">Live projects</h2>
      <p style="color:var(--muted);margin:6px 0 0">End-to-end tasks graded against real state — not multiple choice.</p>
      <div class="grid">${projectCards}</div>
      <div class="notice">
        <strong>How storage works.</strong> Progress, lab task state, quiz scores and XP live in
        <code>localStorage</code>. Course packs and the Python runtime live in <code>Cache Storage</code> and are
        reused on every later visit. Every pack is hashed with SHA-256 and pinned on first download.
        <a href="#/security">See the security checks →</a>
      </div>`;

    app.querySelectorAll('[data-download]').forEach(btn =>
      btn.addEventListener('click', () => downloadCourse(btn.dataset.download, btn)));
    const all = $('#downloadAll');
    if (all) all.addEventListener('click', async () => {
      all.disabled = true;
      for (const c of CATALOG.courses) await downloadCourse(c.id, null, true);
      all.disabled = false;
      toast('All course packs cached for offline use');
      updateBadge();
    });
  }

  async function downloadCourse(courseId, btn, silent) {
    if (btn) { btn.disabled = true; btn.textContent = 'Downloading…'; }
    try {
      await Packs.get(courseId, true);
      if (!silent) toast(`${courseId} pack cached and verified — available offline`);
    } catch (e) {
      if (!silent) toast('Download failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Downloaded ✓'; }
      updateBadge();
    }
  }

  function viewCourse(courseId) {
    const course = findCourse(courseId);
    if (!course) return viewNotFound();
    const s = Store.courseStats(course);

    const modules = course.modules.map(m => `
      <section class="module">
        <h4>${esc(m.title)}</h4>
        ${m.lessons.map(l => {
          const done = Store.isDone(course.id, l.id);
          return `<a class="lesson-row" href="#/lesson/${course.id}/${l.id}">
            <span class="tick ${done ? 'on' : ''}">✓</span>
            <span class="t">${esc(l.title)}</span>
            <span class="kind ${esc(l.kind)}">${esc(l.kind)}</span>
            <span class="mins">${l.minutes} min</span>
          </a>`;
        }).join('')}
      </section>`).join('');

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / ${esc(course.title)}</div>
      <div class="page-head">
        <div>
          <h1>${course.icon} ${esc(course.title)}</h1>
          <p class="sub">${esc(course.tagline)}</p>
          <div class="meta" style="margin-top:10px">
            <span class="pill">${esc(course.level)}</span>
            <span class="pill">~${course.hours} hours</span>
            <span class="pill">${s.done}/${s.total} lessons complete</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn small" data-download="${course.id}">Download for offline</button>
          <button class="btn small ghost" data-reset="${course.id}">Reset progress</button>
        </div>
      </div>
      <div class="progress-row" style="margin-bottom:20px">
        <div class="bar"><i style="width:${s.pct}%"></i></div><span>${s.pct}%</span>
      </div>
      ${modules}`;

    const dl = app.querySelector('[data-download]');
    if (dl) dl.addEventListener('click', () => downloadCourse(course.id, dl));
    const reset = app.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', () => {
      flatLessons(course).forEach(l => Store.setDone(course.id, l.id, false));
      Object.keys(Store.labs).forEach(k => { if (k.startsWith(course.id + ':')) delete Store.labs[k]; });
      Object.keys(Store.quiz).forEach(k => { if (k.startsWith(course.id + ':')) delete Store.quiz[k]; });
      Store.save();
      try { localStorage.setItem(LS_QUIZ, JSON.stringify(Store.quiz)); } catch (e) { /* ignore */ }
      toast('Progress reset for ' + course.title);
      viewCourse(course.id);
    });
  }

  function mountLab(container, lab, courseId, lessonId) {
    const ticket = G.ticketFor(courseId, lessonId);
    if (ticket) {
      const banner = document.createElement('div');
      banner.className = 'ticket';
      const id = document.createElement('span');
      id.className = 'ticket-id';
      id.textContent = 'TICKET ' + ticket.id;
      const sym = document.createElement('span');
      sym.className = 'ticket-sym';
      sym.textContent = ticket.symptom;
      banner.appendChild(id);
      banner.appendChild(sym);
      container.appendChild(banner);
    }

    const mountPoint = document.createElement('div');
    container.appendChild(mountPoint);

    const opts = {
      done: Store.labTasks(courseId, lessonId),
      storageKey: `labdeck.code.${courseId}.${lessonId}`,
      onTask: i => {
        Store.setLabTask(courseId, lessonId, i);
        reward(10);
      },
      onComplete: () => {
        if (!Store.isDone(courseId, lessonId)) {
          Store.setDone(courseId, lessonId, true);
          reward(25);
          toast('All tasks complete — marked as done');
        }
      }
    };
    if (lab.type === 'python') window.PyLab.mount(mountPoint, lab, opts);
    else window.TerminalLab.mount(mountPoint, lab, opts);
  }

  async function viewLesson(courseId, lessonId) {
    const course = findCourse(courseId);
    if (!course) return viewNotFound();
    const found = findLesson(course, lessonId);
    if (!found) return viewNotFound();
    const { lesson } = found;
    const lessons = flatLessons(course);
    const idx = lessons.findIndex(l => l.id === lessonId);
    const prev = lessons[idx - 1];
    const next = lessons[idx + 1];
    const done = Store.isDone(course.id, lesson.id);

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / <a href="#/course/${course.id}">${esc(course.title)}</a> / ${esc(lesson.title)}</div>
      <div class="page-head">
        <div>
          <h1>${esc(lesson.title)}</h1>
          <div class="meta">
            <span class="pill">${esc(lesson.kind)}</span>
            <span class="pill">${lesson.minutes} min</span>
            ${done ? '<span class="pill">completed</span>' : ''}
          </div>
        </div>
        <div class="actions">
          <button class="btn small ${done ? 'ghost' : 'primary'}" id="markDone">${done ? 'Mark as not done' : 'Mark as complete'}</button>
        </div>
      </div>
      <article class="lesson-body" id="lessonBody">
        <p style="color:var(--muted)"><span class="spinner"></span> Loading lesson content…</p>
      </article>
      <div id="labMount"></div>
      <nav class="lesson-nav">
        ${prev ? `<a class="btn small" href="#/lesson/${course.id}/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="btn small" href="#/lesson/${course.id}/${next.id}">${esc(next.title)} →</a>` : '<span></span>'}
      </nav>`;

    $('#markDone').addEventListener('click', () => {
      const now = !Store.isDone(course.id, lesson.id);
      Store.setDone(course.id, lesson.id, now);
      if (now) reward(15);
      toast(now ? 'Lesson marked complete' : 'Lesson marked incomplete');
      viewLesson(course.id, lesson.id);
    });

    try {
      const pack = await Packs.get(course.id);
      const body = (pack.lessons && pack.lessons[lesson.id]) || '';
      $('#lessonBody').innerHTML = body
        ? S.sanitizeHTML(body)
        : '<p>This lesson has no reading content — jump straight into the lab.</p>';
    } catch (e) {
      $('#lessonBody').innerHTML = `<div class="notice">Could not load lesson content: ${esc(e.message)}
        Check your connection, or download the course pack from the course page.</div>`;
    }

    if (lesson.lab) mountLab($('#labMount'), lesson.lab, course.id, lesson.id);
    if (lesson.quiz) mountQuiz($('#labMount'), lesson.quiz, course.id, lesson.id);
  }

  /* ---------------- quiz ---------------- */
  function mountQuiz(container, quiz, courseId, lessonId) {
    const key = courseId + ':' + lessonId;
    const total = quiz.questions.length;
    const pass = quiz.pass || total;
    let answers = new Array(total).fill(-1);

    container.innerHTML = `
      <section class="lab quiz">
        <div class="lab-head">
          <span class="dot"></span>
          <h3>Quiz</h3>
          <span class="status" data-status></span>
        </div>
        <div class="lab-grid">
          <div class="lab-main">
            <form data-quiz></form>
            <div class="py-toolbar">
              <button class="btn primary small" data-check>Check answers</button>
              <button class="btn small ghost" data-retry>Try again</button>
              <span class="hint">${pass} of ${total} correct to pass</span>
            </div>
          </div>
          <aside class="lab-side">
            <p class="side-title">Result</p>
            <div data-result style="font-size:14px;color:var(--muted)">Answer every question, then check.</div>
          </aside>
        </div>
      </section>`;

    const form = container.querySelector('[data-quiz]');
    const resultEl = container.querySelector('[data-result]');
    const statusEl = container.querySelector('[data-status]');

    function paintStatus() {
      const best = Store.quizResult(key);
      statusEl.textContent = best ? `best ${best.best}/${best.total}` : 'not attempted';
    }

    function renderForm() {
      form.innerHTML = quiz.questions.map((q, i) => `
        <fieldset class="q">
          <legend><span class="qnum">${i + 1}</span>${S.sanitizeHTML(q.q)}</legend>
          ${q.options.map((o, j) => `
            <label class="opt">
              <input type="radio" name="q${i}" value="${j}" ${answers[i] === j ? 'checked' : ''} />
              <span>${S.sanitizeHTML(o)}</span>
            </label>`).join('')}
          <p class="explain" data-explain="${i}" hidden></p>
        </fieldset>`).join('');
    }

    form.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.type !== 'radio') return;
      const i = Number(input.name.slice(1));
      if (Number.isInteger(i) && i >= 0 && i < total) answers[i] = Number(input.value);
    });

    container.querySelector('[data-check]').addEventListener('click', () => {
      if (answers.some(a => a < 0)) {
        resultEl.textContent = 'Answer every question first.';
        return;
      }
      let score = 0;
      const fields = form.querySelectorAll('fieldset');
      quiz.questions.forEach((q, i) => {
        const ok = answers[i] === q.answer;
        if (ok) score++;
        const fs = fields[i];
        fs.classList.toggle('correct', ok);
        fs.classList.toggle('wrong', !ok);
        const ex = fs.querySelector('[data-explain]');
        ex.hidden = false;
        ex.innerHTML = (ok
          ? '<strong>Correct.</strong> '
          : `<strong>Not quite — the answer is “${esc(q.options[q.answer])}”.</strong> `) + S.sanitizeHTML(q.explain || '');
      });
      const pct = Math.round((score / total) * 100);
      resultEl.innerHTML = `<div style="font-size:26px;font-weight:800;color:${score >= pass ? 'var(--accent)' : 'var(--warn)'}">${score}/${total}</div>
        <div>${pct}% · ${score >= pass ? 'passed' : `need ${pass} to pass`}</div>`;
      Store.setQuizResult(key, score, total);
      paintStatus();
      if (score >= pass && !Store.isDone(courseId, lessonId)) {
        Store.setDone(courseId, lessonId, true);
        reward(50);
        toast('Quiz passed — lesson marked done');
      }
    });

    container.querySelector('[data-retry]').addEventListener('click', () => {
      answers = new Array(total).fill(-1);
      renderForm();
      resultEl.textContent = 'Answer every question, then check.';
    });

    renderForm();
    paintStatus();
  }

  /* ---------------- onboarding + missions + daily ---------------- */
  function viewStart() {
    app.innerHTML = '';
    G.renderStart(app, () => { location.hash = '#/mission/first'; });
  }

  function viewMission(missionId) {
    const m = G.missionById(missionId);
    if (!m) return viewNotFound();

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / Mission</div>
      <div class="page-head">
        <div>
          <h1>${esc(m.title)}</h1>
          <p class="sub">${esc(m.symptom)}</p>
          <div class="meta" style="margin-top:10px">
            <span class="pill">TICKET ${esc(m.ticket)}</span>
            <span class="pill">${m.minutes} min</span>
          </div>
        </div>
      </div>
      <div id="labMount"></div>
      <nav class="lesson-nav">
        <a class="btn small ghost" href="#/">Skip to courses</a>
        <a class="btn small" href="#/course/linux">Open Linux Essentials →</a>
      </nav>`;

    const mountEl = $('#labMount');
    const opts = {
      done: Store.labTasks('mission', m.id),
      storageKey: `labdeck.code.mission.${m.id}`,
      onTask: i => { Store.setLabTask('mission', m.id, i); reward(10); },
      onComplete: () => {
        if (!Store.isDone('mission', m.id)) {
          Store.setDone('mission', m.id, true);
          reward(40);
          toast('Ticket closed — that was module 4 of Linux Essentials');
        }
      }
    };
    if (m.lab.type === 'python') window.PyLab.mount(mountEl, m.lab, opts);
    else window.TerminalLab.mount(mountEl, m.lab, opts);
  }

  function viewDaily() {
    const d = G.daily();
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / Daily challenge</div>
      <div class="page-head">
        <div>
          <h1>Daily challenge</h1>
          <p class="sub">One task a day, drawn from the courses. Resets at midnight.</p>
          <div class="meta" style="margin-top:10px">
            <span class="pill">${esc(d.key)}</span>
            <span class="pill">🔥 ${G.Game.state.streak} day streak</span>
            <span class="pill">${esc(d.pick.source)}</span>
          </div>
        </div>
      </div>
      <div id="dailyMount"></div>`;

    const el = $('#dailyMount');
    if (G.Game.dailyDoneToday()) {
      el.innerHTML = `<div class="notice"><strong>Done for today.</strong> Come back tomorrow — the streak continues.</div>`;
      return;
    }
    G.renderDaily(el, d.pick, correct => {
      G.Game.completeDaily();
      reward(correct ? 30 : 10);
      toast(correct ? '+30 XP — correct' : '+10 XP — come back tomorrow');
    });
  }

  /* ---------------- projects ---------------- */
  function viewProjects() {
    const cards = CATALOG.projects.map(p => `
      <article class="card">
        <div class="icon">${p.icon}</div>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <div class="meta">
          <span class="pill">${esc(p.course)}</span>
          <span class="pill">${esc(p.level)}</span>
          <span class="pill">${p.minutes} min</span>
        </div>
        <div class="hero-actions"><a class="btn small primary" href="#/project/${p.id}">Open project</a></div>
      </article>`).join('');
    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / Projects</div>
      <h1>Live projects</h1>
      <p class="sub" style="color:var(--muted);max-width:65ch">Longer, open-ended tasks. Each one is graded against
      the real state of your files or the real output of your program — there is no answer key to guess.</p>
      <div class="grid">${cards}</div>`;
  }

  function viewProject(projectId) {
    const p = findProject(projectId);
    if (!p) return viewNotFound();
    const done = Store.labTasks(p.id, 'project');
    const pct = Math.round((done.filter(Boolean).length / p.lab.tasks.length) * 100);

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / <a href="#/projects">Projects</a> / ${esc(p.title)}</div>
      <div class="page-head">
        <div>
          <h1>${p.icon} ${esc(p.title)}</h1>
          <p class="sub">${esc(p.summary)}</p>
          <div class="meta" style="margin-top:10px">
            <span class="pill">${esc(p.course)}</span>
            <span class="pill">${p.minutes} min</span>
            <span class="pill">${pct}% complete</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn small ghost" id="resetProject">Reset project</button>
        </div>
      </div>
      <div class="progress-row" style="margin-bottom:18px">
        <div class="bar"><i style="width:${pct}%"></i></div><span>${pct}%</span>
      </div>
      <section class="module" style="margin-bottom:20px">
        <h4>What good looks like</h4>
        <ul style="margin:0;padding:16px 18px 16px 34px;color:#cfd8f2;font-size:14px">
          ${p.rubric.map(r => `<li style="margin:5px 0">${esc(r)}</li>`).join('')}
        </ul>
      </section>
      <div id="labMount"></div>`;

    $('#resetProject').addEventListener('click', () => {
      delete Store.labs[Store.key(p.id, 'project')];
      Store.save();
      toast('Project reset');
      viewProject(p.id);
    });

    mountLab($('#labMount'), p.lab, p.id, 'project');
  }

  /* ---------------- offline ---------------- */
  async function viewOffline() {
    const rows = [];
    for (const c of CATALOG.courses) {
      rows.push(`<tr><td>${esc(c.title)}</td><td>${(await Packs.isCached(c.id)) ? 'cached ✓' : 'not cached'}</td>
        <td><button class="btn small ghost" data-download="${c.id}">Cache now</button></td></tr>`);
    }
    let usage = 'unknown', quota = 'unknown';
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        usage = fmtBytes(est.usage);
        quota = fmtBytes(est.quota);
      } catch (e) { /* ignore */ }
    }
    const pyReady = window.PyLab && window.PyLab.isReady();

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / Offline &amp; storage</div>
      <h1>Offline &amp; storage</h1>
      <p style="color:var(--muted);max-width:65ch">LabDeck is a static site. Everything it needs is downloaded
      once, verified, and reused from local storage — so lessons and labs keep working without a connection.</p>
      <dl class="kv">
        <dt>Progress store</dt><dd>localStorage · ${LS_PROGRESS}</dd>
        <dt>Lab state</dt><dd>localStorage · ${LS_LABS}</dd>
        <dt>Quiz scores</dt><dd>localStorage · ${LS_QUIZ}</dd>
        <dt>XP &amp; streak</dt><dd>localStorage · labdeck.game.v1</dd>
        <dt>Course packs</dt><dd>Cache Storage · ${PACK_CACHE}</dd>
        <dt>Python runtime</dt><dd>${pyReady ? 'loaded in this session' : 'downloaded on first Run, then cached'}</dd>
        <dt>Storage used</dt><dd>${usage} of ${quota}</dd>
      </dl>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:var(--muted)">
          <th style="padding:10px 0;border-bottom:1px solid var(--line)">Course pack</th>
          <th style="border-bottom:1px solid var(--line)">Status</th>
          <th style="border-bottom:1px solid var(--line)">Action</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <div class="hero-actions" style="margin-top:22px">
        <button class="btn primary" id="dlAll">Download all course packs</button>
        <button class="btn ghost" id="clearCache">Clear cached packs</button>
        <button class="btn ghost" id="clearProgress">Clear progress</button>
      </div>
      <div class="notice" id="swNotice">Service worker: checking…</div>`;

    app.querySelectorAll('[data-download]').forEach(b =>
      b.addEventListener('click', () => downloadCourse(b.dataset.download, b)));
    $('#dlAll').addEventListener('click', async () => {
      for (const c of CATALOG.courses) await Packs.get(c.id, true);
      toast('All packs cached and verified');
      viewOffline();
    });
    $('#clearCache').addEventListener('click', async () => {
      await Packs.clear();
      toast('Cached packs cleared');
      viewOffline();
    });
    $('#clearProgress').addEventListener('click', () => {
      localStorage.removeItem(LS_PROGRESS);
      localStorage.removeItem(LS_LABS);
      localStorage.removeItem(LS_QUIZ);
      localStorage.removeItem('labdeck.game.v1');
      Store.progress = {}; Store.labs = {}; Store.quiz = {};
      G.Game.state = { xp: 0, streak: 0, lastDay: '', dailyDone: '', experience: G.Game.state.experience, onboarded: true };
      G.Game.save();
      updateHeader();
      toast('Progress cleared');
      viewOffline();
    });

    const notice = $('#swNotice');
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        notice.innerHTML = reg
          ? '<strong>Service worker active.</strong> The app shell is cached, so the site opens offline.'
          : '<strong>Service worker not registered yet.</strong> Serve the site over http://localhost or https:// for offline support.';
      } catch (e) {
        notice.innerHTML = '<strong>Service worker unavailable.</strong> Serve over http://localhost or https:// to enable offline mode.';
      }
    } else {
      notice.innerHTML = '<strong>Service worker not supported</strong> in this browser. Course packs are still cached.';
    }
  }

  /* ---------------- security ---------------- */
  async function viewSecurity() {
    const tests = S.selfTest();
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const pins = S.getPins();
    const secure = window.isSecureContext;

    const rows = tests.map(t => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid var(--line)">${esc(t.name)}</td>
        <td style="border-bottom:1px solid var(--line);color:${t.pass ? 'var(--accent)' : 'var(--danger)'}">
          ${t.pass ? 'pass' : 'FAIL'}</td>
      </tr>`).join('');

    const pinRows = CATALOG.courses.map(c => {
      const h = pins[c.id];
      return `<tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">${esc(c.title)}</td>
        <td style="border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--muted)">
          ${h ? esc(h.slice(0, 24)) + '…' : 'not pinned yet'}</td></tr>`;
    }).join('');

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Courses</a> / Security</div>
      <h1>Security verification</h1>
      <p style="color:var(--muted);max-width:65ch">Everything below is checked live in this browser, right now —
      not a claim in a document.</p>

      <h2 style="font-size:18px;margin-top:26px">Controls</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>
          <tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">Content-Security-Policy meta tag</td>
              <td style="border-bottom:1px solid var(--line);color:${csp ? 'var(--accent)' : 'var(--danger)'}">
              ${csp ? 'present' : 'missing'}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">Secure context (https / localhost)</td>
              <td style="border-bottom:1px solid var(--line);color:${secure ? 'var(--accent)' : 'var(--warn)'}">
              ${secure ? 'yes' : 'no — crypto.subtle and service workers unavailable'}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">Course pack integrity (SHA-256 pins)</td>
              <td style="border-bottom:1px solid var(--line);color:var(--accent)">
              ${Object.keys(pins).length} pinned</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">Shell input limit</td>
              <td style="border-bottom:1px solid var(--line)">${S.MAX_COMMAND} characters, control chars rejected</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid var(--line)">Python code limit</td>
              <td style="border-bottom:1px solid var(--line)">${S.MAX_CODE} characters, runtime-escape blocklist</td></tr>
        </tbody>
      </table>

      <h2 style="font-size:18px;margin-top:30px">Live self-tests</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${rows}</tbody></table>

      <h2 style="font-size:18px;margin-top:30px">Pinned pack hashes</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${pinRows}</tbody></table>

      <div class="hero-actions" style="margin-top:22px">
        <button class="btn ghost" id="rePin">Re-pin hashes from current content</button>
      </div>

      <div class="notice">
        <strong>What this does and does not protect.</strong> The sanitizer stops course content from injecting
        markup or script; the pins detect a tampered or swapped course pack; the guards bound what lab input can do.
        The Python runtime needs <code>'unsafe-eval'</code> in the CSP to initialise WebAssembly, so the CSP is
        strict everywhere else (<code>object-src 'none'</code>, <code>base-uri 'none'</code>,
        <code>form-action 'none'</code>, no third-party origins except the pinned CDN). This is a learning sandbox,
        not a security boundary for hostile code.
      </div>`;

    $('#rePin').addEventListener('click', () => {
      S.clearPins();
      Packs.mem = {};
      toast('Pins cleared — hashes will be re-pinned on next load');
      viewSecurity();
    });
  }

  function viewNotFound() {
    app.innerHTML = `<h1>Not found</h1><p><a href="#/">Back to courses</a></p>`;
  }

  /* ---------------- router ---------------- */
  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    window.scrollTo({ top: 0 });

    // First run: everything funnels through onboarding, except the utility pages.
    const utility = ['security', 'offline', 'start'].includes(parts[0]);
    if (!G.Game.state.onboarded && !utility) return viewStart();

    if (parts.length === 0) return viewHome();
    if (parts[0] === 'start') return viewStart();
    if (parts[0] === 'course' && parts[1]) return viewCourse(parts[1]);
    if (parts[0] === 'lesson' && parts[1] && parts[2]) return viewLesson(parts[1], parts[2]);
    if (parts[0] === 'mission' && parts[1]) return viewMission(parts[1]);
    if (parts[0] === 'daily') return viewDaily();
    if (parts[0] === 'projects') return viewProjects();
    if (parts[0] === 'project' && parts[1]) return viewProject(parts[1]);
    if (parts[0] === 'offline') return viewOffline();
    if (parts[0] === 'security') return viewSecurity();
    return viewNotFound();
  }

  /* ---------------- boot ---------------- */
  Store.init();
  G.Game.load();
  window.addEventListener('hashchange', route);
  route();
  updateBadge();
  updateHeader();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
    });
  }
})();
