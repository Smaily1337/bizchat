const PANEL_URL = "https://bizchat-panel-702906501614.europe-central2.run.app/login";
const API_URL = "https://bizchat-api-702906501614.europe-central2.run.app";

function trackPageview() {
  try {
    const key = "automovia_sid";
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, sessionId);
    }
    const payload = JSON.stringify({
      path: window.location.pathname || "/",
      referrer: document.referrer || null,
      session_id: sessionId,
    });
    const url = `${API_URL}/api/analytics/pageview`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        mode: "cors",
      }).catch(() => {});
    }
  } catch (_) {
    /* ignore */
  }
}

trackPageview();

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const hash = `#email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    window.location.href = PANEL_URL + hash;
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
);

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i % 6, 3) * 60}ms`;
  observer.observe(el);
});
