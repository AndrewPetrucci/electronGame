document.addEventListener('DOMContentLoaded', async () => {


  // Settings menu (Escape to open/close)
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsPanel = document.getElementById('settings-panel');
  const musicSettingsMenu = document.getElementById('music-settings-menu');
  const settingsMusicBtn = document.getElementById('settings-music-btn');
  const musicSettingsBack = document.getElementById('music-settings-back');
  const musicVolume = document.getElementById('music-volume');
  const musicVolumeValue = document.getElementById('music-volume-value');

  function openSettings() {
    settingsOverlay.hidden = false;
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  function closeSettings() {
    settingsOverlay.hidden = true;
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  function openMusicSettings() {
    settingsPanel.hidden = true;
    musicSettingsMenu.hidden = false;
  }

  function closeMusicSettings() {
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!musicSettingsMenu.hidden) {
      closeMusicSettings();
    } else if (!settingsOverlay.hidden) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsMusicBtn.addEventListener('click', openMusicSettings);
  musicSettingsBack.addEventListener('click', closeMusicSettings);

  const savedVolume = localStorage.getItem('musicVolume');
  if (savedVolume != null) {
    musicVolume.value = savedVolume;
    musicVolumeValue.textContent = savedVolume;
  }

  musicVolume.addEventListener('input', () => {
    const v = musicVolume.value;
    musicVolumeValue.textContent = v;
    localStorage.setItem('musicVolume', v);
  });
});
