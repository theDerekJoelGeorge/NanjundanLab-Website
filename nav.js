(() => {
  const nav = document.querySelector(".vnav");
  const links = Array.from(document.querySelectorAll(".vnav__link"));
  if (!nav || !links.length) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setActive(sectionId) {
    for (const a of links) {
      const isActive = a.dataset.section === sectionId;
      a.classList.toggle("is-active", isActive);
      a.setAttribute("aria-current", isActive ? "true" : "false");
      const img = a.querySelector("img");
      if (img) img.src = isActive ? img.dataset.activeSrc : img.dataset.inactiveSrc;
    }
  }

  // Smooth scroll on click (respect reduced motion)
  for (const a of links) {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
      setActive(id);
    });
  }

  // Scroll spy via IntersectionObserver
  const sections = links
    .map((a) => a.dataset.section)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const obs = new IntersectionObserver(
    (entries) => {
      // pick the entry closest to center that is intersecting
      const visible = entries.filter((e) => e.isIntersecting);
      if (!visible.length) return;
      visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const id = visible[0].target.id;
      setActive(id);
    },
    {
      root: null,
      threshold: [0.25, 0.35, 0.5, 0.65],
      rootMargin: "-30% 0px -55% 0px",
    },
  );

  for (const s of sections) obs.observe(s);

  // Initial state
  const initial = (location.hash || "#home").slice(1);
  setActive(document.getElementById(initial) ? initial : links[0].dataset.section);
})();

(() => {
  const root = document.querySelector(".about-slideshow");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".about-slideshow__slide"));
  const dots = Array.from(root.querySelectorAll(".about-slideshow__dot"));
  if (slides.length === 0) return;

  let index = 0;
  let timer = null;
  const intervalMs = 5500;
  const slideshowReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((slide, j) => slide.classList.toggle("is-active", j === index));
    dots.forEach((dot, j) => {
      const on = j === index;
      dot.classList.toggle("is-active", on);
      if (on) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }

  function next() {
    show(index + 1);
  }

  function startAutoplay() {
    if (slideshowReducedMotion || slides.length < 2) return;
    stopAutoplay();
    timer = window.setInterval(next, intervalMs);
  }

  function stopAutoplay() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  dots.forEach((dot, j) => {
    dot.addEventListener("click", () => {
      show(j);
      stopAutoplay();
      startAutoplay();
    });
  });

  root.addEventListener("mouseenter", stopAutoplay);
  root.addEventListener("mouseleave", startAutoplay);
  root.addEventListener("focusin", stopAutoplay);
  root.addEventListener("focusout", () => {
    queueMicrotask(() => {
      if (!root.contains(document.activeElement)) startAutoplay();
    });
  });

  startAutoplay();
})();

