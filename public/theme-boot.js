(function () {
  try {
    var mode = localStorage.getItem('meta_capsule_theme');
    var dark =
      mode === 'dark' ||
      ((mode === 'system' || !mode) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (mode === 'light') dark = false;
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
