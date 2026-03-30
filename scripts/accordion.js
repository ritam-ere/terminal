(function () {
  const wrapper  = document.getElementById('sectionsWrapper');
  const sections = Array.from(document.querySelectorAll('.section'));

  const COLLAPSED_W  = 56;
  const COLLAPSED_H  = 48;
  const RATIOS       = [1.5, 2.25, 3.375];
  const EASING       = 'width 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
  const EASING_H     = 'height 0.55s cubic-bezier(0.4, 0, 0.2, 1)';

  let activeIndex = null;

  function isPortrait() {
    return window.matchMedia('(orientation: portrait)').matches
        || window.innerWidth <= 767;
  }

  function applyWidths(widths) {
    sections.forEach((s, i) => {
      s.style.width  = widths[i] + 'px';
      s.style.height = '';
    });
  }

  function applyHeights(heights) {
    sections.forEach((s, i) => {
      s.style.height = heights[i] + 'px';
      s.style.width  = '100%';
    });
  }

  function portraitH() {
    const infoEl = document.querySelector('.mobile-info-bar');
    const infoH  = infoEl ? infoEl.offsetHeight : 104;
    const h      = window.innerHeight - infoH;
    wrapper.style.height = h + 'px';
    return h;
  }

  function defaultWidths() {
    const total = wrapper.getBoundingClientRect().width;
    const unit  = total / (RATIOS[0] + RATIOS[1] + RATIOS[2]);
    return RATIOS.map(r => Math.round(unit * r));
  }

  function defaultHeights() {
    const total = portraitH();
    const unit  = total / (RATIOS[0] + RATIOS[1] + RATIOS[2]);
    return RATIOS.map(r => Math.round(unit * r));
  }

  function activeWidths(activeI) {
    const total    = wrapper.getBoundingClientRect().width;
    const expanded = total - COLLAPSED_W * (sections.length - 1);
    return sections.map((_, i) => i === activeI ? Math.round(expanded) : COLLAPSED_W);
  }

  function activeHeights(activeI) {
    const total    = portraitH();
    const expanded = total - COLLAPSED_H * (sections.length - 1);
    return sections.map((_, i) => i === activeI ? Math.round(expanded) : COLLAPSED_H);
  }

  function enableTransitions() {
    sections.forEach(s => {
      s.style.transition = isPortrait() ? EASING_H : EASING;
      s.style.overflow   = 'hidden';
      s.style.flexShrink = '0';
    });
  }

  function init() {
    sections.forEach(s => { s.style.transition = 'none'; });
    if (isPortrait()) {
      applyHeights(defaultHeights());
    } else {
      applyWidths(defaultWidths());
    }
    requestAnimationFrame(() => requestAnimationFrame(enableTransitions));
  }

  function activateSection(targetIndex) {
    const targetI = parseInt(targetIndex) - 1;

    if (activeIndex === targetIndex) {
      wrapper.removeAttribute('data-active');
      sections.forEach(s => s.classList.remove('is-active', 'is-collapsed'));
      if (isPortrait()) applyHeights(defaultHeights());
      else              applyWidths(defaultWidths());
      activeIndex = null;
      return;
    }

    wrapper.setAttribute('data-active', targetIndex);
    sections.forEach((s, i) => {
      if (i === targetI) { s.classList.add('is-active'); s.classList.remove('is-collapsed'); }
      else               { s.classList.add('is-collapsed'); s.classList.remove('is-active'); }
    });

    if (isPortrait()) applyHeights(activeHeights(targetI));
    else              applyWidths(activeWidths(targetI));
    activeIndex = targetIndex;
  }

  sections.forEach(s => {
    s.addEventListener('click', e => {
      if (s.classList.contains('is-active') && e.target.closest('.section-content')) return;
      activateSection(s.dataset.index);
    });
  });

  function recalc() {
    const portrait = isPortrait();
    if (activeIndex !== null) {
      const targetI = parseInt(activeIndex) - 1;
      if (portrait) applyHeights(activeHeights(targetI));
      else          applyWidths(activeWidths(targetI));
    } else {
      if (portrait) applyHeights(defaultHeights());
      else          applyWidths(defaultWidths());
    }
  }

  function resetLayout() {
    wrapper.removeAttribute('data-active');
    sections.forEach(s => { s.classList.remove('is-active', 'is-collapsed'); s.style.transition = 'none'; });
    activeIndex = null;
    setTimeout(() => {
      if (isPortrait()) {
        wrapper.style.height = '';
        applyHeights(defaultHeights());
      } else {
        wrapper.style.height = '';
        applyWidths(defaultWidths());
      }
      requestAnimationFrame(() => requestAnimationFrame(enableTransitions));
    }, 100);
  }

  window.addEventListener('orientationchange', resetLayout);

  let resizeTimer;
  let prevPortrait = isPortrait();
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nowPortrait = isPortrait();
      if (nowPortrait !== prevPortrait) {
        prevPortrait = nowPortrait;
        resetLayout();
      } else {
        recalc();
      }
    }, 80);
  });

  init();
})();
