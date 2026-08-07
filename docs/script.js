// Adres panelu admina BizChat.
// Strona jest statyczna (GitHub Pages) — podmień na adres własnej instancji,
// np. "https://panel.twojadomena.pl/login".
const PANEL_URL = "http://localhost:5173/login";

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
