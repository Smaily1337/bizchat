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
    // Nie przekazujemy hasła w URL — użytkownik loguje się w panelu.
    window.location.href = PANEL_URL;
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

const PLAN_META = {
  free: { name: "Trial", price: "0 zł (14 dni)" },
  starter: { name: "Starter", price: "149 zł netto / mies." },
  pro: { name: "Pro", price: "349 zł netto / mies." },
  enterprise: { name: "Enterprise", price: "wycena indywidualna" },
};

function selectPlan(planId) {
  const meta = PLAN_META[planId] || PLAN_META.starter;
  document.querySelectorAll("#pricing-grid .price-card").forEach((card) => {
    const on = card.dataset.plan === planId;
    card.classList.toggle("is-selected", on);
    card.setAttribute("aria-checked", on ? "true" : "false");
    const label = card.querySelector(".price-select-label");
    if (label) {
      label.textContent = on
        ? "Wybrany"
        : `Wybierz ${PLAN_META[card.dataset.plan]?.name || ""}`.trim();
    }
  });
  const nameEl = document.getElementById("selected-plan-label");
  const priceEl = document.getElementById("selected-plan-price");
  const cta = document.getElementById("continue-checkout");
  if (nameEl) nameEl.textContent = meta.name;
  if (priceEl) priceEl.textContent = meta.price;
  if (cta) cta.href = `checkout.html?plan=${encodeURIComponent(planId)}`;
}

const pricingGrid = document.getElementById("pricing-grid");
if (pricingGrid) {
  pricingGrid.querySelectorAll(".price-card").forEach((card) => {
    card.addEventListener("click", () => selectPlan(card.dataset.plan));
  });
  const preselected =
    pricingGrid.querySelector(".price-card.is-selected")?.dataset.plan || "starter";
  selectPlan(preselected);
}
