(function () {
  const logoArea    = document.getElementById('logoBtn')?.closest('.logo-area');
  const logoBtn     = document.getElementById('logoBtn');
  const hoverStrip  = document.getElementById('logoHoverStrip');
  const plusIcon    = document.getElementById('plusIcon');
  const panelExpand = document.getElementById('panelExpand');
  const expandClose = document.getElementById('expandClose');
  const swatches    = document.querySelectorAll('.swatch');
  const preview     = document.getElementById('swatchPreview');
  const previewImg  = document.getElementById('swatchPreviewImg');

  if (!logoArea) return;

  let isExpanded = false;

  function openExpand() {
    isExpanded = true;
    logoArea.classList.add('expanded');
    panelExpand.classList.add('is-open');
    panelExpand.setAttribute('aria-hidden', 'false');
    logoBtn.setAttribute('aria-expanded', 'true');
    if (plusIcon) plusIcon.style.transform = 'rotate(45deg)';
  }

  function closeExpand() {
    isExpanded = false;
    logoArea.classList.remove('expanded');
    panelExpand.classList.remove('is-open');
    panelExpand.setAttribute('aria-hidden', 'true');
    logoBtn.setAttribute('aria-expanded', 'false');
    if (plusIcon) plusIcon.style.transform = 'rotate(0deg)';
    hideSwatchPreview();
  }

  logoBtn.addEventListener('click', () => {
    if (isExpanded) {
      closeExpand();
    } else {
      openExpand();
    }
  });

  if (hoverStrip) {
    hoverStrip.addEventListener('click', () => {
      if (!isExpanded) openExpand();
    });
  }

  if (expandClose) {
    expandClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeExpand();
    });
  }

  function showSwatchPreview(src) {
    if (!preview || !previewImg || !src) return;
    previewImg.src = src;
    preview.classList.add('is-visible');
  }

  function hideSwatchPreview() {
    if (!preview) return;
    preview.classList.remove('is-visible');
    if (previewImg) previewImg.src = '';
  }

  swatches.forEach(swatch => {
    swatch.addEventListener('mouseenter', () => {
      const src = swatch.dataset.preview;
      showSwatchPreview(src);
    });

    swatch.addEventListener('mouseleave', () => {
      hideSwatchPreview();
    });
  });

  document.addEventListener('click', (e) => {
    if (isExpanded && !logoArea.contains(e.target) && !panelExpand.contains(e.target)) {
      closeExpand();
    }
  });
})();
