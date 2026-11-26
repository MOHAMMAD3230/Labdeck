/* LabDeck SQL lab — a small in-memory SQL engine.
 * Supports: SELECT (WHERE / GROUP BY / ORDER BY / LIMIT, COUNT SUM AVG MIN MAX),
 * INSERT, UPDATE, DELETE, .tables, .schema. No JOINs (see the course notes). */
(function () {
  'use strict';
  window.LabTypes = window.LabTypes || {};
  const S = window.Security;

  const HELP = [
    'Supported statements:',
    '  SELECT <cols> FROM <table> [WHERE cond] [GROUP BY col] [ORDER BY col [DESC]] [LIMIT n]',
    '  INSERT INTO <table> (cols) VALUES (values)',
    '  UPDATE <table> SET col = value [WHERE cond]',
    '  DELETE FROM <table> [WHERE cond]',
    '  .tables   list tables      .schema   show columns',
    'Aggregates: COUNT(*) COUNT(col) SUM(col) AVG(col) MIN(col) MAX(col)',
    'Operators:  =  !=  <>  >  <  >=  <=  LIKE \'%text%\'   (combine with AND)'
  ].join('\n');

  function splitTop(str, sep) {
    const out = [];
    let cur = '', q = null, depth = 0;
    for (const ch of str) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
  }

  function literal(tok) {
    const t = String(tok).trim();
    if (/^'.*'$/.test(t) || /^".*"$/.test(t)) return t.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    if (/^null$/i.test(t)) return null;
    return t;
  }

  function compare(a, op, b) {
    const o = String(op).toLowerCase();
    if (o === 'like') {
      const pattern = String(b)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      return new RegExp('^' + pattern + '$', 'i').test(String(a == null ? '' : a));
    }
    if (a === null || a === undefined || b === null) {
      return o === '=' ? a === b : (o === '!=' || o === '<>') ? a !== b : false;
    }
    switch (o) {
      case '=': return a == b;
      case '!=': case '<>': return a != b;
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      default: return false;
    }
  }

  function buildPredicate(expr) {
    const tests = [];
    for (const part of String(expr).split(/\s+and\s+/i)) {
      const m = part.match(/^\s*([A-Za-z_]\w*)\s*(>=|<=|!=|<>|=|>|<|like)\s*(.+?)\s*$/i);
      if (!m) return { error: `Cannot parse condition: ${part.trim()}` };
      tests.push({ col: m[1], op: m[2], val: literal(m[3]) });
    }
    return { fn: row => tests.every(t => compare(row[t.col], t.op, t.val)) };
  }

  function formatTable(cols, rows) {
    const cells = rows.map(r => cols.map(c => (r[c] === null || r[c] === undefined ? 'NULL' : String(r[c]))));
    const widths = cols.map((c, i) => Math.max(c.length, ...cells.map(r => r[i].length)));
    const line = vals => vals.map((v, i) => v.padEnd(widths[i])).join('  ');
    return [line(cols), widths.map(w => '-'.repeat(w)).join('  ')]
      .concat(cells.map(line)).join('\n');
  }

  function select(db, q) {
    const m = q.match(/^select\s+([\s\S]+?)\s+from\s+([A-Za-z_]\w*)([\s\S]*)$/i);
    if (!m) return { err: 'Syntax error. Use: SELECT <columns> FROM <table>' };
    const colSpec = m[1].trim();
    const tableName = m[2].toLowerCase();
    const rest = m[3] || '';
    const table = db.tables[tableName];
    if (!table) return { err: `no such table: ${m[2]}  (try .tables)` };

    const whereM = rest.match(/\bwhere\s+([\s\S]+?)(?=\bgroup\s+by\b|\border\s+by\b|\blimit\b|$)/i);
    const groupM = rest.match(/\bgroup\s+by\s+([A-Za-z_]\w*)/i);
    const orderM = rest.match(/\border\s+by\s+([A-Za-z_]\w*)(?:\s+(asc|desc))?/i);
    const limitM = rest.match(/\blimit\s+(\d+)/i);

    let rows = table.rows.map(r => Object.assign({}, r));
    if (whereM) {
      const pred = buildPredicate(whereM[1]);
      if (pred.error) return { err: pred.error };
      rows = rows.filter(pred.fn);
    }

    const aggs = [];
    const plain = [];
    for (const part of splitTop(colSpec, ',')) {
      const a = part.match(/^(count|sum|avg|min|max)\s*\(\s*(\*|[A-Za-z_]\w*)\s*\)$/i);
      if (a) aggs.push({ fn: a[1].toLowerCase(), col: a[2] === '*' ? '*' : a[2], label: part.replace(/\s+/g, '') });
      else plain.push(part);
    }

    function aggregate(group) {
      const row = {};
      for (const a of aggs) {
        const vals = a.col === '*' ? group : group.map(r => r[a.col]);
        if (a.fn === 'count') {
          row[a.label] = a.col === '*' ? group.length : vals.filter(v => v !== null && v !== undefined).length;
          continue;
        }
        const nums = vals.filter(v => typeof v === 'number');
        if (!nums.length) { row[a.label] = null; continue; }
        const sum = nums.reduce((x, y) => x + y, 0);
        if (a.fn === 'sum') row[a.label] = sum;
        else if (a.fn === 'avg') row[a.label] = Math.round((sum / nums.length) * 100) / 100;
        else if (a.fn === 'min') row[a.label] = Math.min(...nums);
        else row[a.label] = Math.max(...nums);
      }
      return row;
    }

    let outCols, outRows;

    if (groupM) {
      const key = groupM[1];
      const groups = new Map();
      for (const r of rows) {
        const k = r[key];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      outCols = [key].concat(aggs.map(a => a.label));
      outRows = Array.from(groups.entries()).map(([k, g]) => Object.assign({ [key]: k }, aggregate(g)));
    } else if (aggs.length) {
      outCols = aggs.map(a => a.label);
      outRows = [aggregate(rows)];
    } else {
      outCols = colSpec === '*' ? table.columns.slice() : plain;
      outRows = rows.map(r => {
        const o = {};
        for (const c of outCols) o[c] = r[c];
        return o;
      });
    }

    if (orderM) {
      const col = orderM[1];
      const dir = (orderM[2] || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      outRows.sort((a, b) => {
        const x = a[col], y = b[col];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x > y ? 1 : -1) * dir;
      });
    }
    if (limitM) outRows = outRows.slice(0, Number(limitM[1]));

    if (!outRows.length) return { out: '(0 rows)' };
    return { out: formatTable(outCols, outRows) + `\n\n(${outRows.length} row${outRows.length === 1 ? '' : 's'})` };
  }

  function insert(db, q) {
    const m = q.match(/^insert\s+into\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*values\s*\(([\s\S]*)\)$/i);
    if (!m) return { err: "Syntax error. Use: INSERT INTO t (a, b) VALUES (1, 'x')" };
    const t = db.tables[m[1].toLowerCase()];
    if (!t) return { err: `no such table: ${m[1]}` };
    const cols = m[2] ? splitTop(m[2], ',') : t.columns.slice();
    const vals = splitTop(m[3], ',').map(literal);
    if (cols.length !== vals.length) return { err: 'Column count does not match value count.' };
    const row = {};
    for (const c of t.columns) row[c] = null;
    cols.forEach((c, i) => { row[c] = vals[i]; });
    t.rows.push(row);
    return { out: '1 row inserted.' };
  }

  function update(db, q) {
    const m = q.match(/^update\s+([A-Za-z_]\w*)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+))?$/i);
    if (!m) return { err: 'Syntax error. Use: UPDATE t SET col = value WHERE ...' };
    const t = db.tables[m[1].toLowerCase()];
    if (!t) return { err: `no such table: ${m[1]}` };
    const sets = splitTop(m[2], ',').map(s => {
      const p = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      return p ? { col: p[1], val: literal(p[2]) } : null;
    });
    if (sets.some(s => !s)) return { err: 'Cannot parse SET clause.' };
    let pred = { fn: () => true };
    if (m[3]) {
      const p = buildPredicate(m[3]);
      if (p.error) return { err: p.error };
      pred = p;
    }
    let n = 0;
    for (const row of t.rows) if (pred.fn(row)) { for (const s of sets) row[s.col] = s.val; n++; }
    return { out: `${n} row${n === 1 ? '' : 's'} updated.` };
  }

  function del(db, q) {
    const m = q.match(/^delete\s+from\s+([A-Za-z_]\w*)(?:\s+where\s+([\s\S]+))?$/i);
    if (!m) return { err: 'Syntax error. Use: DELETE FROM t WHERE ...' };
    const t = db.tables[m[1].toLowerCase()];
    if (!t) return { err: `no such table: ${m[1]}` };
    let pred = { fn: () => true };
    if (m[2]) {
      const p = buildPredicate(m[2]);
      if (p.error) return { err: p.error };
      pred = p;
    }
    const before = t.rows.length;
    t.rows = t.rows.filter(r => !pred.fn(r));
    return { out: `${before - t.rows.length} row(s) deleted.` };
  }

  function exec(db, sql) {
    const q = String(sql || '').trim().replace(/;+\s*$/, '');
    if (!q) return { out: '' };
    const lower = q.toLowerCase();
    if (lower === 'help' || lower === '\\h') return { out: HELP };
    if (lower === '.tables' || lower === 'tables') return { out: Object.keys(db.tables).join('  ') };
    if (lower === '.schema' || lower === 'schema') {
      return { out: Object.entries(db.tables).map(([n, t]) => `${n}(${t.columns.join(', ')})`).join('\n') };
    }
    if (lower.startsWith('select')) return select(db, q);
    if (lower.startsWith('insert')) return insert(db, q);
    if (lower.startsWith('update')) return update(db, q);
    if (lower.startsWith('delete')) return del(db, q);
    return { err: 'Unsupported. Type help for the supported statements.' };
  }

  function defaultDb() {
    return {
      tables: {
        employees: {
          columns: ['id', 'name', 'role', 'dept_id', 'salary'],
          rows: [
            { id: 1, name: 'Ada', role: 'engineer', dept_id: 1, salary: 120 },
            { id: 2, name: 'Alan', role: 'engineer', dept_id: 1, salary: 110 },
            { id: 3, name: 'Grace', role: 'analyst', dept_id: 2, salary: 95 },
            { id: 4, name: 'Linus', role: 'ops', dept_id: 3, salary: 105 },
            { id: 5, name: 'Margaret', role: 'analyst', dept_id: 2, salary: 130 }
          ]
        },
        departments: {
          columns: ['id', 'name'],
          rows: [
            { id: 1, name: 'engineering' },
            { id: 2, name: 'analytics' },
            { id: 3, name: 'operations' }
          ]
        }
      }
    };
  }

  function mount(el, lab, opts) {
    opts = opts || {};
    const doneTasks = new Set(opts.done || []);
    const db = lab.seed ? lab.seed() : defaultDb();
    const state = { db, history: [], lastOutput: '' };

    el.innerHTML = `
      <section class="lab">
        <div class="lab-head">
          <span class="dot"></span><h3>Live SQL lab</h3>
          <span class="status" data-status>0 / ${lab.tasks.length} tasks</span>
        </div>
        <div class="lab-grid">
          <div class="lab-main">
            <p class="lab-brief">${S.sanitizeHTML(lab.brief || '')}</p>
            <div data-console></div>
          </div>
          <aside class="lab-side"><p class="side-title">Tasks</p><ul class="tasks" data-tasks></ul></aside>
        </div>
      </section>`;

    const taskList = el.querySelector('[data-tasks]');
    const status = el.querySelector('[data-status]');

    function renderTasks() {
      taskList.innerHTML = lab.tasks.map((t, i) =>
        `<li class="${doneTasks.has(i) ? 'done' : ''}"><span class="box">✓</span><span>${S.sanitizeHTML(t.text)}</span></li>`).join('');
      status.textContent = `${doneTasks.size} / ${lab.tasks.length} tasks`;
    }

    function evaluate() {
      lab.tasks.forEach((t, i) => {
        if (doneTasks.has(i)) return;
        let ok = false;
        try { ok = !!t.check(state); } catch (e) { ok = false; }
        if (ok) { doneTasks.add(i); if (opts.onTask) opts.onTask(i, true); }
      });
      renderTasks();
      if (doneTasks.size === lab.tasks.length && opts.onComplete) opts.onComplete();
    }

    window.Console.mount(el.querySelector('[data-console]'), {
      title: 'labdeck — sqlite',
      prompt: 'sql>',
      banner: 'LabDeck SQL lab. Type .tables to see the tables, help for syntax.',
      run: line => {
        state.history.push(line);
        const res = exec(db, line);
        state.lastOutput = res.out || '';
        return res;
      },
      after: () => evaluate()
    });

    renderTasks();
  }

  window.LabTypes.sql = mount;
})();
