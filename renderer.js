document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('version');
  if (window.electronAPI?.getVersion) {
    versionEl.textContent = window.electronAPI.getVersion();
  } else {
    versionEl.textContent = '—';
  }
});
