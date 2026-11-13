if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.dataset.motion = 'ok';
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.2 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}
