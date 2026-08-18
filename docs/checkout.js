/** Automovia checkout demo — plan → company → pay → invoice */

const PLANS = {
  free: {
    id: "free",
    name: "Trial / Free",
    net: 0,
    blurb: "14 dni trial, potem Free · 30 wizyt · 2 stanowiska",
  },
  starter: {
    id: "starter",
    name: "Starter",
    net: 149,
    blurb: "150 wizyt · 2000 wiadomości · 5 stanowisk",
  },
  pro: {
    id: "pro",
    name: "Pro",
    net: 349,
    blurb: "Bez limitu wizyt i wiadomości · 20 stanowisk",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    net: 899,
    blurb: "Demo wyceny · bez limitów · SLA (kwota poglądowa)",
  },
};

const SELLER = {
  name: "Automovia Sp. z o.o.",
  street: "ul. Prosta 18",
  zip: "00-850",
  city: "Warszawa",
  nip: "5252941823",
  regon: "389012345",
  email: "faktury@automovia.pl",
};

const VAT_RATE = 0.23;
const STORAGE_KEY = "automovia_checkout_demo";

const state = {
  step: 1,
  planId: "starter",
  company: null,
  payment: null,
  invoiceNo: null,
  paidAt: null,
};

function money(n) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (_) {
    /* ignore */
  }
  const fromUrl = qs("plan");
  if (fromUrl && PLANS[fromUrl]) state.planId = fromUrl;
}

function saveState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentPlan() {
  return PLANS[state.planId] || PLANS.starter;
}

function amounts(net) {
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { net, vat, gross };
}

function setStep(n) {
  state.step = n;
  saveState();
  document.querySelectorAll("[data-panel]").forEach((el) => {
    const id = Number(el.dataset.panel);
    el.hidden = id !== n;
  });
  document.querySelectorAll("#checkout-steps li").forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("is-active", s === n);
    li.classList.toggle("is-done", s < n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPlanPick() {
  const root = document.getElementById("plan-pick");
  if (!root) return;
  root.innerHTML = Object.values(PLANS)
    .map((p) => {
      const selected = p.id === state.planId ? "is-selected" : "";
      const price =
        p.net === 0 ? "0 zł / mies." : `${p.net} zł netto / mies.`;
      return `<button type="button" class="plan-option ${selected}" data-plan="${p.id}" role="radio" aria-checked="${p.id === state.planId}">
        <strong>${p.name}</strong>
        <div class="plan-meta">${p.blurb}</div>
        <div class="plan-price">${price}</div>
      </button>`;
    })
    .join("");

  root.querySelectorAll(".plan-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.planId = btn.dataset.plan;
      saveState();
      renderPlanPick();
      updateSummary();
    });
  });
}

function updateSummary() {
  const plan = currentPlan();
  const { net, vat, gross } = amounts(plan.net);
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("sum-plan", plan.name);
  set("sum-net", money(net));
  set("sum-vat", money(vat));
  set("sum-gross", money(gross));
  set("pay-amount-label", money(gross));
}

