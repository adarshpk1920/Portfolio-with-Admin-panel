// Runs in <head> before paint so the saved theme never flashes.
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));
})();
