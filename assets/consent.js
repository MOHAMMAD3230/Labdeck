/* LabDeck — analytics consent.
 * gtag.js is only injected after the visitor accepts. The choice is stored in
 * localStorage and can be changed later from the footer link.
 * Do Not Track is honoured: no banner, no analytics. */
(function () {
  'use strict';
  const LS = 'labdeck.consent.v1';
  const TAG_ID = 'GT-NC6T5LRJ';
  let loaded = false;
  let bar = null;

  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(LS));
      return v && typeof v === 'object' && typeof v.analytics === 'boolean' ? v : null;
    } catch (e) { return null; }
  }

  function write(analytics) {
    try {
      localStorage.setItem(LS, JSON.stringify({ analytics, at: new Date().toISOString() }));
    } catch (e) { /* quota */ }
  }

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;

    const loader = document.createElement('script');
    loader.async = true;
    loader.src = 'https://www.googletagmanager.com/gtag/js?id=' + TAG_ID;
    document.head.appendChild(loader);

    const config = document.createElement('script');
    config.src = 'assets/gtag.js';
    document.head.appendChild(config);
  }

  function build() {
    bar = document.createElement('div');
    bar.className = 'consent';
    bar.hidden = true;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Analytics consent');
    bar.innerHTML = `
      <div class="consent-inner">
        <div class="consent-text">
          <b>Analytics</b>
          <p>This site can load Google Analytics to count visits. It sets cookies and processes your IP address.
             Nothing is loaded until you choose, and declining costs you nothing — every lesson and lab still works.</p>
        </div>
        <div class="consent-actions">
          <button type="button" class="btn small primary" data-accept>Accept</button>
          <button type="button" class="btn small ghost" data-decline>Decline</button>
        </div>
      </div>`;
    document.body.appendChild(bar);

    bar.querySelector('[data-accept]').addEventListener('click', () => decide(true));
    bar.querySelector('[data-decline]').addEventListener('click', () => decide(false));
    return bar;
  }

  function decide(analytics) {
    write(analytics);
    if (analytics) loadAnalytics();
    hide();
  }

  function show() { (bar || build()).hidden = false; }
  function hide() { if (bar) bar.hidden = true; }

  function addFooterLink() {
    const foot = document.querySelector('.foot span');
    if (!foot || document.getElementById('consentLink')) return;
    const link = document.createElement('a');
    link.id = 'consentLink';
    link.href = '#';
    link.textContent = 'Cookie settings';
    link.style.marginLeft = '10px';
    link.addEventListener('click', e => { e.preventDefault(); show(); });
    foot.appendChild(link);
  }

  function init() {
    addFooterLink();

    const choice = read();
    if (choice) {
      if (choice.analytics) loadAnalytics();
      return;
    }

    // Respect Do Not Track: no banner, no analytics.
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') {
      write(false);
      return;
    }

    setTimeout(show, 1200);
  }

  document.addEventListener('DOMContentLoaded', init);
  window.Consent = { open: show, get: read };
})();
