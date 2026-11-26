window.LABDECK_EXT = window.LABDECK_EXT || { courses: [], projects: [], tickets: {} };
window.LABDECK_EXT.courses.push({
  id: 'sql',
  icon: '🗄️',
  title: 'SQL Essentials',
  tagline: 'Query a real database in the browser: SELECT, filtering, aggregates, grouping — then change data safely.',
  level: 'Beginner',
  hours: 5,
  modules: [
    {
      id: 'm1', title: 'Querying basics',
      lessons: [
        { id: 's1', title: 'Tables, rows and columns', kind: 'reading', minutes: 10 },
        { id: 's2', title: 'SELECT and WHERE', kind: 'reading', minutes: 12 },
        {
          id: 's3', title: 'Lab: your first queries', kind: 'lab', minutes: 15,
          lab: {
            type: 'sql',
            brief: 'A database with <code>employees</code> and <code>departments</code> is loaded. Type <code>.tables</code> to see them.',
            tasks: [
              { text: 'List the tables with <code>.tables</code>', check: s => s.history.some(c => /^\.tables$/i.test(c.trim())) },
              { text: 'Show every employee: <code>SELECT * FROM employees</code>', check: s => s.history.some(c => /^select\s+\*\s+from\s+employees/i.test(c)) },
              { text: 'Show only engineers: <code>WHERE role = \'engineer\'</code>', check: s => s.history.some(c => /where\s+role\s*=\s*'engineer'/i.test(c)) },
              { text: 'Show name and salary only', check: s => s.history.some(c => /^select\s+name\s*,\s*salary\s+from\s+employees/i.test(c)) }
            ]
          }
        }
      ]
    },
    {
      id: 'm2', title: 'Aggregates and grouping',
      lessons: [
        { id: 's4', title: 'COUNT, SUM, AVG and GROUP BY', kind: 'reading', minutes: 14 },
        {
          id: 's5', title: 'Lab: build a salary report', kind: 'lab', minutes: 18,
          lab: {
            type: 'sql',
            brief: 'Answer four questions about the <code>employees</code> table. One query each.',
            tasks: [
              { text: 'How many employees are there? (<code>COUNT(*)</code>)', check: s => s.history.some(c => /count\s*\(\s*\*\s*\)/i.test(c)) },
              { text: 'What is the average salary? (<code>AVG(salary)</code>)', check: s => s.history.some(c => /avg\s*\(\s*salary\s*\)/i.test(c)) },
              { text: 'Total salary per department (<code>GROUP BY dept_id</code>)', check: s => s.history.some(c => /group\s+by\s+dept_id/i.test(c)) },
              { text: 'Who earns the most? (<code>ORDER BY salary DESC LIMIT 1</code>)', check: s => s.history.some(c => /order\s+by\s+salary\s+desc/i.test(c)) && /Margaret/.test(s.lastOutput) }
            ]
          }
        }
      ]
    },
    {
      id: 'm3', title: 'Changing data',
      lessons: [
        { id: 's6', title: 'INSERT, UPDATE and DELETE', kind: 'reading', minutes: 12 },
        {
          id: 's7', title: 'Lab: fix the data', kind: 'lab', minutes: 18,
          lab: {
            type: 'sql',
            brief: 'A new hire was added with the wrong salary, and one row should not exist. Fix both.',
            tasks: [
              { text: 'Add a row for <code>Barbara</code>, role <code>engineer</code>, dept 1, salary 100', check: s => s.db.tables.employees.rows.some(r => r.name === 'Barbara' && r.salary === 100) },
              { text: 'Give <code>Grace</code> a raise to 100 with <code>UPDATE</code>', check: s => s.db.tables.employees.rows.some(r => r.name === 'Grace' && r.salary === 100) },
              { text: 'Delete the row where <code>name = \'Linus\'</code>', check: s => !s.db.tables.employees.rows.some(r => r.name === 'Linus') },
              { text: 'Confirm the final table with <code>SELECT * FROM employees</code>', check: s => s.history.some(c => /^select\s+\*\s+from\s+employees/i.test(c)) && s.db.tables.employees.rows.length === 5 }
            ]
          }
        }
      ]
    }
  ]
});