function formatCard(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function invoiceNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `FV-DEMO/${y}/${m}/${rnd}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInvoice() {
  const plan = currentPlan();
  const { net, vat, gross } = amounts(plan.net);
  const c = state.company || {};
  const paidAt = state.paidAt ? new Date(state.paidAt) : new Date();
  const issue = paidAt.toLocaleDateString("pl-PL");
  const inv = state.invoiceNo || invoiceNumber();
  state.invoiceNo = inv;

  const el = document.getElementById("invoice");
  if (!el) return;

  el.innerHTML = `
    <div class="invoice-top">
      <div>
        <h3>Faktura VAT (demo)</h3>
        <p style="margin:0;color:#555">Sprzedaż usług SaaS — Automovia</p>
      </div>
      <div class="invoice-meta">
        <div><strong>Nr:</strong> ${escapeHtml(inv)}</div>
        <div><strong>Data wystawienia:</strong> ${issue}</div>
        <div><strong>Data sprzedaży:</strong> ${issue}</div>
        <div><strong>Sposób zapłaty:</strong> karta (demo)</div>
      </div>
    </div>
    <div class="invoice-parties">
      <div>
        <h4>Sprzedawca</h4>
        <p><strong>${escapeHtml(SELLER.name)}</strong></p>
        <p>${escapeHtml(SELLER.street)}</p>
        <p>${escapeHtml(SELLER.zip)} ${escapeHtml(SELLER.city)}</p>
        <p>NIP: ${escapeHtml(SELLER.nip)}</p>
        <p>REGON: ${escapeHtml(SELLER.regon)}</p>
        <p>${escapeHtml(SELLER.email)}</p>
      </div>
      <div>
        <h4>Nabywca</h4>
        <p><strong>${escapeHtml(c.company || "—")}</strong></p>
        <p>${escapeHtml(c.street || "")}</p>
        <p>${escapeHtml(c.zip || "")} ${escapeHtml(c.city || "")}</p>
        <p>NIP: ${escapeHtml(c.nip || "—")}</p>
        ${c.regon ? `<p>REGON: ${escapeHtml(c.regon)}</p>` : ""}
        <p>${escapeHtml(c.email || "")}</p>
        ${c.phone ? `<p>tel. ${escapeHtml(c.phone)}</p>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Lp.</th>
          <th>Nazwa</th>
          <th class="num">Ilość</th>
          <th class="num">Netto</th>
          <th class="num">VAT</th>
          <th class="num">Brutto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Abonament Automovia — pakiet ${escapeHtml(plan.name)} (1 miesiąc)</td>
          <td class="num">1</td>
          <td class="num">${money(net)}</td>
          <td class="num">23%</td>
          <td class="num">${money(gross)}</td>
        </tr>
      </tbody>
    </table>
    <div class="invoice-totals">
      <div><span>Razem netto</span><span>${money(net)}</span></div>
      <div><span>VAT 23%</span><span>${money(vat)}</span></div>
      <div class="grand"><span>Do zapłaty</span><span>${money(gross)}</span></div>
    </div>
    <div class="invoice-stamp">OPŁACONO · płatność demo · nie stanowi dokumentu księgowego</div>
    <p class="invoice-footer-note">
      Dokument wygenerowany automatycznie w środowisku demonstracyjnym Automovia.
      Nie jest fakturą w rozumieniu ustawy o VAT — służy wyłącznie do podglądu flow zakupowego.
    </p>
  `;
}

function wireForms() {
  document.getElementById("btn-to-company")?.addEventListener("click", () => {
    updateSummary();
    setStep(2);
  });

  document.getElementById("btn-back-plan")?.addEventListener("click", () => setStep(1));
  document.getElementById("btn-back-company")?.addEventListener("click", () => setStep(2));

  document.getElementById("company-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    state.company = {
      company: String(fd.get("company") || "").trim(),
      nip: String(fd.get("nip") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      street: String(fd.get("street") || "").trim(),
      zip: String(fd.get("zip") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      regon: String(fd.get("regon") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
    };
    saveState();
    updateSummary();
    setStep(3);
  });

  const cardInput = document.querySelector('input[name="card"]');
  cardInput?.addEventListener("input", () => {
    cardInput.value = formatCard(cardInput.value);
  });

  const expInput = document.querySelector('input[name="expiry"]');
  expInput?.addEventListener("input", () => {
    expInput.value = formatExpiry(expInput.value);
  });

  document.getElementById("pay-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    const card = String(form.elements.card.value).replace(/\s/g, "");
    if (card.length < 13) {
      form.elements.card.setCustomValidity("Podaj numer karty (demo: 4242…)");
      form.elements.card.reportValidity();
      return;
    }
    form.elements.card.setCustomValidity("");

    const progress = document.getElementById("pay-progress");
    const layout = document.querySelector(".pay-layout");
    const actions = form.querySelector(".checkout-actions");
    if (layout) layout.hidden = true;
    if (actions) actions.hidden = true;
    if (progress) progress.hidden = false;

    await new Promise((r) => setTimeout(r, 1400));

    state.payment = {
      last4: card.slice(-4),
      cardholder: String(form.elements.cardholder.value).trim(),
      method: "card_demo",
    };
    state.paidAt = new Date().toISOString();
    state.invoiceNo = invoiceNumber();
    saveState();

    if (progress) progress.hidden = true;
    if (layout) layout.hidden = false;
    if (actions) actions.hidden = false;

    renderInvoice();
    setStep(4);
  });

  document.getElementById("btn-print")?.addEventListener("click", () => window.print());

  document.getElementById("btn-download")?.addEventListener("click", () => {
    const inv = document.getElementById("invoice");
    if (!inv) return;
    const html = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"/><title>${state.invoiceNo || "Faktura"}</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;color:#111;padding:0 1rem}
        h3{color:#0f766e} table{width:100%;border-collapse:collapse} th,td{padding:.5rem;border-bottom:1px solid #e5e7eb;text-align:left}
        .num{text-align:right} .grand{font-weight:700;border-top:2px solid #0f766e;margin-top:.5rem;padding-top:.5rem;display:flex;justify-content:space-between}
        .stamp{margin-top:1.5rem;padding:.65rem;border:1px dashed #0f766e;color:#0f766e;font-weight:600}
      </style></head><body>${inv.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.invoiceNo || "faktura-demo").replace(/\//g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function prefillCompany() {
  if (!state.company) return;
  const form = document.getElementById("company-form");
  if (!form) return;
  for (const [k, v] of Object.entries(state.company)) {
    if (form.elements[k]) form.elements[k].value = v;
  }
}

function initReveal() {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
}

loadState();
renderPlanPick();
updateSummary();
wireForms();
prefillCompany();
initReveal();

if (state.step === 4 && state.paidAt) {
  renderInvoice();
  setStep(4);
} else if (state.step >= 2 && state.step <= 3) {
  setStep(state.step);
} else {
  setStep(1);
}

try {
  const payload = JSON.stringify({
    path: "/checkout.html",
    referrer: document.referrer || null,
    session_id: sessionStorage.getItem("automovia_sid") || "checkout",
  });
  navigator.sendBeacon?.(
    "https://bizchat-api-702906501614.europe-central2.run.app/api/analytics/pageview",
    new Blob([payload], { type: "application/json" }),
  );
} catch (_) {
  /* ignore */
}
