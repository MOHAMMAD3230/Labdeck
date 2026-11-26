/* Merges courses registered by assets/courses/*.js into the catalog.
 * Adding a course = one new file + one <script> tag. Nothing else changes. */
(function () {
  const ext = window.LABDECK_EXT || { courses: [], projects: [], tickets: {} };
  if (ext.courses.length) window.CATALOG.courses.push(...ext.courses);
  if (ext.projects.length) window.CATALOG.projects.push(...ext.projects);
  window.CATALOG.tickets = Object.assign({}, window.CATALOG.tickets || {}, ext.tickets || {});
})();
