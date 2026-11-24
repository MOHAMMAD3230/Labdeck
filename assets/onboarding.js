/* LabDeck onboarding + game layer.
 *
 * - First-run flow: one question, then straight into Ticket #001.
 * - Game state: XP, streak, level, experience level (localStorage, validated on read).
 * - Daily challenge: deterministic from the date, drawn from the course content.
 * - Ticket framing: every lab is an incident with an ID and a symptom.
 */
(function () {
  'use strict';

  const S = window.Security;
  const LS_GAME = 'labdeck.game.v1';
  const EXPERIENCE = ['never', 'little', 'daily'];

  /* ---------------- dates ---------------- */
  function isoDay(offset) {
    const d = new Date(Date.now() + (offset || 0) * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const today = () => isoDay(0);
  const yesterday = () => isoDay(-1);

  /* ---------------- game state ---------------- */
  const Game = {
    state: { xp: 0, streak: 0, lastDay: '', dailyDone: '', experience: '', onboarded: false },

    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(LS_GAME)); } catch (e) { raw = null; }
      if (raw && typeof raw === 'object') {
        const num = (v, max) => (Number.isFinite(v) && v >= 0 && v <= max ? Math.floor(v) : 0);
        const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
        this.state.xp = num(raw.xp, 1e6);
        this.state.streak = num(raw.streak, 9999);
        this.state.lastDay = day(raw.lastDay);
        this.state.dailyDone = day(raw.dailyDone);
        this.state.experience = EXPERIENCE.includes(raw.experience) ? raw.experience : '';
        this.state.onboarded = raw.onboarded === true;
      }
      return this.state;
    },

    save() {
      try { localStorage.setItem(LS_GAME, JSON.stringify(this.state)); } catch (e) { /* quota */ }
    },

    addXp(n) {
      this.state.xp = Math.min(1e6, this.state.xp + n);
      this.save();
    },

    /** Called on any completion event. Returns true when the streak advanced. */
    touchDay() {
      const t = today();
      if (this.state.lastDay === t) return false;
      this.state.streak = this.state.lastDay === yesterday() ? Math.min(9999, this.state.streak + 1) : 1;
      this.state.lastDay = t;
      this.save();
      return true;
    },

    dailyDoneToday() { return this.state.dailyDone === today(); },
    completeDaily() { this.state.dailyDone = today(); this.save(); },
    level() { return Math.floor(this.state.xp / 250) + 1; },
    levelProgress() { return (this.state.xp % 250) / 250; },

    setExperience(exp) {
      this.state.experience = EXPERIENCE.includes(exp) ? exp : 'never';
      this.state.onboarded = true;
      this.touchDay();
      this.save();
    }
  };

  /* ---------------- ticket framing ---------------- */
  const TICKETS = {
    'linux:l3': { id: '#1001', symptom: 'You are logged into a new box and cannot find your bearings.' },
    'linux:l5': { id: '#1002', symptom: 'The project layout is a mess — nothing is where it should be.' },
    'linux:l7': { id: '#1003', symptom: 'Something is failing in production and the log is 40,000 lines long.' },
    'linux:l9': { id: '#1004', symptom: 'The deploy script will not run. "Permission denied."' },
    'linux:l11': { id: '#1005', symptom: 'The box is at 98% CPU and nobody knows why.' },
    'linux:l13': { id: '#1006', symptom: 'Backups are done by hand. Automate them.' },
    'python:p3': { id: '#2001', symptom: 'A report has to be generated from three variables.' },
    'python:p5': { id: '#2002', symptom: 'The test suite prints the wrong numbers for 1–15.' },
    'python:p7': { id: '#2003', symptom: 'The same area calculation is copy-pasted in nine places.' },
    'python:p9': { id: '#2004', symptom: 'Nobody knows which words appear most often in the tickets.' },
    'python:p11': { id: '#2005', symptom: 'The log parser crashes on a missing field.' },
    'python:p13': { id: '#2006', symptom: 'Two counters share state — they should not.' }
  };

  function ticketFor(courseId, lessonId) {
    return TICKETS[courseId + ':' + lessonId] || null;
  }

  /* ---------------- first mission ---------------- */
  const MISSIONS = [
    {
      id: 'first',
      ticket: '#001',
      title: 'Your first fix',
      symptom: 'The deploy script will not run. "Permission denied."',
      minutes: 3,
      lab: {
        type: 'terminal',
        brief: 'Three commands. The script is there — it just is not executable yet.',
        setup: { cwd: '/home/student' },
        tasks: [
          { text: 'See what is in the directory: <code>ls</code>', check: s => s.history.some(c => /^ls\b/.test(c)) },
          { text: 'Look at the script: <code>cat deploy.sh</code>', check: s => s.history.some(c => /^cat\s+deploy\.sh$/.test(c)) },
          { text: 'Make it executable: <code>chmod 755 deploy.sh</code>', check: s => s.mode('/home/student/deploy.sh') === '755' }
        ]
      }
    }
  ];

  function missionById(id) {
    return MISSIONS.find(m => m.id === id) || null;
  }

  /* ---------------- next best action ---------------- */
  function nextAction(isDone) {
    const exp = Game.state.experience;
    const candidates = [];
    for (const course of window.CATALOG.courses) {
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          if (isDone(course.id, lesson.id)) continue;
          candidates.push({ course, module: mod, lesson });
        }
      }
    }
    if (!candidates.length) return null;
    if (exp === 'daily' || exp === 'little') {
      const lab = candidates.find(c => c.lesson.kind === 'lab');
      if (lab) return lab;
    }
    return candidates[0];
  }

  /* ---------------- daily challenge ---------------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  const MICRO = [
    {
      id: 'errors', title: 'Count the errors',
      brief: 'Production is noisy. Count how many <code>ERROR</code> lines are in <code>/var/log/app.log</code> — in one pipeline.',
      tasks: [
        { text: 'Use <code>grep ERROR /var/log/app.log | wc -l</code>', check: s => s.history.some(c => /grep\s+ERROR.*\|\s*wc\s+-l/.test(c)) }
      ]
    },
    {
      id: 'runaway', title: 'Stop the runaway process',
      brief: 'Something is eating the CPU. Find it with <code>ps</code> and stop it.',
      tasks: [
        { text: 'List processes with <code>ps</code>', check: s => s.history.some(c => /^ps\b/.test(c)) },
        { text: 'Kill PID <code>4242</code>', check: s => !s.processes.some(p => p.pid === 4242) }
      ]
    },
    {
      id: 'note', title: 'Write a file without an editor',
      brief: 'Create <code>note.txt</code> in your home directory containing the word <code>hello</code>.',
      tasks: [
        { text: 'Use <code>echo hello &gt; note.txt</code>', check: s => /hello/.test(s.read('/home/student/note.txt') || '') }
      ]
    },
    {
      id: 'tail', title: 'Read the last lines',
      brief: 'Show the last three lines of <code>/var/log/app.log</code>.',
      tasks: [
        { text: 'Use <code>tail -3 /var/log/app.log</code>', check: s => s.history.some(c => /^tail\s+-3\b/.test(c)) }
      ]
    },
    {
      id: 'tree', title: 'Build a directory tree',
      brief: 'Create <code>work/src</code> in one command.',
      tasks: [
        { text: 'Use <code>mkdir -p work/src</code>', check: s => s.isDir('/home/student/work/src') }
      ]
    }
  ];

  function daily() {
    const key = today();
    const pool = [];
    for (const course of window.CATALOG.courses) {
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          if (!lesson.quiz) continue;
          for (const q of lesson.quiz.questions) pool.push({ kind: 'quiz', q, source: course.title });
        }
      }
    }
    for (const m of MICRO) pool.push({ kind: 'terminal', micro: m, source: 'Linux lab' });
    const pick = pool[hash(key) % pool.length];
    return { key, pick };
  }

  function renderQuestion(el, question, onDone) {
    el.innerHTML = `
      <div class="daily-q">
        <p class="dq">${S.sanitizeHTML(question.q)}</p>
        <div class="choices" data-choices>
          ${question.options.map((o, i) => `<button type="button" class="choice" data-i="${i}">${S.sanitizeHTML(o)}</button>`).join('')}
        </div>
        <p class="dq-explain" data-explain hidden></p>
      </div>`;

    const choices = el.querySelector('[data-choices]');
    const explain = el.querySelector('[data-explain]');
    let answered = false;

    choices.addEventListener('click', e => {
      const btn = e.target.closest('.choice');
      if (!btn || answered) return;
      answered = true;
      const picked = Number(btn.dataset.i);
      const correct = picked === question.answer;
      choices.querySelectorAll('.choice').forEach((b, i) => {
        b.disabled = true;
        if (i === question.answer) b.classList.add('right');
        else if (i === picked) b.classList.add('wrong');
      });
      explain.hidden = false;
      explain.innerHTML = (correct ? '<strong>Correct.</strong> ' : '<strong>Not this time.</strong> ') +
        S.sanitizeHTML(question.explain || '');
      if (onDone) onDone(correct);
    });
  }

  function renderDaily(el, pick, onDone) {
    if (pick.kind === 'quiz') {
      renderQuestion(el, pick.q, onDone);
      return;
    }
    const lab = pick.micro;
    el.innerHTML = `<p class="lab-brief">${S.sanitizeHTML(lab.brief)}</p><div data-lab></div>`;
    window.TerminalLab.mount(el.querySelector('[data-lab]'), lab, {
      done: [],
      onTask: () => {},
      onComplete: () => { if (onDone) onDone(true); }
    });
  }

  /* ---------------- first-run screen ---------------- */
  function typeLines(el, lines, done) {
    let index = 0;
    function nextLine() {
      if (index >= lines.length) { if (done) done(); return; }
      const spec = lines[index++];
      const div = document.createElement('div');
      if (spec.cls) div.className = spec.cls;
      el.appendChild(div);
      let ci = 0;
      const speed = spec.instant ? 0 : 24;
      (function tick() {
        div.textContent = spec.text.slice(0, ++ci);
        el.scrollTop = el.scrollHeight;
        if (ci < spec.text.length) setTimeout(tick, speed);
        else setTimeout(nextLine, spec.pause || 200);
      })();
    }
    nextLine();
  }

  function renderStart(container, onDone) {
    container.innerHTML = `
      <section class="onboard">
        <p class="kicker">TICKET #001 · OPEN</p>
        <h1>Two minutes to your <em>first fix</em>.</h1>
        <p class="lead">No videos, no slides. A real shell, a broken script, and one command that makes it work.</p>

        <div class="term demo">
          <div class="term-bar"><i class="r"></i><i class="y"></i><i class="g"></i><span>student@labdeck — bash</span></div>
          <div class="term-out" data-demo></div>
        </div>

        <div class="onboard-q">
          <p>Before we start — have you used a terminal before?</p>
          <div class="choices" data-exp>
            <button type="button" class="choice" data-v="never">Never</button>
            <button type="button" class="choice" data-v="little">A little</button>
            <button type="button" class="choice" data-v="daily">Every day</button>
          </div>
          <p class="onboard-note">This only changes where you start. You can change it later.</p>
        </div>
      </section>`;

    const demo = container.querySelector('[data-demo]');
    typeLines(demo, [
      { text: '$ cat mission.txt', cls: 'cmd' },
      { text: 'TICKET #001 — the deploy script will not run.' },
      { text: 'Nobody can execute it. Fix it before 09:00.' },
      { text: '' },
      { text: '$ chmod 755 deploy.sh', cls: 'cmd' },
      { text: '✔ deploy.sh is now executable', cls: 'ok' },
      { text: '' },
      { text: 'That took one command. There are 12 labs like it.', cls: 'ok' }
    ]);

    container.querySelector('[data-exp]').addEventListener('click', e => {
      const btn = e.target.closest('.choice');
      if (!btn) return;
      Game.setExperience(btn.dataset.v);
      if (onDone) onDone(btn.dataset.v);
    });
  }

  window.Onboarding = { Game, nextAction, ticketFor, missionById, daily, renderDaily, renderStart, renderQuestion };
})();
