// Apply the saved appearance before Angular boots, so the page never flashes the wrong mode.
try {
  var a = localStorage.getItem('cortex.appearance') || 'auto';
  if (a === 'auto') a = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = a;
} catch (e) {}
