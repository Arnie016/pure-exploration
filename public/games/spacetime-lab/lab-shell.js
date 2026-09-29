// Rehouse existing controls without duplicating simulation state or handlers.
export function mountLabShell() {
  const lab = document.querySelector('.laboratory');
  lab.classList.add('quiet-lab');
  lab.classList.toggle('journey-visible', new URLSearchParams(location.search).get('journey') === '1');
  const bar = document.createElement('nav');
  bar.className = 'lab-tools';
  bar.setAttribute('aria-label', 'Laboratory tools');
  const experiments = document.createElement('details');
  experiments.className = 'tool-menu experiment-menu';
  experiments.innerHTML = '<summary>Experiments</summary>';
  const dock = document.querySelector('.experiment-dock');
  const lessons = document.querySelector('#scientist-toggle');
  lessons.textContent = 'Lessons';
  const view = document.querySelector('.view-settings');
  view.classList.add('tool-menu');
  const viewBody = document.createElement('div');
  viewBody.className = 'tool-menu-body';
  for (const child of [...view.children]) if (child.tagName !== 'SUMMARY') viewBody.append(child);
  viewBody.prepend(document.querySelector('.camera-picker'), document.querySelector('.frame-reference-picker'));
  viewBody.append(document.querySelector('#radius-mode-toggle'), document.querySelector('.trail-controls'));
  const measurements = document.createElement('details');
  measurements.className = 'measurement-disclosure';
  measurements.innerHTML = '<summary>Solver measurements</summary>';
  measurements.append(document.querySelector('#simulation-diagnostics'));
  viewBody.append(measurements);
  view.append(viewBody);
  experiments.append(dock);
  const journey = document.createElement('button');
  journey.type = 'button';
  journey.textContent = 'Guided journey progress';
  journey.addEventListener('click', () => {
    lab.classList.toggle('journey-visible');
    experiments.open = false;
  });
  dock.append(journey);
  dock.addEventListener('click', event => {
    if (event.target.closest('button')) experiments.open = false;
  });
  bar.append(lessons, experiments, view);
  lab.append(bar);
  lessons.addEventListener('click', () => { experiments.open = false; view.open = false; });
  for (const menu of [experiments, view]) {
    menu.addEventListener('toggle', () => {
      if (menu.open) for (const other of [experiments, view]) if (other !== menu) other.open = false;
    });
  }
  document.addEventListener('pointerdown', event => {
    if (!bar.contains(event.target)) for (const menu of [experiments, view]) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const menu of [experiments, view]) {
      if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    }
  });
  const status = document.createElement('div');
  status.className = 'simulation-status';
  status.innerHTML = '<span id="playback-state">Paused</span><span id="scene-count"></span><span id="scene-time"></span><small id="playback-performance"></small>';
  document.querySelector('.scale-readout').append(status);
}
