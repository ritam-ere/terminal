(function () {
  const clockEl      = document.getElementById('clockTime');
  const bulletEl     = document.getElementById('clockBullet');
  const mobileClockEl  = document.getElementById('mobileClockTime');
  const mobileBulletEl = document.getElementById('mobileClockBullet');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function updateClock() {
    const now = new Date();
    const h = pad(now.getHours());
    const m = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    const timeStr = `${h}:${m}:${s}`;

    if (clockEl)      clockEl.textContent = timeStr;
    if (mobileClockEl) mobileClockEl.textContent = timeStr;
  }

  let bulletVisible = true;
  function blinkBullet() {
    bulletVisible = !bulletVisible;
    const opacity = bulletVisible ? '1' : '0';
    if (bulletEl)       bulletEl.style.opacity = opacity;
    if (mobileBulletEl) mobileBulletEl.style.opacity = opacity;
  }

  updateClock();

  setInterval(() => {
    updateClock();
    blinkBullet();
  }, 1000);
})();
