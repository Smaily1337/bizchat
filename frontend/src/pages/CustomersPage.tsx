import { type FormEvent, useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { customersApi, inboxApi, tagsApi } from "@/api";
import type { Channel, Customer, CustomerTag } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const TAG_COLORS = [
  "#3e63dd",
  "#62539f",
  "#954181",
  "#00a389",
  "#e5484d",
  "#f76808",
  "#30a46c",
  "#8e4ec6",
];

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function channelBadges(c: Customer) {
  const ext = c.external_ids || {};
  const out: { name: string; icon: string; color: string }[] = [];
  if (ext.messenger) out.push({ name: "Messenger", icon: "chat", color: "bg-[#0084FF]" });
  if (ext.instagram) out.push({ name: "IG", icon: "photo_camera", color: "bg-[#E1306C]" });
  if (ext.telegram) out.push({ name: "Telegram", icon: "send", color: "bg-[#229ED9]" });
  if (ext.whatsapp) out.push({ name: "WhatsApp", icon: "phone_iphone", color: "bg-[#25D366]" });
  return out;
}

export function CustomersPage() {
  const { push } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterTagId, setFilterTagId] = useState<string>("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    messenger_psid: "",
  });

  const [tagForm, setTagForm] = useState({
    name: "",
    color: TAG_COLORS[0],
  });

  const [messageFor, setMessageFor] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<Channel>("messenger");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPsid, setEditPsid] = useState("");
  const [tagEditId, setTagEditId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [cust, tagList] = await Promise.all([
      customersApi.list(),
      tagsApi.list(),
    ]);
    setCustomers(cust);
    setTags(tagList);
  }, []);

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await customersApi.create({
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        messenger_psid: form.messenger_psid.trim() || undefined,
      });
      setForm({ name: "", phone: "", email: "", messenger_psid: "" });
      push({ title: "Dodano klienta", message: "Pomyślnie utworzono profil klienta", tone: "canary" });
      setAddCustomerOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd dodawania klienta");
    }
  }

  async function onCreateTag(e: FormEvent) {
    e.preventDefault();
    if (!tagForm.name.trim()) return;
    setError(null);
    try {
      await tagsApi.create({
        name: tagForm.name.trim(),
        color: tagForm.color,
      });
      setTagForm({ name: "", color: TAG_COLORS[0] });
      push({ title: "Utworzono tag", message: `Dodano tag „${tagForm.name}”`, tone: "canary" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tworzenia tagu");
    }
  }

  async function removeTag(tag: CustomerTag) {
    if (!confirm(`Usunąć tag „${tag.name}”? Zostanie odpięty od klientów.`)) {
      return;
    }
    setError(null);
    try {
      await tagsApi.remove(tag.id);
      if (filterTagId === tag.id) setFilterTagId("");
      push({ title: "Usunięto tag", message: "Tag został usunięty", tone: "canary" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania tagu");
    }
  }

  async function toggleCustomerTag(customer: Customer, tag: CustomerTag) {
    setError(null);
    const current = new Set((customer.tags || []).map((t) => t.id));
    if (current.has(tag.id)) current.delete(tag.id);
    else current.add(tag.id);
    try {
      const next = await customersApi.setTags(customer.id, [...current]);
      setCustomers((list) =>
        list.map((c) => (c.id === customer.id ? { ...c, tags: next } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd aktualizacji tagów");
    }
  }

  async function savePsid(customer: Customer) {
    setError(null);
    try {
      await customersApi.update(customer.id, {
        messenger_psid: editPsid.trim(),
      });
      setEditId(null);
      push({ title: "Zapisano PSID", message: "Zaktualizowano identyfikator Messenger", tone: "canary" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu PSID");
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!messageFor || !messageText.trim()) return;
    setError(null);
    try {
      const res = await inboxApi.start({
        customer_id: messageFor.id,
        text: messageText.trim(),
        channel,
      });
      setMessageText("");
      setMessageFor(null);
      if (res.delivered) {
        push({
          title: "Wysłano wiadomość",
          message: `Dostarczono przez ${channel}.`,
          tone: "canary",
        });
      } else {
        setError(
          res.detail ||
            "Zapisano w Wiadomościach, ale Meta nie dostarczyła (PSID / token).",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd wysyłki");
    }
  }

  async function removeCustomer(customer: Customer) {
    if (!confirm(`Czy na pewno chcesz usunąć klienta ${customer.name || customer.id}?`)) return;
    setError(null);
    try {
      await customersApi.remove(customer.id);
      push({ title: "Usunięto klienta", message: "Klient został usunięty z bazy", tone: "canary" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd usuwania");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (filterTagId && !(c.tags || []).some((t) => t.id === filterTagId)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        c.name,
        c.phone,
        c.email,
        c.external_ids?.messenger,
        ...(c.tags || []).map((t) => t.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [customers, filterTagId, query]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">group</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Klienci
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Baza stałych i nowych klientów · {customers.length} w rejestrze
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <GlassButton
            type="button"
            variant="ghost"
            onClick={() => setToolsOpen((v) => !v)}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            {toolsOpen ? "Ukryj narzędzia" : "Narzędzia i Tagi"}
          </GlassButton>
          <GlassButton
            type="button"
            variant="primary"
            onClick={() => setAddCustomerOpen((v) => !v)}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            {addCustomerOpen ? "Anuluj" : "Dodaj klienta"}
          </GlassButton>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Add Customer Modal / Panel */}
      {addCustomerOpen && (
        <div className="glass-panel rounded-xl p-6 border-t-2 border-t-[var(--primary)] shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-glass-border pb-3 mb-4">
            <h2 className="font-display text-lg font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)]">person_add</span>
              Nowy klient
            </h2>
            <button
              type="button"
              onClick={() => setAddCustomerOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--text-bright)]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
              <span>Imię i nazwisko / Nazwa firmy *</span>
              <GlassInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="np. Anna Kowalska"
                required
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Telefon</span>
              <GlassInput
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+48 123 456 789"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>E-mail</span>
              <GlassInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="anna@example.com"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
              <span>Messenger PSID (opcjonalnie)</span>
              <GlassInput
                value={form.messenger_psid}
                onChange={(e) =>
                  setForm({ ...form, messenger_psid: e.target.value })
                }
                placeholder="Identyfikator ze strony Meta"
              />
            </label>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">check</span>
                Zapisz klienta
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setAddCustomerOpen(false)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* Tools / Tag Management Panel */}
      {toolsOpen && (
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-up">
          {/* Tags manager */}
          <div className="glass-panel rounded-xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[var(--accent)] text-[20px]">
                  label
                </span>
                Tagi i Segmenty
              </h3>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={onCreateTag}
              >
                <label className="min-w-[140px] flex-1 space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Nazwa tagu</span>
                  <GlassInput
                    value={tagForm.name}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, name: e.target.value })
                    }
                    placeholder="np. VIP, Regular, Student"
                    required
                  />
                </label>
                <div className="space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Kolor</span>
                  <div className="flex gap-1.5">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTagForm({ ...tagForm, color: c })}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          tagForm.color === c
                            ? "scale-110 border-white"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <GlassButton type="submit" variant="primary" className="!py-2">
                  Dodaj
                </GlassButton>
              </form>
            </div>

            {tags.length > 0 && (
              <div className="mt-4 pt-3 border-t border-glass-border flex flex-wrap gap-2">
                {tags.map((t) => (
                  <div
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: t.color || "#3e63dd" }}
                  >
                    <span>{t.name}</span>
                    <button
                      type="button"
                      className="opacity-70 hover:opacity-100 ml-1"
                      onClick={() => void removeTag(t)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CSV Importer */}
          <div className="glass-panel rounded-xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-[var(--tertiary)] text-[20px]">
                  upload_file
                </span>
                Import bazy z pliku CSV
              </h3>
              <p className="text-xs text-[var(--muted)] mb-3">
                Wymagane kolumny nagłówkowe: <code>name, phone, email, messenger_psid</code>.
              </p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-container)] file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:opacity-90 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void customersApi
                  .importCsv(file)
                  .then(async (r) => {
                    push({
                      title: "Import zakończony",
                      message: `+${r.created} nowych, ${r.updated} zaktualizowanych, ${r.skipped} pominiętych`,
                      tone: "canary",
                    });
                    await reload();
                  })
                  .catch((err: Error) => setError(err.message));
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Message Modal */}
      {messageFor && (
        <div className="glass-panel rounded-xl p-6 border-t-2 border-t-[var(--accent)] shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-glass-border pb-3 mb-4">
            <h3 className="font-display text-base font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--accent)]">chat</span>
              Wiadomość do: {messageFor.name || "Klient"}
            </h3>
            <button
              type="button"
              onClick={() => setMessageFor(null)}
              className="text-[var(--muted)] hover:text-[var(--text-bright)]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form className="space-y-4" onSubmit={sendMessage}>
            <label className="block space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Kanał wysyłki</span>
              <GlassSelect
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                <option value="messenger">Facebook Messenger</option>
                <option value="instagram">Instagram Direct</option>
                <option value="telegram">Telegram</option>
              </GlassSelect>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Treść wiadomości</span>
              <GlassTextarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Cześć! Piszę w sprawie zbliżającej się wizyty..."
                rows={3}
                required
              />
            </label>
            <div className="flex gap-3">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">send</span>
                Wyślij
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setMessageFor(null)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po nazwisku, telefonie, emailu..."
            className="w-full bg-[var(--surface-container)] border border-glass-border rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterTagId}
            onChange={(e) => setFilterTagId(e.target.value)}
            className="bg-[var(--surface-container)] border border-glass-border rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
          >
            <option value="">Wszystkie tagi ({tags.length})</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--muted)] font-mono shrink-0">
            {visible.length} / {customers.length}
          </span>
        </div>
      </div>

      {/* Customers Table */}
      <section className="glass-panel rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[var(--muted)] font-semibold text-xs uppercase tracking-wider bg-white/[0.02]">
                <th className="py-3.5 px-6">Klient</th>
                <th className="py-3.5 px-6">Kontakt</th>
                <th className="py-3.5 px-6">Tagi</th>
                <th className="py-3.5 px-6">Kanały</th>
                <th className="py-3.5 px-6 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-[var(--muted)]">
                    <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                      group_off
                    </span>
                    Brak klientów spełniających wybrane kryteria.
                  </td>
                </tr>
              ) : (
                visible.map((c) => {
                  const psid = c.external_ids?.messenger || "";
                  const assigned = new Set((c.tags || []).map((t) => t.id));
                  const channels = channelBadges(c);
                  const open = expandedId === c.id;

                  return (
                    <Fragment key={c.id}>
                      <tr className="hover:bg-white/[0.03] transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[var(--surface-solid)] border border-glass-border flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                              {initials(c.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-[var(--text-bright)]">
                                {c.name || "Bez nazwy"}
                              </p>
                              <p className="font-mono text-[11px] text-[var(--muted)]">
                                PSID: {psid ? `${psid.slice(0, 10)}…` : "brak"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-[var(--text)]">
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} className="hover:underline text-[var(--accent)]">
                                {c.phone}
                              </a>
                            ) : (
                              <span className="text-[var(--muted)]">—</span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{c.email || ""}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5">
                            {(c.tags || []).length === 0 ? (
                              <span className="text-xs text-[var(--muted)] opacity-50">—</span>
                            ) : (
                              (c.tags || []).map((t) => (
                                <span
                                  key={t.id}
                                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
                                  style={{ backgroundColor: t.color || "var(--accent)" }}
                                >
                                  {t.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5">
                            {channels.length === 0 ? (
                              <span className="text-xs text-[var(--muted)] opacity-50">—</span>
                            ) : (
                              channels.map((ch) => (
                                <span
                                  key={ch.name}
                                  className={`rounded-md ${ch.color} text-white px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1 shadow-sm`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    {ch.icon}
                                  </span>
                                  {ch.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setMessageFor(c);
                                setChannel("messenger");
                                setMessageText("");
                              }}
                              disabled={
                                !psid &&
                                !c.external_ids?.instagram &&
                                !c.external_ids?.telegram
                              }
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-white/5 rounded-lg transition-colors disabled:opacity-30"
                              title="Wyślij wiadomość"
                            >
                              <span className="material-symbols-outlined text-[18px]">chat</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(open ? null : c.id)}
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5 rounded-lg transition-colors"
                              title="Więcej opcji"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {open ? "expand_less" : "expand_more"}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Drawer Details */}
                      {open && (
                        <tr className="bg-white/[0.01]">
                          <td colSpan={5} className="py-4 px-6 border-b border-glass-border">
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                <GlassButton
                                  type="button"
                                  variant="ghost"
                                  className="!px-3 !py-1.5 text-xs"
                                  onClick={() =>
                                    setTagEditId(tagEditId === c.id ? null : c.id)
                                  }
                                >
                                  <span className="material-symbols-outlined text-[16px]">label</span>
                                  Zarządzaj tagami
                                </GlassButton>
                                <GlassButton
                                  type="button"
                                  variant="ghost"
                                  className="!px-3 !py-1.5 text-xs"
                                  onClick={() => {
                                    setEditId(c.id);
                                    setEditPsid(psid);
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[16px]">key</span>
                                  Edytuj PSID
                                </GlassButton>
                                <GlassButton
                                  type="button"
                                  variant="danger"
                                  className="!px-3 !py-1.5 text-xs"
                                  onClick={() => void removeCustomer(c)}
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  Usuń klienta
                                </GlassButton>
                              </div>

                              {/* Tag Assignment */}
                              {tagEditId === c.id && (
                                <div className="p-3.5 rounded-lg bg-[var(--surface-container)] border border-glass-border animate-fade-in">
                                  <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
                                    Kliknij tag, aby przypisać lub odpiąć od klienta:
                                  </p>
                                  {tags.length === 0 ? (
                                    <p className="text-xs text-[var(--muted)]">
                                      Brak zdefiniowanych tagów. Utwórz je w sekcji narzędzi u góry.
                                    </p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {tags.map((t) => {
                                        const on = assigned.has(t.id);
                                        return (
                                          <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => void toggleCustomerTag(c, t)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                              on
                                                ? "text-white shadow-md"
                                                : "border border-glass-border text-[var(--muted)] hover:text-[var(--text-bright)]"
                                            }`}
                                            style={
                                              on
                                                ? { backgroundColor: t.color || "var(--accent)" }
                                                : undefined
                                            }
                                          >
                                            <span className="material-symbols-outlined text-[14px]">
                                              {on ? "check" : "add"}
                                            </span>
                                            {t.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* PSID Editor */}
                              {editId === c.id && (
                                <div className="p-3.5 rounded-lg bg-[var(--surface-container)] border border-glass-border flex flex-wrap items-end gap-3 animate-fade-in">
                                  <label className="min-w-[220px] flex-1 space-y-1 text-xs font-semibold text-[var(--muted)]">
                                    <span>Messenger PSID</span>
                                    <GlassInput
                                      value={editPsid}
                                      onChange={(e) => setEditPsid(e.target.value)}
                                      placeholder="Identyfikator PSID"
                                    />
                                  </label>
                                  <GlassButton
                                    type="button"
                                    variant="primary"
                                    onClick={() => void savePsid(c)}
                                  >
                                    Zapisz
                                  </GlassButton>
                                  <GlassButton
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setEditId(null)}
                                  >
                                    Anuluj
                                  </GlassButton>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

