/* Static hub adapter. Scientific modules are copied without modification. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const disconnected = new Set(['/api/lab/explain', '/api/live/session', '/api/live/preflight', '/api/lab/system-builds']);
  window.fetch = (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof Request ? input.url : String(input), location.href);
    if (target.origin === location.origin && (disconnected.has(target.pathname) || target.pathname.startsWith('/api/lab/system-builds/'))) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'The AI guide is not connected in this hub. The Simulation library, orbital workbench and local lessons are available.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    }
    return originalFetch(input, init);
  };
})();

// Keep original controls accessible after the existing shell rehouses them.
document.addEventListener('DOMContentLoaded', () => {
  for (const button of document.querySelectorAll('.experiment-dock button')) {
    const name = button.textContent.trim();
    button.setAttribute('aria-label', name);
    if (name === 'Guided journey progress') button.hidden = true;
  }
  const guide = document.querySelector('#guide-card');
  if (guide) guide.setAttribute('aria-label', 'AI guide is not connected in this hub');
});
