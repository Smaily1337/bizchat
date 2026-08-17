/**
 * BizChat embeddable chat widget (vanilla JS, no build step).
 *
 * Usage:
 *   <script src="bizchat-widget.js"
 *     data-api="http://localhost:8000"
 *     data-business-id="UUID"></script>
 *
 * Or: BizChatWidget.mount({ apiBase, businessId, name })
 */
(function (global) {
  "use strict";

  var STYLE_ID = "bizchat-widget-style";
  var ROOT_ID = "bizchat-widget-root";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + ROOT_ID + "{position:fixed;right:20px;bottom:20px;z-index:99999;font-family:system-ui,sans-serif}" +
      "#" + ROOT_ID + " .bc-launcher{width:56px;height:56px;border-radius:16px;border:1px solid rgba(255,255,255,.18);" +
      "background:#FFFFFF;color:#2F3131;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35)}" +
      "#" + ROOT_ID + " .bc-panel{display:none;position:absolute;right:0;bottom:70px;width:min(360px,calc(100vw - 32px));" +
      "height:480px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.14);" +
      "background:rgba(18,20,23,.92);backdrop-filter:blur(16px);color:#fff;box-shadow:0 16px 48px rgba(0,0,0,.45);" +
      "flex-direction:column}" +
      "#" + ROOT_ID + " .bc-panel.open{display:flex}" +
      "#" + ROOT_ID + " .bc-head{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.12);font-weight:700}" +
      "#" + ROOT_ID + " .bc-head span{display:block;font-size:11px;font-weight:500;color:rgba(255,255,255,.55);margin-top:2px}" +
      "#" + ROOT_ID + " .bc-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}" +
      "#" + ROOT_ID + " .bc-bubble{max-width:85%;padding:8px 11px;border-radius:12px;font-size:13px;line-height:1.4;white-space:pre-wrap}" +
      "#" + ROOT_ID + " .bc-bot{align-self:flex-start;background:rgba(255,255,255,.08)}" +
      "#" + ROOT_ID + " .bc-user{align-self:flex-end;background:rgba(244,224,77,.2);border:1px solid rgba(244,224,77,.35)}" +
      "#" + ROOT_ID + " .bc-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.12)}" +
      "#" + ROOT_ID + " .bc-form input{flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.14);" +
      "background:rgba(255,255,255,.06);color:#fff;padding:10px 12px;outline:none}" +
      "#" + ROOT_ID + " .bc-form button{border:0;border-radius:10px;background:#FFFFFF;color:#2F3131;font-weight:700;padding:0 14px;cursor:pointer}";
    document.head.appendChild(style);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(opts) {
    opts = opts || {};
    var apiBase = (opts.apiBase || "http://localhost:8000").replace(/\/$/, "");
    var businessId = opts.businessId;
    if (!businessId) {
      console.error("BizChatWidget: businessId required");
      return;
    }

    ensureStyles();
    var existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();

    var root = el("div");
    root.id = ROOT_ID;
    var launcher = el("button", "bc-launcher", "B");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Otwórz chat BizChat");

    var panel = el("div", "bc-panel");
    var head = el("div", "bc-head", "BizChat");
    head.appendChild(el("span", null, "Asystent rezerwacji"));
    var msgs = el("div", "bc-msgs");
    var form = el("form", "bc-form");
    var input = document.createElement("input");
    input.placeholder = "Napisz wiadomość…";
    input.autocomplete = "off";
    var sendBtn = el("button", null, "→");
    sendBtn.type = "submit";
    form.appendChild(input);
    form.appendChild(sendBtn);
    panel.appendChild(head);
    panel.appendChild(msgs);
    panel.appendChild(form);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    var sessionToken = null;
    var open = false;

    function addBubble(text, who) {
      msgs.appendChild(el("div", "bc-bubble bc-" + who, text));
      msgs.scrollTop = msgs.scrollHeight;
    }

    async function ensureSession() {
      if (sessionToken) return sessionToken;
      var res = await fetch(apiBase + "/webhooks/widget/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          name: opts.name || null,
        }),
      });
      if (!res.ok) throw new Error("Session failed");
      var data = await res.json();
      sessionToken = data.session_token;
      return sessionToken;
    }

    async function send(text) {
      addBubble(text, "user");
      try {
        var token = await ensureSession();
        var res = await fetch(apiBase + "/webhooks/widget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: token,
            business_id: businessId,
            text: text,
          }),
        });
        if (!res.ok) {
          var err = await res.text();
          addBubble("Błąd: " + err, "bot");
          return;
        }
        var data = await res.json();
        addBubble(data.reply || "(brak odpowiedzi)", "bot");
      } catch (e) {
        addBubble("Nie udało się połączyć z API (" + apiBase + ").", "bot");
      }
    }

    launcher.addEventListener("click", function () {
      open = !open;
      panel.classList.toggle("open", open);
      if (open && msgs.childNodes.length === 0) {
        addBubble(
          "Cześć! Napisz „umów wizytę” albo pytanie o godziny / lokalizację.",
          "bot"
        );
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      send(text);
    });

    return {
      open: function () {
        open = true;
        panel.classList.add("open");
      },
      close: function () {
        open = false;
        panel.classList.remove("open");
      },
    };
  }

  function autoMountFromScript() {
    var scripts = document.getElementsByTagName("script");
    var current = scripts[scripts.length - 1];
    var businessId = current && current.getAttribute("data-business-id");
    if (!businessId) return;
    mount({
      apiBase: current.getAttribute("data-api") || "http://localhost:8000",
      businessId: businessId,
      name: current.getAttribute("data-name") || undefined,
    });
  }

  global.BizChatWidget = { mount: mount };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMountFromScript);
  } else {
    autoMountFromScript();
  }
})(typeof window !== "undefined" ? window : globalThis);
