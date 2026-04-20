(() => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) return;

  const candidates = Array.from(
    document.querySelectorAll(
      [
        "section",
        ".counter-area-1",
        ".counter-card",
        ".property-card-wrap",
        ".service-card",
        ".th-blog",
        ".aminities-card",
      ].join(",")
    )
  );

  candidates.forEach((el) => {
    if (!el.classList.contains("reveal-on-scroll")) {
      el.classList.add("reveal-on-scroll");
    }
  });

  // Small stagger so lists/grids feel smoother
  candidates.forEach((el, idx) => {
    // Keep stagger subtle and bounded, so it doesn't feel "laggy"
    const delay = Math.min(140, idx * 22);
    el.style.transitionDelay = `${delay}ms`;
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { root: null, threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
  );

  candidates.forEach((el) => io.observe(el));
})();

