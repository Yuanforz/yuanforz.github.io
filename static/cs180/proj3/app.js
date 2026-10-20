(() => {
  const body = document.body;
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  document.querySelectorAll('[data-epoch-group]').forEach(group => {
    group.querySelectorAll('[data-epoch]').forEach(button => button.addEventListener('click', () => {
      group.querySelectorAll('[data-epoch]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      group.querySelectorAll('[data-epoch-panel]').forEach(panel => panel.hidden = panel.dataset.epochPanel !== button.dataset.epoch);
    }));
  });

  document.querySelectorAll('[data-flip]').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.flip);
      const active = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(active));
      target.classList.toggle('rotated', active);
      button.textContent = active ? 'Return upright' : 'Rotate 180°';
      const label = document.getElementById(button.dataset.label);
      if (label) label.textContent = active ? button.dataset.rotatedPrompt : button.dataset.uprightPrompt;
    });
  });

  const dialog = document.getElementById('figure-dialog');
  const detailImage = document.getElementById('detail-image');
  const detailCaption = document.getElementById('detail-caption');
  const original = document.getElementById('open-original');
  document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
    const image = button.querySelector('img');
    if (!image || !dialog) return;
    detailImage.src = image.src;
    detailImage.alt = image.alt;
    detailImage.className = image.className;
    detailCaption.textContent = button.closest('figure')?.querySelector('figcaption')?.textContent || image.alt;
    original.href = image.src;
    dialog.showModal();
  }));
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });

  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => link.removeAttribute('aria-current'));
      links.find(link => link.hash === '#' + entry.target.id)?.setAttribute('aria-current', 'location');
    });
  }, { rootMargin: '-12% 0px -70% 0px', threshold: 0 });
  document.querySelectorAll('.section[id],.chapter[id]').forEach(section => observer.observe(section));
  const line = document.querySelector('.reading-line');
  const progress = () => {
    const travel = document.documentElement.scrollHeight - innerHeight;
    if (line) line.style.width = Math.min(100, 100 * scrollY / Math.max(1, travel)) + '%';
  };
  addEventListener('scroll', progress, { passive: true });
  progress();
})();
