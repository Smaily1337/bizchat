// Adres panelu admina BizChat (Cloud Run).
const PANEL_URL = "https://bizchat-panel-702906501614.europe-central2.run.app/login";

// Formularz logowania przekazuje dane do panelu we fragmencie URL (#…),
// który nigdy nie opuszcza przeglądarki — panel loguje się automatycznie
// i od razu przenosi do środka.
document.getElementById("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const hash = `#email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  window.location.href = PANEL_URL + hash;
});

// Micro-interaction: sekcje wjeżdżają przy scrollowaniu.
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
);

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 6, 3) * 70}ms`;
  observer.observe(el);
});

// Micro-interaction: liczniki statystyk odliczają, gdy sekcja wjedzie na ekran.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateCounter(el) {
  const target = Number(el.dataset.target || "0");
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  if (reducedMotion) {
    el.textContent = `${prefix}${target}${suffix}`;
    return;
  }
  const duration = 1400;
  const start = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = `${prefix}${Math.round(target * easeOut(progress))}${suffix}`;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const counterObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.6 }
);

document.querySelectorAll(".counter").forEach((el) => counterObserver.observe(el));
