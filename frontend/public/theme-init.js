try {
  if (localStorage.getItem('toms_theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch { /* Theme is optional when storage is unavailable. */ }
