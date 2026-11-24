/* LabDeck course catalog — 2 full courses (6 modules each) + 2 live projects + quizzes.
 * Lesson prose lives in data/packs/<course>.json (downloaded, integrity-checked, cached).
 * Labs, quizzes, task checks and project rubrics live here so the app shell can render alone.
 *
 * Lesson kinds: 'reading' | 'lab' | 'quiz' */
window.CATALOG = {
  version: 3,
  courses: [
    {
      id: 'linux',
      icon: '🐧',
      title: 'Linux Essentials',
      tagline: 'The command line end to end: files, text pipelines, permissions, processes, scripting — practised in a real shell that runs in your browser.',
      level: 'Beginner → Intermediate',
      hours: 9,
      modules: [
        {
          id: 'm1', title: 'Getting started',
          lessons: [
            { id: 'l1', title: 'What is Linux?', kind: 'reading', minutes: 8 },
            { id: 'l2', title: 'The shell and the terminal', kind: 'reading', minutes: 10 },
            {
              id: 'l3', title: 'Lab: your first commands', kind: 'lab', minutes: 15,
              lab: {
                type: 'terminal',
                brief: 'A live shell is attached below, starting in <code>/home/student</code>. Type <code>help</code> to list the supported commands.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'Print the working directory with <code>pwd</code>', check: s => s.history.some(c => /^pwd\b/.test(c)) },
                  { text: 'List the files in your home directory with <code>ls</code>', check: s => s.history.some(c => /^ls\b/.test(c)) },
                  { text: 'Read <code>welcome.txt</code> with <code>cat</code>', check: s => s.history.some(c => /^cat\s+\.?\/?welcome\.txt$/.test(c)) },
                  { text: 'Create a directory called <code>projects</code>', check: s => s.isDir('/home/student/projects') }
                ]
              }
            }
          ]
        },
        {
          id: 'm2', title: 'Files and paths',
          lessons: [
            { id: 'l4', title: 'Paths, files and directories', kind: 'reading', minutes: 12 },
            {
              id: 'l5', title: 'Lab: build a project tree', kind: 'lab', minutes: 18,
              lab: {
                type: 'terminal',
                brief: 'Create a small project layout, write a file with a redirect, then copy and move files around.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'Create <code>projects/app/src</code> in one command (<code>mkdir -p</code>)', check: s => s.isDir('/home/student/projects/app/src') },
                  { text: 'Write <code># My app</code> into <code>projects/app/README.md</code> using <code>&gt;</code>', check: s => /My app/.test(s.read('/home/student/projects/app/README.md') || '') },
                  { text: 'Copy <code>welcome.txt</code> to <code>projects/app/notes.txt</code>', check: s => s.exists('/home/student/projects/app/notes.txt') },
                  { text: 'Move <code>projects/app/notes.txt</code> to <code>projects/notes.txt</code>', check: s => s.exists('/home/student/projects/notes.txt') && !s.exists('/home/student/projects/app/notes.txt') }
                ]
              }
            }
          ]
        },
        {
          id: 'm3', title: 'Text and pipelines',
          lessons: [
            { id: 'l6', title: 'Reading and searching text', kind: 'reading', minutes: 12 },
            {
              id: 'l7', title: 'Lab: search the logs', kind: 'lab', minutes: 18,
              lab: {
                type: 'terminal',
                brief: 'A real log file sits at <code>/var/log/app.log</code>. Count it, search it, and chain commands with a pipe.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'Count the lines in the log with <code>wc -l /var/log/app.log</code>', check: s => s.history.some(c => /^wc\s+-l\b/.test(c)) },
                  { text: 'Find the errors with <code>grep ERROR /var/log/app.log</code>', check: s => s.history.some(c => /^grep\s+ERROR\b/.test(c)) },
                  { text: 'Count them in one pipeline: <code>grep ERROR /var/log/app.log | wc -l</code>', check: s => s.history.some(c => /grep\s+ERROR.*\|\s*wc\s+-l/.test(c)) },
                  { text: 'Show the last 3 lines with <code>tail -3 /var/log/app.log</code>', check: s => s.history.some(c => /^tail\s+-3\b/.test(c)) }
                ]
              }
            },
            {
              id: 'q1', title: 'Quiz: modules 1–3 recap', kind: 'quiz', minutes: 10,
              quiz: {
                pass: 4,
                questions: [
                  { q: 'Which command prints the directory you are currently in?', options: ['<code>pwd</code>', '<code>cd</code>', '<code>ls</code>', '<code>cat</code>'], answer: 0, explain: '<code>pwd</code> = print working directory.' },
                  { q: 'What does <code>mkdir -p a/b/c</code> do?', options: ['Creates only the last directory and fails if <code>a</code> is missing', 'Creates the whole chain and does not fail if it already exists', 'Creates a file called <code>-p</code>', 'Prints the path it would create'], answer: 1, explain: '<code>-p</code> creates parent directories and is idempotent.' },
                  { q: 'Which operator appends to a file instead of overwriting it?', options: ['<code>&gt;</code>', '<code>&gt;&gt;</code>', '<code>|</code>', '<code>&lt;</code>'], answer: 1, explain: '<code>&gt;&gt;</code> appends; <code>&gt;</code> truncates the file first.' },
                  { q: 'What does <code>grep ERROR app.log | wc -l</code> print?', options: ['Every error line', 'The number of lines containing ERROR', 'The number of files', 'The last error'], answer: 1, explain: 'The pipe feeds grep output into <code>wc -l</code>, which counts lines.' },
                  { q: 'Which command shows the last five lines of a file?', options: ['<code>head -5 file</code>', '<code>tail -5 file</code>', '<code>cat -5 file</code>', '<code>wc -5 file</code>'], answer: 1, explain: '<code>tail</code> reads from the end; <code>head</code> reads from the start.' }
                ]
              }
            }
          ]
        },
        {
          id: 'm4', title: 'Users and permissions',
          lessons: [
            { id: 'l8', title: 'Users, groups and file modes', kind: 'reading', minutes: 12 },
            {
              id: 'l9', title: 'Lab: fix the permissions', kind: 'lab', minutes: 15,
              lab: {
                type: 'terminal',
                brief: 'A deploy script exists but nobody can run it. Inspect the mode with <code>ls -l</code>, then fix it with <code>chmod</code>.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'Confirm who you are with <code>whoami</code>', check: s => s.history.some(c => /^whoami\b/.test(c)) },
                  { text: 'Inspect the mode of <code>deploy.sh</code> with <code>ls -l</code>', check: s => s.history.some(c => /^ls\s+-l/.test(c)) },
                  { text: 'Make <code>deploy.sh</code> executable with <code>chmod 755 deploy.sh</code>', check: s => s.mode('/home/student/deploy.sh') === '755' },
                  { text: 'Make <code>secrets.env</code> readable only by you (<code>chmod 600</code>)', check: s => s.mode('/home/student/secrets.env') === '600' }
                ]
              }
            }
          ]
        },
        {
          id: 'm5', title: 'Processes and packages',
          lessons: [
            { id: 'l10', title: 'Processes, signals and packages', kind: 'reading', minutes: 12 },
            {
              id: 'l11', title: 'Lab: inspect and stop a process', kind: 'lab', minutes: 14,
              lab: {
                type: 'terminal',
                brief: 'Use <code>ps</code> to find the runaway process, then <code>kill</code> it by PID.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'List processes with <code>ps</code>', check: s => s.history.some(c => /^ps\b/.test(c)) },
                  { text: 'Find the process using 98% CPU (PID 4242)', check: s => s.history.some(c => /^ps\b/.test(c)) && s.processes.some(p => p.pid === 4242) },
                  { text: 'Stop it with <code>kill 4242</code>', check: s => !s.processes.some(p => p.pid === 4242) }
                ]
              }
            }
          ]
        },
        {
          id: 'm6', title: 'Scripting and networking',
          lessons: [
            { id: 'l12', title: 'Bash scripting and networking basics', kind: 'reading', minutes: 14 },
            {
              id: 'l13', title: 'Lab: write a backup script', kind: 'lab', minutes: 20,
              lab: {
                type: 'terminal',
                brief: 'Write <code>backup.sh</code>, make it executable, and run it. The shell executes your script line by line.',
                setup: { cwd: '/home/student' },
                tasks: [
                  { text: 'Create <code>backup.sh</code> containing a <code>#!/bin/sh</code> shebang', check: s => /^#!\/bin\/sh/.test(s.read('/home/student/backup.sh') || '') },
                  { text: 'Add <code>mkdir -p backups</code> to the script', check: s => /mkdir\s+-p\s+backups/.test(s.read('/home/student/backup.sh') || '') },
                  { text: 'Add <code>cp welcome.txt backups/welcome.txt</code>', check: s => /cp\s+welcome\.txt\s+backups\/welcome\.txt/.test(s.read('/home/student/backup.sh') || '') },
                  { text: 'Make it executable with <code>chmod 755 backup.sh</code>', check: s => s.mode('/home/student/backup.sh') === '755' },
                  { text: 'Run it with <code>./backup.sh</code> and confirm the copy exists', check: s => s.history.some(c => /^\.\/backup\.sh$/.test(c)) && s.exists('/home/student/backups/welcome.txt') }
                ]
              }
            },
            {
              id: 'q2', title: 'Final assessment', kind: 'quiz', minutes: 15,
              quiz: {
                pass: 4,
                questions: [
                  { q: '<code>chmod 600 secrets.env</code> grants which permissions?', options: ['Owner read + write only', 'Owner read + write + execute', 'Everyone read only', 'Everyone read + write'], answer: 0, explain: '6 = read + write for the owner; the other two classes get nothing.' },
                  { q: '<code>ls -l</code> shows <code>-rwxr-xr-x</code>. What is the numeric mode?', options: ['644', '755', '777', '700'], answer: 1, explain: 'rwx = 7, r-x = 5, r-x = 5.' },
                  { q: 'Which signal does a plain <code>kill 4242</code> send?', options: ['SIGTERM', 'SIGKILL', 'SIGHUP', 'SIGSTOP'], answer: 0, explain: 'SIGTERM asks the process to stop; <code>kill -9</code> sends SIGKILL.' },
                  { q: 'What makes <code>./script.sh</code> runnable?', options: ['Only the shebang', 'Only the execute bit', 'Both the shebang and the execute bit', 'Being stored in /usr/bin'], answer: 2, explain: 'The shebang picks the interpreter; the execute bit lets you invoke it directly.' },
                  { q: 'Which command counts the lines in a file?', options: ['<code>wc -l file</code>', '<code>ls -l file</code>', '<code>grep -l file</code>', '<code>du -l file</code>'], answer: 0, explain: '<code>wc -l</code> prints the line count.' }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      id: 'python',
      icon: '🐍',
      title: 'Python Foundations',
      tagline: 'From your first print() to classes, files and tests — with a real CPython runtime in the browser that keeps working offline.',
      level: 'Beginner → Intermediate',
      hours: 10,
      modules: [
        {
          id: 'm1', title: 'Python basics',
          lessons: [
            { id: 'p1', title: 'Running Python', kind: 'reading', minutes: 8 },
            { id: 'p2', title: 'Variables and types', kind: 'reading', minutes: 12 },
            {
              id: 'p3', title: 'Lab: variables and printing', kind: 'lab', minutes: 12,
              lab: {
                type: 'python',
                brief: 'Write code in the editor and press <b>Run</b>. The first run downloads the Python runtime and caches it for offline use.',
                starter: '# Create two variables and print a sentence\nname = "Ada"\nage = 36\n\nprint(name, "is", age, "years old")\n',
                tasks: [
                  { text: 'Print a sentence containing your <code>name</code> variable', check: out => /Ada|is .* years old/.test(out) },
                  { text: 'Print the <b>type</b> of <code>age</code> using <code>type()</code>', check: out => /<class 'int'>/.test(out) },
                  { text: 'Print <code>age * 2</code>', check: out => /\b72\b/.test(out) }
                ]
              }
            }
          ]
        },
        {
          id: 'm2', title: 'Control flow',
          lessons: [
            { id: 'p4', title: 'Conditionals and loops', kind: 'reading', minutes: 14 },
            {
              id: 'p5', title: 'Lab: FizzBuzz', kind: 'lab', minutes: 15,
              lab: {
                type: 'python',
                brief: 'Print the numbers 1 to 15, but print <code>Fizz</code> for multiples of 3, <code>Buzz</code> for multiples of 5 and <code>FizzBuzz</code> for multiples of both.',
                starter: 'for n in range(1, 16):\n    # your code here\n    pass\n',
                tasks: [
                  { text: 'Output contains <code>Fizz</code>', check: out => /Fizz/.test(out) },
                  { text: 'Output contains <code>Buzz</code>', check: out => /Buzz/.test(out) },
                  { text: 'Output contains <code>FizzBuzz</code>', check: out => /FizzBuzz/.test(out) },
                  { text: 'Output has exactly 15 lines', check: out => out.trim().split('\n').length === 15 }
                ]
              }
            }
          ]
        },
        {
          id: 'm3', title: 'Functions',
          lessons: [
            { id: 'p6', title: 'Functions and modules', kind: 'reading', minutes: 12 },
            {
              id: 'p7', title: 'Lab: write a function', kind: 'lab', minutes: 15,
              lab: {
                type: 'python',
                brief: 'Define <code>area(width, height)</code> that returns the area, then print <code>area(3, 4)</code> and <code>area(2.5, 4)</code>.',
                starter: 'def area(width, height):\n    # return the area\n    pass\n\nprint(area(3, 4))\nprint(area(2.5, 4))\n',
                tasks: [
                  { text: 'Output contains <code>12</code>', check: out => /\b12\b/.test(out) },
                  { text: 'Output contains <code>10.0</code> for <code>area(2.5, 4)</code>', check: out => /\b10(\.0)?\b/.test(out) }
                ]
              }
            },
            {
              id: 'q1', title: 'Quiz: modules 1–3 recap', kind: 'quiz', minutes: 10,
              quiz: {
                pass: 4,
                questions: [
                  { q: 'What does <code>type(3.0)</code> return?', options: ["<class 'float'>", "<class 'int'>", "<class 'str'>", "<class 'bool'>"], answer: 0, explain: 'A decimal literal is a float, even when the value is whole.' },
                  { q: 'What is <code>7 // 2</code>?', options: ['3', '3.5', '4', '1'], answer: 0, explain: 'Floor division discards the remainder; <code>7 / 2</code> would be 3.5.' },
                  { q: 'Which loop is best when you know how many iterations you need?', options: ['<code>for</code>', '<code>while</code>', '<code>do</code>', '<code>repeat</code>'], answer: 0, explain: '<code>for</code> iterates a known sequence; <code>while</code> runs until a condition changes.' },
                  { q: 'A function with no <code>return</code> statement returns…', options: ['<code>0</code>', '<code>None</code>', 'an empty string', 'the last expression'], answer: 1, explain: 'Python returns <code>None</code> implicitly.' },
                  { q: 'What is <code>f"{name} is {age}"</code> called?', options: ['An f-string', 'A docstring', 'A format tuple', 'A lambda'], answer: 0, explain: 'The <code>f</code> prefix interpolates expressions inside braces.' }
                ]
              }
            }
          ]
        },
        {
          id: 'm4', title: 'Data structures',
          lessons: [
            { id: 'p8', title: 'Lists, dictionaries and sets', kind: 'reading', minutes: 14 },
            {
              id: 'p9', title: 'Lab: word counter', kind: 'lab', minutes: 18,
              lab: {
                type: 'python',
                brief: 'Count how often each word appears in the sentence below and print the dictionary.',
                starter: 'text = "the quick brown fox jumps over the lazy dog the fox"\ncounts = {}\n\n# fill counts, then print it\nprint(counts)\n',
                tasks: [
                  { text: 'Output contains <code>\'the\': 3</code>', check: out => /['"]the['"]\s*:\s*3/.test(out) },
                  { text: 'Output contains <code>\'fox\': 2</code>', check: out => /['"]fox['"]\s*:\s*2/.test(out) },
                  { text: 'Output contains <code>\'dog\': 1</code>', check: out => /['"]dog['"]\s*:\s*1/.test(out) }
                ]
              }
            }
          ]
        },
        {
          id: 'm5', title: 'Files and errors',
          lessons: [
            { id: 'p10', title: 'Files, JSON and exceptions', kind: 'reading', minutes: 14 },
            {
              id: 'p11', title: 'Lab: parse a log file', kind: 'lab', minutes: 18,
              lab: {
                type: 'python',
                brief: 'The lab ships a small log as a string. Count the <code>ERROR</code> lines and print them.',
                starter: 'log = """2026-11-24T08:00:01Z INFO  boot: starting app\n2026-11-24T08:01:12Z ERROR db: connection timeout\n2026-11-24T08:04:19Z ERROR http: GET /api/items 500\n2026-11-24T08:06:31Z ERROR db: connection timeout"""\n\nlines = log.splitlines()\n# count ERROR lines and print the count, then the lines\n',
                tasks: [
                  { text: 'Print the number of ERROR lines (<code>3</code>)', check: out => /\b3\b/.test(out) },
                  { text: 'Print the lines containing <code>ERROR</code>', check: out => /connection timeout/.test(out) && /GET \/api\/items/.test(out) }
                ]
              }
            }
          ]
        },
        {
          id: 'm6', title: 'Classes and testing',
          lessons: [
            { id: 'p12', title: 'Classes, objects and tests', kind: 'reading', minutes: 14 },
            {
              id: 'p13', title: 'Lab: build a class', kind: 'lab', minutes: 20,
              lab: {
                type: 'python',
                brief: 'Create a <code>Counter</code> class with an <code>add(n)</code> method, then use two independent instances.',
                starter: 'class Counter:\n    def __init__(self):\n        self.value = 0\n\n    def add(self, n):\n        # add n to the running total\n        pass\n\nc = Counter()\nc.add(5)\nc.add(7)\nprint(c.value)\n\nd = Counter()\nd.add(12)\nprint(d.value)\n',
                tasks: [
                  { text: 'Output contains <code>12</code>', check: out => /\b12\b/.test(out) },
                  { text: 'A second counter also reaches <code>12</code> (instances are independent)', check: out => (out.match(/\b12\b/g) || []).length >= 2 }
                ]
              }
            },
            {
              id: 'q2', title: 'Final assessment', kind: 'quiz', minutes: 15,
              quiz: {
                pass: 4,
                questions: [
                  { q: '<code>counts.get("x", 0)</code> returns what when the key is missing?', options: ['<code>0</code>', '<code>None</code>', 'a <code>KeyError</code>', '<code>False</code>'], answer: 0, explain: 'The second argument is the default returned instead of raising.' },
                  { q: 'Which structure stores only unique values?', options: ['list', 'dict', 'set', 'tuple'], answer: 2, explain: 'A set deduplicates automatically and answers membership fast.' },
                  { q: '<code>json.dumps(data)</code> converts…', options: ['a dict into a JSON string', 'a JSON string into a dict', 'a file into a dict', 'a dict into a file'], answer: 0, explain: '<code>dumps</code> = dump to string; <code>loads</code> goes the other way.' },
                  { q: 'What does <code>with open(...) as f:</code> guarantee?', options: ['The file is read twice', 'The file is closed even if an error occurs', 'The file is locked forever', 'The file is compressed'], answer: 1, explain: 'The context manager closes the file on the way out, including on exceptions.' },
                  { q: 'Inside a method, <code>self</code> refers to…', options: ['the class itself', 'the instance the method was called on', 'the parent class', 'a global variable'], answer: 1, explain: 'Each instance carries its own attributes; <code>self</code> is how the method reaches them.' }
                ]
              }
            }
          ]
        }
      ]
    }
  ],

  projects: [
    {
      id: 'healthcheck',
      course: 'linux',
      icon: '🩺',
      title: 'Project: server health check',
      level: 'Guided',
      minutes: 40,
      summary: 'Write a shell script that reports disk, memory and uptime — the first thing anyone runs on an unfamiliar box.',
      rubric: [
        'Script starts with a #!/bin/sh shebang',
        'Reports disk usage with df -h',
        'Reports load average with uptime',
        'Reports memory with free',
        'Is executable (chmod 755) and runs with ./healthcheck.sh'
      ],
      lab: {
        type: 'terminal',
        brief: 'Build <code>healthcheck.sh</code> in your home directory using <code>echo</code> appends (e.g. <code>echo "df -h" &gt;&gt; healthcheck.sh</code>), then make it executable and run it with <code>./healthcheck.sh</code>.',
        setup: { cwd: '/home/student' },
        tasks: [
          { text: 'Create <code>healthcheck.sh</code> with a <code>#!/bin/sh</code> shebang', check: s => /^#!\/bin\/sh/.test(s.read('/home/student/healthcheck.sh') || '') },
          { text: 'Add <code>df -h</code> to the script', check: s => /df\s+-h/.test(s.read('/home/student/healthcheck.sh') || '') },
          { text: 'Add <code>uptime</code> to the script', check: s => /uptime/.test(s.read('/home/student/healthcheck.sh') || '') },
          { text: 'Add <code>free</code> to the script', check: s => /free/.test(s.read('/home/student/healthcheck.sh') || '') },
          { text: 'Make it executable with <code>chmod 755 healthcheck.sh</code>', check: s => s.mode('/home/student/healthcheck.sh') === '755' },
          { text: 'Run it with <code>./healthcheck.sh</code> and see the disk report', check: s => s.history.some(c => /^\.\/healthcheck\.sh$/.test(c)) && /Filesystem/.test(s.lastOutput || '') }
        ]
      }
    },
    {
      id: 'expenses',
      course: 'python',
      icon: '💰',
      title: 'Project: expense tracker',
      level: 'Guided',
      minutes: 45,
      summary: 'Aggregate a list of expenses: totals, averages, per-category sums and the biggest category. The classic first "real" data task.',
      rubric: [
        'Total of all amounts is 43.0',
        'Average per expense is 10.75',
        'Per-category totals computed with a dictionary',
        'Most expensive category identified as books'
      ],
      lab: {
        type: 'python',
        brief: 'Work through the four questions below using the data provided. Print each answer on its own line.',
        starter: 'expenses = [\n    {"category": "food", "amount": 12.5},\n    {"category": "transport", "amount": 3.0},\n    {"category": "food", "amount": 7.5},\n    {"category": "books", "amount": 20.0},\n]\n\n# 1. print the total of all amounts\ntotal = 0\n\n# 2. print the average per expense\n\n# 3. print a dict of category -> total\n\n# 4. print the category with the highest total\n',
        tasks: [
          { text: 'Print the total <code>43.0</code>', check: out => /\b43(\.0)?\b/.test(out) },
          { text: 'Print the average <code>10.75</code>', check: out => /10\.75/.test(out) },
          { text: 'Print per-category totals including <code>\'food\': 20.0</code>', check: out => /['"]food['"]\s*:\s*20(\.0)?/.test(out) },
          { text: 'Print the top category <code>books</code>', check: out => /books/.test(out) }
        ]
      }
    }
  ]
};
