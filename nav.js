(() => {
  const nav = document.querySelector(".vnav");
  const links = Array.from(document.querySelectorAll(".vnav__link"));
  if (!nav || !links.length) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sections = links
    .map((a) => a.dataset.section)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  let lastActiveId = "";

  function setActive(sectionId) {
    if (sectionId === lastActiveId) return;
    lastActiveId = sectionId;
    for (const a of links) {
      const isActive = a.dataset.section === sectionId;
      a.classList.toggle("is-active", isActive);
      if (isActive) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      const img = a.querySelector("img");
      if (img && img.dataset.activeSrc && img.dataset.inactiveSrc) {
        img.src = isActive ? img.dataset.activeSrc : img.dataset.inactiveSrc;
      }
    }
  }

  /** Section whose top has crossed this viewport line (ratio of inner height) is "current" — updates as you scroll toward each block. */
  const ACTIVATION_LINE = 0.36;

  function activeSectionIdFromScroll() {
    if (!sections.length) return links[0].dataset.section;
    const line = window.innerHeight * ACTIVATION_LINE;
    let id = sections[0].id;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line) id = s.id;
    }
    return id;
  }

  let ticking = false;
  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      setActive(activeSectionIdFromScroll());
    });
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });

  // Smooth scroll on click (respect reduced motion)
  for (const a of links) {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", `#${id}`);
      lastActiveId = "";
      setActive(id);
    });
  }

  const initial = (location.hash || "#home").slice(1);
  setActive(document.getElementById(initial) ? initial : links[0].dataset.section);
  queueMicrotask(onScrollOrResize);
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

