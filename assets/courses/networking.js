window.LABDECK_EXT = window.LABDECK_EXT || { courses: [], projects: [], tickets: {} };
window.LABDECK_EXT.courses.push({
  id: 'networking',
  icon: '🌐',
  title: 'Networking Essentials',
  tagline: 'IPs, DNS, HTTP and the commands that tell you why a service is unreachable — on a simulated network.',
  level: 'Beginner',
  hours: 5,
  modules: [
    {
      id: 'm1', title: 'Addresses and names',
      lessons: [
        { id: 'n1', title: 'IP addresses and ports', kind: 'reading', minutes: 10 },
        { id: 'n2', title: 'DNS: turning names into addresses', kind: 'reading', minutes: 12 },
        {
          id: 'n3', title: 'Lab: resolve and inspect', kind: 'lab', minutes: 15,
          lab: {
            type: 'net',
            brief: 'A simulated host with a small DNS zone. Start with <code>ip addr</code> and <code>dig</code>.',
            tasks: [
              { text: 'Show your interfaces with <code>ip addr</code>', check: s => s.history.some(c => /^ip\s+addr/.test(c)) },
              { text: 'Resolve <code>labdeck.dev</code> with <code>dig</code>', check: s => s.history.some(c => /^dig\s+labdeck\.dev/.test(c)) },
              { text: 'Resolve <code>api.labdeck.dev</code>', check: s => s.history.some(c => /^dig\s+api\.labdeck\.dev/.test(c)) },
              { text: 'Try a name that does not exist and read the NXDOMAIN', check: s => s.history.some(c => /^dig\s+nope\.labdeck\.dev/.test(c)) }
            ]
          }
        }
      ]
    },
    {
      id: 'm2', title: 'Talking to servers',
      lessons: [
        { id: 'n4', title: 'HTTP, headers and curl', kind: 'reading', minutes: 12 },
        {
          id: 'n5', title: 'Lab: fetch a page', kind: 'lab', minutes: 15,
          lab: {
            type: 'net',
            brief: 'Use <code>curl</code> to inspect a response. Headers first, then the body.',
            tasks: [
              { text: 'Fetch headers only: <code>curl -I https://labdeck.dev</code>', check: s => s.history.some(c => /^curl\s+-I\s+https:\/\/labdeck\.dev/.test(c)) },
              { text: 'Fetch the body: <code>curl https://labdeck.dev</code>', check: s => s.history.some(c => /^curl\s+https:\/\/labdeck\.dev/.test(c)) },
              { text: 'Check that <code>strict-transport-security</code> is present', check: s => s.history.some(c => /^curl\s+-I/.test(c)) && /strict-transport-security/.test(s.lastOutput) }
            ]
          }
        }
      ]
    },
    {
      id: 'm3', title: 'Diagnosing failures',
      lessons: [
        { id: 'n6', title: 'ping, traceroute and listening ports', kind: 'reading', minutes: 14 },
        {
          id: 'n7', title: 'Lab: find the broken service', kind: 'lab', minutes: 20,
          lab: {
            type: 'net',
            brief: 'One host is down and one port is exposed that should not be. Work out which.',
            tasks: [
              { text: 'Ping <code>labdeck.dev</code> — it should answer', check: s => s.history.some(c => /^ping\s+labdeck\.dev/.test(c)) },
              { text: 'Ping <code>broken.labdeck.dev</code> and note the 100% loss', check: s => s.history.some(c => /^ping\s+broken\.labdeck\.dev/.test(c)) && /100% packet loss/.test(s.lastOutput) },
              { text: 'List listening ports with <code>ss -tulpn</code>', check: s => s.history.some(c => /^ss\s+-tulpn/.test(c)) },
              { text: 'Trace the path to <code>api.labdeck.dev</code>', check: s => s.history.some(c => /^traceroute\s+api\.labdeck\.dev/.test(c)) }
            ]
          }
        }
      ]
    }
  ]
});
