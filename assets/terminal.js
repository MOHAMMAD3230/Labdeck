/* LabDeck — a small, safe, in-browser Linux shell used by the live labs and projects.
 * Everything runs against an in-memory virtual filesystem; no command can reach the
 * real machine. Input is length/character-checked by Security.guardCommand(). */
(function () {
  'use strict';

  const HOME = '/home/student';
  const MAX_DEPTH = 3;

  /* ---------- filesystem ---------- */
  const file = (content, mode) => ({ type: 'file', content: content || '', mode: mode || '644' });
  const dir = (children) => ({ type: 'dir', children: children || {}, mode: '755' });

  const APP_LOG = [
    '2026-11-24T08:00:01Z INFO  boot: starting app',
    '2026-11-24T08:00:02Z INFO  db: connected',
    '2026-11-24T08:01:12Z ERROR db: connection timeout',
    '2026-11-24T08:02:44Z INFO  http: GET /health 200',
    '2026-11-24T08:03:01Z WARN  cache: miss ratio 0.42',
    '2026-11-24T08:04:19Z ERROR http: GET /api/items 500',
    '2026-11-24T08:05:00Z INFO  http: GET / 200',
    '2026-11-24T08:06:31Z ERROR db: connection timeout'
  ].join('\n') + '\n';

  function baseFs() {
    return dir({
      home: dir({
        student: dir({
          'welcome.txt': file('Welcome to LabDeck.\nTry: ls, pwd, cat welcome.txt, help\n'),
          'deploy.sh': file('#!/bin/sh\necho deploying...\n', '644'),
          'secrets.env': file('API_KEY=not-a-real-key\n', '644'),
          '.bashrc': file('export PS1="\\u@labdeck:\\w$ "\n')
        })
      }),
      etc: dir({
        hostname: file('labdeck\n'),
        'os-release': file('NAME="LabDeck Linux"\nVERSION="1.0 (lab)"\nID=labdeck\n')
      }),
      var: dir({ log: dir({ syslog: file('boot: ok\nkernel: lab mode\n'), 'app.log': file(APP_LOG) }) }),
      tmp: dir({}),
      usr: dir({ bin: dir({}), local: dir({}) })
    });
  }

  function normalize(p, cwd) {
    if (!p) p = cwd;
    if (p === '~') p = HOME;
    if (p.startsWith('~/')) p = HOME + p.slice(1);
    const parts = (p.startsWith('/') ? p : cwd + '/' + p).split('/');
    const out = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return '/' + out.join('/');
  }

  function nodeAt(root, path) {
    if (path === '/') return root;
    let cur = root;
    for (const part of path.split('/').filter(Boolean)) {
      if (!cur || cur.type !== 'dir' || !cur.children[part]) return null;
      cur = cur.children[part];
    }
    return cur;
  }

  function parentOf(root, path) {
    const idx = path.lastIndexOf('/');
    return { parent: nodeAt(root, idx <= 0 ? '/' : path.slice(0, idx)), name: path.slice(idx + 1) };
  }

  function mkdirp(root, path) {
    let cur = root;
    for (const part of path.split('/').filter(Boolean)) {
      if (!cur.children[part]) cur.children[part] = dir({});
      cur = cur.children[part];
      if (cur.type !== 'dir') return false;
    }
    return true;
  }

  function writeFile(root, path, content, append) {
    const { parent, name } = parentOf(root, path);
    if (!parent || parent.type !== 'dir') return 'No such file or directory';
    const existing = parent.children[name];
    if (existing && existing.type === 'dir') return 'Is a directory';
    parent.children[name] = file(append && existing ? existing.content + content : content, existing ? existing.mode : '644');
    return null;
  }

  /* ---------- parsing ---------- */
  function tokenize(line) {
    const out = [];
    let cur = '', q = null;
    for (const ch of line) {
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } continue; }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  function splitOn(line, target) {
    const parts = [];
    let cur = '', q = null;
    for (const ch of line) {
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === target) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  }

  function splitRedirect(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === '>') {
        const append = line[i + 1] === '>';
        return {
          cmd: line.slice(0, i).trim(),
          append,
          target: line.slice(i + (append ? 2 : 1)).trim()
        };
      }
    }
    return { cmd: line.trim(), append: false, target: null };
  }

  const HELP = [
    'LabDeck shell — supported commands:',
    '  pwd  ls [-l]  cd  cat  mkdir [-p]  touch  rm [-r]  cp  mv  echo',
    '  grep  head  tail  wc  sort  uniq  chmod  whoami  uname  date',
    '  ps  kill  df  free  uptime  hostname  sh  man  clear  help',
    'Pipes and redirection work: grep ERROR /var/log/app.log | wc -l',
    '                            echo hi > notes.txt, echo more >> notes.txt'
  ].join('\n');

  /* ---------- shell ---------- */
  function createShell(lab) {
    const root = baseFs();
    const state = {
      cwd: (lab && lab.setup && lab.setup.cwd) || HOME,
      history: [],
      lastOutput: '',
      processes: [
        { pid: 1, user: 'root', cpu: 0.0, mem: 0.1, cmd: '/sbin/init' },
        { pid: 812, user: 'student', cpu: 0.3, mem: 1.2, cmd: 'bash' },
        { pid: 4242, user: 'student', cpu: 98.4, mem: 62.1, cmd: 'python3 train.py' },
        { pid: 4301, user: 'student', cpu: 0.1, mem: 0.4, cmd: 'ps' }
      ]
    };

    const api = {
      get cwd() { return state.cwd; },
      get history() { return state.history; },
      get processes() { return state.processes; },
      get lastOutput() { return state.lastOutput; },
      exists: p => !!nodeAt(root, normalize(p, state.cwd)),
      isDir: p => { const n = nodeAt(root, normalize(p, state.cwd)); return !!n && n.type === 'dir'; },
      read: p => { const n = nodeAt(root, normalize(p, state.cwd)); return n && n.type === 'file' ? n.content : null; },
      mode: p => { const n = nodeAt(root, normalize(p, state.cwd)); return n ? n.mode : null; }
    };

    function readInput(args, stdin) {
      if (args.length) {
        const n = nodeAt(root, normalize(args[0], state.cwd));
        if (!n) return { err: `cannot read '${args[0]}': No such file or directory` };
        if (n.type === 'dir') return { err: `'${args[0]}': Is a directory` };
        return { text: n.content };
      }
      if (stdin != null) return { text: stdin };
      return { err: 'missing file operand' };
    }

    const commands = {
      help: () => ({ out: HELP }),
      clear: () => ({ clear: true }),
      pwd: () => ({ out: state.cwd }),
      whoami: () => ({ out: 'student' }),
      hostname: () => ({ out: 'labdeck' }),
      uname: () => ({ out: 'Linux labdeck 6.8.0-lab #1 SMP x86_64 GNU/Linux' }),
      date: () => ({ out: new Date().toString() }),
      uptime: () => ({ out: ' 09:14:02 up 3 days,  2:41,  1 user,  load average: 0.08, 0.12, 0.09' }),
      df: () => ({
        out: [
          'Filesystem      Size  Used Avail Use% Mounted on',
          '/dev/vda1        40G   12G   26G  32% /',
          'tmpfs           1.9G     0  1.9G   0% /dev/shm'
        ].join('\n')
      }),
      free: () => ({
        out: [
          '               total        used        free      shared  buff/cache',
          'Mem:           3.8Gi       1.2Gi       1.1Gi        64Mi       1.5Gi',
          'Swap:          1.0Gi          0B       1.0Gi'
        ].join('\n')
      }),
      ls: (a) => {
        const long = a.some(x => /^-[a-z]*l[a-z]*$/.test(x));
        const all = a.some(x => /^-[a-z]*a[a-z]*$/.test(x));
        const target = a.find(x => !x.startsWith('-')) || '.';
        const node = nodeAt(root, normalize(target, state.cwd));
        if (!node) return { err: `ls: cannot access '${target}': No such file or directory` };
        if (node.type === 'file') return { out: long ? `-rw-r--r-- 1 student student ${String(node.content.length).padStart(5)} ${target}` : target };
        let names = Object.keys(node.children);
        if (!all) names = names.filter(n => !n.startsWith('.'));
        if (!long) return { out: names.sort().join('  ') };
        const rows = names.sort().map(n => {
          const c = node.children[n];
          const m = c.type === 'dir' ? 'drwxr-xr-x'
            : c.mode === '755' ? '-rwxr-xr-x'
            : c.mode === '600' ? '-rw-------'
            : '-rw-r--r--';
          return `${m} 1 student student ${String(c.type === 'file' ? c.content.length : 4096).padStart(5)} ${n}${c.type === 'dir' ? '/' : ''}`;
        });
        return { out: ['total ' + names.length].concat(rows).join('\n') };
      },
      cd: (a) => {
        const target = a[0] || HOME;
        const path = normalize(target, state.cwd);
        const node = nodeAt(root, path);
        if (!node) return { err: `cd: ${target}: No such file or directory` };
        if (node.type !== 'dir') return { err: `cd: ${target}: Not a directory` };
        state.cwd = path;
        return {};
      },
      cat: (a, stdin) => {
        if (!a.length) return stdin != null ? { out: stdin } : { err: 'cat: missing operand' };
        const out = [];
        for (const t of a) {
          const n = nodeAt(root, normalize(t, state.cwd));
          if (!n) return { err: `cat: ${t}: No such file or directory` };
          if (n.type === 'dir') return { err: `cat: ${t}: Is a directory` };
          out.push(n.content);
        }
        return { out: out.join('') };
      },
      mkdir: (a) => {
        const p = a.includes('-p');
        const targets = a.filter(x => !x.startsWith('-'));
        if (!targets.length) return { err: 'mkdir: missing operand' };
        for (const t of targets) {
          const path = normalize(t, state.cwd);
          if (nodeAt(root, path)) return { err: `mkdir: cannot create directory '${t}': File exists` };
          if (p) mkdirp(root, path);
          else {
            const { parent, name } = parentOf(root, path);
            if (!parent || parent.type !== 'dir') return { err: `mkdir: cannot create directory '${t}': No such file or directory` };
            parent.children[name] = dir({});
          }
        }
        return {};
      },
      touch: (a) => {
        if (!a.length) return { err: 'touch: missing file operand' };
        for (const t of a) {
          const path = normalize(t, state.cwd);
          if (!nodeAt(root, path)) {
            const e = writeFile(root, path, '');
            if (e) return { err: `touch: cannot touch '${t}': ${e}` };
          }
        }
        return {};
      },
      echo: (a) => ({ out: a.join(' ') }),
      rm: (a) => {
        const recursive = a.some(x => /^-[rf]+$/.test(x));
        const targets = a.filter(x => !x.startsWith('-'));
        if (!targets.length) return { err: 'rm: missing operand' };
        for (const t of targets) {
          const path = normalize(t, state.cwd);
          const n = nodeAt(root, path);
          if (!n) return { err: `rm: cannot remove '${t}': No such file or directory` };
          if (n.type === 'dir' && !recursive) return { err: `rm: cannot remove '${t}': Is a directory` };
          const { parent, name } = parentOf(root, path);
          delete parent.children[name];
        }
        return {};
      },
      cp: (a) => {
        const args = a.filter(x => !x.startsWith('-'));
        if (args.length < 2) return { err: 'cp: missing destination file operand' };
        const src = nodeAt(root, normalize(args[0], state.cwd));
        if (!src || src.type !== 'file') return { err: `cp: cannot stat '${args[0]}': No such file or directory` };
        let destPath = normalize(args[1], state.cwd);
        const destNode = nodeAt(root, destPath);
        if (destNode && destNode.type === 'dir') destPath = destPath + '/' + args[0].split('/').pop();
        const e = writeFile(root, destPath, src.content, false);
        return e ? { err: `cp: ${e}` } : {};
      },
      mv: (a) => {
        const args = a.filter(x => !x.startsWith('-'));
        if (args.length < 2) return { err: 'mv: missing destination file operand' };
        const srcPath = normalize(args[0], state.cwd);
        const src = nodeAt(root, srcPath);
        if (!src) return { err: `mv: cannot stat '${args[0]}': No such file or directory` };
        let destPath = normalize(args[1], state.cwd);
        const destNode = nodeAt(root, destPath);
        if (destNode && destNode.type === 'dir') destPath = destPath + '/' + args[0].split('/').pop();
        if (src.type === 'file') {
          const e = writeFile(root, destPath, src.content, false);
          if (e) return { err: `mv: ${e}` };
        } else {
          mkdirp(root, destPath);
          Object.assign(nodeAt(root, destPath).children, src.children);
        }
        const { parent, name } = parentOf(root, srcPath);
        if (parent) delete parent.children[name];
        return {};
      },
      grep: (a, stdin) => {
        const args = a.filter(x => !x.startsWith('-'));
        if (!args.length) return { err: 'usage: grep PATTERN [FILE]' };
        const input = readInput(args.slice(1), stdin);
        if (input.err) return { err: `grep: ${input.err}` };
        return { out: input.text.split('\n').filter(l => l.includes(args[0])).join('\n') };
      },
      head: (a, stdin) => {
        const n = parseInt((a.find(x => /^-\d+$/.test(x)) || '-10').slice(1), 10);
        const input = readInput(a.filter(x => !x.startsWith('-')), stdin);
        if (input.err) return { err: `head: ${input.err}` };
        return { out: input.text.split('\n').slice(0, n).join('\n') };
      },
      tail: (a, stdin) => {
        const n = parseInt((a.find(x => /^-\d+$/.test(x)) || '-10').slice(1), 10);
        const input = readInput(a.filter(x => !x.startsWith('-')), stdin);
        if (input.err) return { err: `tail: ${input.err}` };
        return { out: input.text.replace(/\n$/, '').split('\n').slice(-n).join('\n') };
      },
      wc: (a, stdin) => {
        const linesOnly = a.includes('-l');
        const input = readInput(a.filter(x => !x.startsWith('-')), stdin);
        if (input.err) return { err: `wc: ${input.err}` };
        const text = input.text;
        const lines = text.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === '')).length;
        if (linesOnly) return { out: String(lines) };
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        return { out: `${lines} ${words} ${text.length}` };
      },
      sort: (a, stdin) => {
        const input = readInput(a.filter(x => !x.startsWith('-')), stdin);
        if (input.err) return { err: `sort: ${input.err}` };
        return { out: input.text.replace(/\n$/, '').split('\n').sort().join('\n') };
      },
      uniq: (a, stdin) => {
        const input = readInput(a.filter(x => !x.startsWith('-')), stdin);
        if (input.err) return { err: `uniq: ${input.err}` };
        const lines = input.text.replace(/\n$/, '').split('\n');
        return { out: lines.filter((l, i) => i === 0 || l !== lines[i - 1]).join('\n') };
      },
      chmod: (a) => {
        const args = a.filter(x => !x.startsWith('-'));
        if (args.length < 2) return { err: 'chmod: missing operand' };
        const mode = args[0];
        if (!/^[0-7]{3,4}$/.test(mode)) return { err: `chmod: invalid mode: '${mode}'` };
        for (const t of args.slice(1)) {
          const n = nodeAt(root, normalize(t, state.cwd));
          if (!n) return { err: `chmod: cannot access '${t}': No such file or directory` };
          n.mode = mode.slice(-3);
        }
        return {};
      },
      ps: () => {
        const head = '  PID USER     %CPU  %MEM  COMMAND';
        const rows = state.processes.map(p =>
          `${String(p.pid).padStart(5)} ${p.user.padEnd(8)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)}  ${p.cmd}`);
        return { out: [head].concat(rows).join('\n') };
      },
      kill: (a) => {
        const pid = parseInt(a.find(x => /^\d+$/.test(x)), 10);
        if (!pid) return { err: 'kill: usage: kill PID' };
        const idx = state.processes.findIndex(p => p.pid === pid);
        if (idx === -1) return { err: `kill: (${pid}) - No such process` };
        const [p] = state.processes.splice(idx, 1);
        return { out: `[${p.pid}] terminated  ${p.cmd}` };
      },
      sh: (a) => {
        const target = a.find(x => !x.startsWith('-'));
        if (!target) return { err: 'sh: usage: sh FILE' };
        return runScript(target, 0);
      },
      man: (a) => ({ out: a.length ? `${a[0]}(1) — LabDeck builtin. Try: help` : 'What manual page do you want?' }),
      sudo: () => ({ err: 'sudo: this lab shell runs as the unprivileged user "student"' }),
      python3: () => ({ err: 'python3: not installed in this lab — use the Python course labs instead' }),
      curl: () => ({ err: 'curl: network access is disabled in the lab sandbox' }),
      ssh: () => ({ err: 'ssh: network access is disabled in the lab sandbox' })
    };

    function modeString(mode) {
      const m = mode || '644';
      const d = parseInt(m[0], 10);
      return (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-');
    }

    function runScript(target, depth) {
      if (depth > MAX_DEPTH) return { err: 'sh: maximum script nesting depth reached' };
      const path = normalize(target, state.cwd);
      const node = nodeAt(root, path);
      if (!node || node.type !== 'file') return { err: `sh: ${target}: No such file or directory` };
      if (!/x/.test(modeString(node.mode))) return { err: `sh: ${target}: Permission denied` };
      const out = [];
      for (const raw of node.content.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const res = execLine(line, depth + 1);
        if (res.err) { out.push(res.err); break; }
        if (res.out) out.push(res.out);
      }
      return { out: out.join('\n') };
    }

    function execLine(line, depth) {
      const { cmd, append, target } = splitRedirect(line);
      const segments = splitOn(cmd, '|');
      let stdin = null;
      let res = {};
      for (const seg of segments) {
        const tokens = tokenize(seg.trim());
        if (!tokens.length) continue;
        let name = tokens[0];
        let args = tokens.slice(1);
        if (name.startsWith('./')) { args = [name.slice(2)]; name = 'sh'; }
        const fn = commands[name];
        if (!fn) { res = { err: `${name}: command not found` }; break; }
        try { res = fn(args, stdin, depth) || {}; } catch (e) { res = { err: `${name}: ${e.message}` }; }
        if (res.err) break;
        stdin = res.out || '';
      }
      if (target && !res.err) {
        const path = normalize(target, state.cwd);
        const e = writeFile(root, path, (res.out || '') + '\n', append);
        if (e) return { err: `${target}: ${e}` };
        return { out: '' };
      }
      return res;
    }

    api.run = function (raw) {
      const line = String(raw || '').trim();
      if (!line) return { out: '' };
      state.history.push(line);
      const res = execLine(line, 0);
      state.lastOutput = res.out || '';
      return res;
    };

    return api;
  }

  /* ---------- UI ---------- */
  function promptFor(cwd) {
    const short = cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd;
    return `student@labdeck:${short}$`;
  }

  function mount(container, lab, opts) {
    opts = opts || {};
    const doneTasks = new Set(opts.done || []);
    const shell = createShell(lab);
    const S = window.Security;

    container.innerHTML = `
      <section class="lab">
        <div class="lab-head">
          <span class="dot"></span>
          <h3>Live terminal lab</h3>
          <span class="status" data-status>0 / ${lab.tasks.length} tasks</span>
        </div>
        <div class="lab-grid">
          <div class="lab-main">
            <p class="lab-brief">${S.sanitizeHTML(lab.brief || '')}</p>
            <div class="term">
              <div class="term-bar"><i class="r"></i><i class="y"></i><i class="g"></i><span>student@labdeck — bash</span></div>
              <div class="term-out" data-out></div>
              <form class="term-form" data-form>
                <span class="ps1" data-ps1></span>
                <input data-input autocomplete="off" autocapitalize="off" spellcheck="false"
                       maxlength="${S.MAX_COMMAND}" aria-label="Terminal input" />
              </form>
            </div>
          </div>
          <aside class="lab-side">
            <p class="side-title">Tasks</p>
            <ul class="tasks" data-tasks></ul>
          </aside>
        </div>
      </section>`;

    const out = container.querySelector('[data-out]');
    const input = container.querySelector('[data-input]');
    const ps1 = container.querySelector('[data-ps1]');
    const form = container.querySelector('[data-form]');
    const taskList = container.querySelector('[data-tasks]');
    const status = container.querySelector('[data-status]');

    function print(text, cls) {
      const div = document.createElement('div');
      if (cls) div.className = cls;
      div.textContent = text;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    function renderTasks() {
      taskList.innerHTML = lab.tasks.map((t, i) =>
        `<li class="${doneTasks.has(i) ? 'done' : ''}"><span class="box">✓</span><span>${S.sanitizeHTML(t.text)}</span></li>`).join('');
      status.textContent = `${doneTasks.size} / ${lab.tasks.length} tasks`;
    }

    function evaluate() {
      lab.tasks.forEach((t, i) => {
        if (doneTasks.has(i)) return;
        let ok = false;
        try { ok = !!t.check(shell); } catch (e) { ok = false; }
        if (ok) {
          doneTasks.add(i);
          print(`✔ task ${i + 1} complete`, 'ok');
          if (opts.onTask) opts.onTask(i, true);
        }
      });
      renderTasks();
      if (doneTasks.size === lab.tasks.length && opts.onComplete) opts.onComplete();
    }

    const syncPrompt = () => { ps1.textContent = promptFor(shell.cwd); };

    print('LabDeck Linux lab — type "help" for the command list.');
    print('');
    syncPrompt();
    renderTasks();

    let histIdx = -1;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const guard = S.guardCommand(input.value);
      const line = guard.ok ? guard.line : '';
      input.value = '';
      histIdx = -1;
      if (!guard.ok) { print(guard.reason, 'err'); return; }
      print(`${promptFor(shell.cwd)} ${line}`, 'cmd');
      const res = shell.run(line);
      if (res.clear) out.innerHTML = '';
      else {
        if (res.out) print(res.out);
        if (res.err) print(res.err, 'err');
      }
      syncPrompt();
      evaluate();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const h = shell.history;
        if (!h.length) return;
        histIdx = histIdx === -1 ? h.length - 1 : Math.max(0, histIdx - 1);
        input.value = h[histIdx];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx === -1) return;
        histIdx += 1;
        if (histIdx >= shell.history.length) { histIdx = -1; input.value = ''; }
        else input.value = shell.history[histIdx];
      }
    });

    container.addEventListener('click', e => { if (e.target.closest('.term')) input.focus(); });
    setTimeout(() => input.focus(), 60);
    return { shell, evaluate };
  }

  window.TerminalLab = { mount };
})();
