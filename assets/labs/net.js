/* LabDeck networking lab — a simulated host, DNS zone and HTTP service.
 * No real packets leave the browser; every command answers from a fixed model. */
(function () {
  'use strict';
  window.LabTypes = window.LabTypes || {};
  const S = window.Security;

  const DNS = {
    'labdeck.dev': '203.0.113.10',
    'api.labdeck.dev': '203.0.113.20',
    'cdn.labdeck.dev': '198.51.100.7',
    'mail.labdeck.dev': '203.0.113.30',
    'broken.labdeck.dev': '203.0.113.99'
  };

  const PORTS = [
    { proto: 'tcp', local: '0.0.0.0:22', proc: 'sshd' },
    { proto: 'tcp', local: '0.0.0.0:80', proc: 'nginx' },
    { proto: 'tcp', local: '0.0.0.0:443', proc: 'nginx' },
    { proto: 'tcp', local: '127.0.0.1:5432', proc: 'postgres' },
    { proto: 'tcp', local: '0.0.0.0:8080', proc: 'node' }
  ];

  const HELP = [
    'Supported commands:',
    '  ip addr            show interfaces',
    '  dig <name>         resolve a name (A record)',
    '  ping <host>        four ICMP echoes',
    '  curl -I <url>      HTTP response headers',
    '  curl <url>         HTTP body (first lines)',
    '  ss -tulpn          listening ports',
    '  traceroute <host>  path to a host',
    '  ssh user@host      open a session',
    '  help / clear'
  ].join('\n');

  function resolve(name) {
    return DNS[String(name).toLowerCase()] || null;
  }

  function cmdIp() {
    return [
      '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536',
      '    inet 127.0.0.1/8 scope host lo',
      '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500',
      '    inet 203.0.113.10/24 brd 203.0.113.255 scope global eth0',
      '    inet6 fe80::1/64 scope link'
    ].join('\n');
  }

  function cmdDig(name) {
    const ip = resolve(name);
    if (!ip) return { err: `;; status: NXDOMAIN  (no record for ${name})` };
    return {
      out: [
        `; <<>> DiG 9.18 <<>> ${name}`,
        ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41234',
        '',
        ';; ANSWER SECTION:',
        `${name}.\t300\tIN\tA\t${ip}`,
        '',
        ';; Query time: 12 msec'
      ].join('\n')
    };
  }

  function cmdPing(host) {
    const ip = resolve(host);
    if (!ip) return { err: `ping: ${host}: Name or service not known` };
    if (host === 'broken.labdeck.dev') {
      return { out: `PING ${host} (${ip}) 56(84) bytes of data.\n\n--- ${host} ping statistics ---\n4 packets transmitted, 0 received, 100% packet loss` };
    }
    const lines = [`PING ${host} (${ip}) 56(84) bytes of data.`];
    for (let i = 1; i <= 4; i++) {
      lines.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=57 time=${(8.2 + i * 1.6).toFixed(1)} ms`);
    }
    lines.push('');
    lines.push(`--- ${host} ping statistics ---`);
    lines.push('4 packets transmitted, 4 received, 0% packet loss, time 3004ms');
    lines.push('rtt min/avg/max/mdev = 9.8/12.1/14.6/1.4 ms');
    return { out: lines.join('\n') };
  }

  function cmdCurl(args) {
    const url = args.find(a => /^https?:\/\//i.test(a));
    if (!url) return { err: 'curl: no URL specified' };
    const host = url.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    const ip = resolve(host);
    if (!ip) return { err: `curl: (6) Could not resolve host: ${host}` };
    if (host === 'broken.labdeck.dev') return { err: `curl: (7) Failed to connect to ${host} port 443: Connection refused` };

    const headersOnly = args.includes('-I') || args.includes('--head');
    const secure = /^https:/i.test(url);

    if (headersOnly) {
      return {
        out: [
          secure ? 'HTTP/2 200' : 'HTTP/1.1 200 OK',
          'date: Wed, 25 Nov 2026 07:01:00 GMT',
          'content-type: text/html; charset=utf-8',
          'server: nginx',
          'strict-transport-security: max-age=31536000; includeSubDomains',
          'x-content-type-options: nosniff',
          'cache-control: public, max-age=300'
        ].join('\n')
      };
    }
    return {
      out: [
        '<!doctype html>',
        '<html lang="en">',
        '  <head><title>LabDeck</title></head>',
        '  <body><h1>It works.</h1></body>',
        '</html>',
        '',
        '(5 lines shown — use curl -I for headers)'
      ].join('\n')
    };
  }

  function cmdSs() {
    const head = 'Netid State  Local Address:Port   Process';
    const rows = PORTS.map(p =>
      `${p.proto.padEnd(5)} LISTEN ${p.local.padEnd(20)} users:(("${p.proc}",pid=${100 + PORTS.indexOf(p)},fd=6))`);
    return { out: [head].concat(rows).join('\n') };
  }

  function cmdTraceroute(host) {
    const ip = resolve(host);
    if (!ip) return { err: `traceroute: unknown host ${host}` };
    const hops = [
      '1  192.168.1.1        1.204 ms  1.101 ms  1.088 ms',
      '2  10.0.0.1           4.512 ms  4.401 ms  4.388 ms',
      '3  172.16.0.9        11.220 ms 11.104 ms 11.331 ms',
      `4  ${ip}            12.884 ms 12.701 ms 12.955 ms`
    ];
    return { out: `traceroute to ${host} (${ip}), 30 hops max\n` + hops.join('\n') };
  }

  function cmdSsh(target) {
    if (!target || !target.includes('@')) return { err: 'ssh: usage: ssh user@host' };
    const host = target.split('@')[1];
    if (!resolve(host)) return { err: `ssh: Could not resolve hostname ${host}` };
    return { out: `The authenticity of host '${host}' can't be established.\nED25519 key fingerprint is SHA256:labdeckdemo.\nWelcome to ${host} (LabDeck Linux 1.0)\nLast login: Wed Nov 25 06:58:12 2026 from 203.0.113.10` };
  }

  function exec(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    if (!cmd) return { out: '' };
    if (cmd === 'help') return { out: HELP };
    if (cmd === 'clear') return { clear: true };
    if (cmd === 'ip' || cmd === 'ifconfig') return { out: cmdIp() };
    if (cmd === 'dig' || cmd === 'nslookup') {
      if (!args.length) return { err: 'usage: dig <name>' };
      return cmdDig(args[args.length - 1]);
    }
    if (cmd === 'ping') {
      if (!args.length) return { err: 'usage: ping <host>' };
      return cmdPing(args[args.length - 1]);
    }
    if (cmd === 'curl') return cmdCurl(args);
    if (cmd === 'ss' || cmd === 'netstat') return cmdSs();
    if (cmd === 'traceroute' || cmd === 'tracert') {
      if (!args.length) return { err: 'usage: traceroute <host>' };
      return cmdTraceroute(args[args.length - 1]);
    }
    if (cmd === 'ssh') return cmdSsh(args[0]);
    return { err: `${cmd}: command not found (type help)` };
  }

  function mount(el, lab, opts) {
    opts = opts || {};
    const doneTasks = new Set(opts.done || []);
    const state = { history: [], lastOutput: '' };

    el.innerHTML = `
      <section class="lab">
        <div class="lab-head">
          <span class="dot"></span><h3>Live network lab</h3>
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
      title: 'student@labdeck — network',
      prompt: 'student@labdeck:~$',
      banner: 'LabDeck network lab. Type help for the command list.',
      run: line => {
        state.history.push(line);
        const res = exec(line);
        state.lastOutput = res.out || '';
        return res;
      },
      after: () => evaluate()
    });

    renderTasks();
  }

  window.LabTypes.net = mount;
})();
