/* LabDeck — footer social links + About page helpers.
 * Fill in the URLs below. Any entry left empty is hidden automatically,
 * so you can add profiles one at a time. Icons are inline SVG: no external
 * requests, no icon font, works offline. */
(function () {
  'use strict';

  /* ---- edit these ---- */
  const NAME = 'MOHAMMAD ASHRAF ALI SHAIK';
  const LINKS = [
    { id: 'youtube',   label: 'YouTube',   url: 'https://www.youtube.com/@mohammadashrafalishaik' },   // https://www.youtube.com/@yourhandle
    { id: 'linkedin',  label: 'LinkedIn',  url: '' },   // https://www.linkedin.com/in/your-profile
    { id: 'github',    label: 'GitHub',    url: 'https://github.com/MOHAMMAD3230' },
    { id: 'x',         label: 'X',         url: '' },   // https://x.com/yourhandle
    { id: 'instagram', label: 'Instagram', url: '' },   // https://www.instagram.com/yourhandle
    { id: 'website',   label: 'Website',   url: 'https://mohammad3230.github.io/PROJECT/' },   // https://yourdomain.com
    { id: 'email',     label: 'Email',     url: 'mailto:mohammadashrafali96@gmail.com' }
  ];
  /* ------------------- */

  const ICONS = {
    youtube: '<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/>',
    linkedin: '<path d="M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1a3.8 3.8 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.4H3.5V9h3.6v11.4zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7c0-.9-.8-1.7-1.8-1.7z"/>',
    github: '<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"/>',
    x: '<path d="M18.9 1.2h3.7l-8.1 9.3 9.5 12.6h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.9L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.7h2L6.5 3.2H4.4l13.2 17.7z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2zm0 10.9a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6zm6.9-11.1a1.5 1.5 0 1 1-3.1 0 1.5 1.5 0 0 1 3.1 0z"/>',
    website: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15 15 0 0 0-1.2-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.4 2.5 1.8 4h-3.6c.4-1.5 1-2.8 1.8-4zM4.3 14a8 8 0 0 1 0-4h3.3a17 17 0 0 0 0 4H4.3zm.8 2h2.9c.3 1.3.7 2.5 1.2 3.6A8 8 0 0 1 5.1 16zm2.9-8H5.1a8 8 0 0 1 4.1-3.6A15 15 0 0 0 8 8zm4 12c-.8-1.2-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.8-1.8 4zm2.2-6H9.8a15 15 0 0 1 0-4h4.4a15 15 0 0 1 0 4zm.6 5.6c.5-1.1.9-2.3 1.2-3.6h2.9a8 8 0 0 1-4.1 3.6zm1.5-5.6a17 17 0 0 0 0-4h3.3a8 8 0 0 1 0 4h-3.3z"/>',
    email: '<path d="M2 4h20v16H2V4zm10 7.5L4.4 6H19.6L12 11.5zM4 8.2V18h16V8.2l-8 5.5-8-5.5z"/>'
  };

  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function active() {
    return LINKS.filter(l => l.url && !/your|example\.com/i.test(l.url));
  }

  /** Markup for the icon row — reused by the footer and the About page. */
  function linkHTML() {
    return active().map(l => {
      const external = /^https?:/i.test(l.url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer me"' : '';
      return `<a href="${esc(l.url)}"${attrs} aria-label="${esc(l.label)}" title="${esc(l.label)}">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[l.id] || ''}</svg></a>`;
    }).join('');
  }

  function render() {
    const foot = document.querySelector('.foot');
    if (!foot || document.querySelector('.social')) return;
    if (!active().length) return;

    const wrap = document.createElement('div');
    wrap.className = 'social';
    wrap.innerHTML = `
      <p class="social-name">© ${new Date().getFullYear()} ${esc(NAME)}</p>
      <div class="social-links">${linkHTML()}</div>`;
    foot.appendChild(wrap);
  }

  document.addEventListener('DOMContentLoaded', render);
  window.Social = { render, linkHTML, NAME };
})();
