(function () {
  const galleryScroll = document.querySelector('.gallery-scroll');
  const galleryTrack  = galleryScroll && galleryScroll.querySelector('.gallery-track');

  if (!galleryScroll || !galleryTrack) return;

  function clamp(min, max, v) { return v < min ? min : v > max ? max : v; }

  function update() {
    const H = galleryScroll.clientHeight;
    if (H < 50) return;

    const S     = galleryScroll.scrollTop;
    const items = galleryTrack.querySelectorAll('.gallery-item');

    items.forEach(item => {
      const W     = item.offsetWidth;
      const itemH = item.offsetHeight;

      if (W < 1 || itemH < 1) return;

      const posTop    = item.offsetTop - S;
      const posBottom = posTop + itemH;

      const fTop    = clamp(0, 1, posTop    / H);
      const fBottom = clamp(0, 1, posBottom / H);

      const w1 = 0.5 + 0.5 * fTop;
      const w2 = 0.5 + 0.5 * fBottom;

      const s = (1 - w1) / 2;
      const t = (1 - w2) / 2;

      const m0  = w1;
      const m4  = (W / itemH) * (w1 * t / w2 - s);
      const m5  = w1 / w2;
      const m7  = (w1 - w2) / (w2 * itemH);
      const m12 = W * s;

      item.style.transformOrigin = '0 0';
      item.style.transform =
        `matrix3d(${m0},0,0,0, ${m4},${m5},0,${m7}, 0,0,1,0, ${m12},0,0,1)`;
    });
  }

  galleryScroll.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(galleryScroll);
  }

  update();
})();
