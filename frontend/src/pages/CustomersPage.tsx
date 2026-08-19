import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { customersApi, inboxApi, tagsApi } from "@/api";
import type { Channel, Customer, CustomerTag } from "@/api/types";

const TAG_COLORS = [
  "#0c6b5c",
  "#3a6ea5",
  "#a0673a",
  "#8b4f6a",
  "#4f6b3a",
  "#5b4f8c",
];

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function contactLine(c: Customer) {
  return [c.phone, c.email].filter(Boolean).join(" · ") || "Brak kontaktu";
}

function channelBadges(c: Customer) {
  const ext = c.external_ids || {};
  const out: string[] = [];
  if (ext.messenger) out.push("Messenger");
  if (ext.instagram) out.push("IG");
  if (ext.telegram) out.push("Telegram");
  if (ext.whatsapp) out.push("WhatsApp");
  return out;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
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
  const [filterTagId, setFilterTagId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setMsg(null);
    try {
      await customersApi.create({
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        messenger_psid: form.messenger_psid.trim() || undefined,
      });
      setForm({ name: "", phone: "", email: "", messenger_psid: "" });
      setMsg("Klient dodany");
      setToolsOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function onCreateTag(e: FormEvent) {
    e.preventDefault();
    if (!tagForm.name.trim()) return;
    setError(null);
    setMsg(null);
    try {
      await tagsApi.create({
        name: tagForm.name.trim(),
        color: tagForm.color,
      });
      setTagForm({ name: "", color: TAG_COLORS[0] });
      setMsg("Tag utworzony");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd tagu");
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
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
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
      setError(err instanceof Error ? err.message : "Błąd tagów");
    }
  }

  async function savePsid(customer: Customer) {
    setError(null);
    try {
      await customersApi.update(customer.id, {
        messenger_psid: editPsid.trim(),
      });
      setEditId(null);
      setMsg("Zapisano Messenger PSID");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!messageFor || !messageText.trim()) return;
    setError(null);
    setMsg(null);
    try {
      const res = await inboxApi.start({
        customer_id: messageFor.id,
        text: messageText.trim(),
        channel,
      });
      setMessageText("");
      setMessageFor(null);
      if (res.delivered) {
        setMsg(`Wysłano na ${channel}. Otwórz Wiadomości, by kontynuować.`);
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
    if (!confirm(`Usunąć klienta ${customer.name || customer.id}?`)) return;
    setError(null);
    try {
      await customersApi.remove(customer.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd");
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-in fade-in slide-in-from-top-4">
        <div>
          <p className="font-label-caps text-label-caps text-secondary uppercase tracking-wider mb-1">Baza</p>
          <h1 className="font-display text-display-lg-mobile md:text-display-lg bg-gradient-to-r from-primary via-primary-fixed to-tertiary-container bg-clip-text text-transparent font-semibold">
            Klienci
          </h1>
          <p className="mt-2 max-w-lg text-sm text-on-surface-variant">
            Szukaj, filtruj tagami i pisz na Messenger — bez stosu kart.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            type="button" 
            onClick={() => setToolsOpen((v) => !v)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-container to-tertiary-container text-on-surface rounded-full hover:shadow-glow transition-all font-medium text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">{toolsOpen ? 'close' : 'add'}</span>
            {toolsOpen ? "Ukryj narzędzia" : "Dodaj / import"}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <div className="glass-panel rounded-full flex items-center px-5 py-3 hover:border-white/20 transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant mr-3">search</span>
          <input 
            type="text"
            className="bg-transparent border-none outline-none text-on-surface flex-1 placeholder-on-surface-variant text-sm font-sans"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po imieniu, telefonie, e-mailu, tagu…"
            aria-label="Szukaj klientów"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            className={`glass-panel rounded-full px-4 py-1.5 whitespace-nowrap text-sm font-medium transition-all flex items-center gap-2 ${!filterTagId ? 'bg-primary-container text-on-surface border-primary' : 'text-on-surface-variant hover:text-on-surface hover:border-white/20'}`}
            onClick={() => setFilterTagId("")}
          >
            Wszystkie
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              className={`glass-panel rounded-full px-4 py-1.5 whitespace-nowrap text-sm font-medium transition-all flex items-center gap-2 ${filterTagId === t.id ? 'bg-primary-container text-on-surface border-primary' : 'text-on-surface-variant hover:text-on-surface hover:border-white/20'}`}
              onClick={() => setFilterTagId(t.id)}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#fff' }}></span>
              {t.name}
            </button>
          ))}
          <p className="shrink-0 text-sm text-on-surface-variant ml-auto pl-4 border-l border-white/10">
            {visible.length} / {customers.length}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-error flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          {error}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary flex items-center gap-2">
           <span className="material-symbols-outlined text-[20px]">check_circle</span>
          {msg}
        </p>
      )}

      {toolsOpen && (
        <div className="grid gap-4 lg:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="glass-panel rounded-[28px] p-6 flex flex-col gap-4">
            <h2 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person_add</span>
              Nowy klient
            </h2>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
              <label className="space-y-1.5 text-sm sm:col-span-2">
                <span className="text-on-surface-variant">Imię / nazwa</span>
                <input
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Anna Kowalska"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-on-surface-variant">Telefon</span>
                <input
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-on-surface-variant">E-mail</span>
                <input
                  type="email"
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="space-y-1.5 text-sm sm:col-span-2">
                <span className="text-on-surface-variant">Messenger PSID</span>
                <input
                  className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                  value={form.messenger_psid}
                  onChange={(e) =>
                    setForm({ ...form, messenger_psid: e.target.value })
                  }
                  placeholder="Opcjonalnie — z Meta / webhooka"
                />
              </label>
              <div className="sm:col-span-2 mt-2">
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary/20 text-primary border border-primary/20 rounded-lg hover:bg-primary/30 transition-colors font-medium text-sm"
                >
                  Zapisz klienta
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="glass-panel rounded-[28px] p-6 flex flex-col gap-4">
              <h2 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary">sell</span>
                Tagi
              </h2>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={onCreateTag}
              >
                <label className="min-w-[140px] flex-1 space-y-1.5 text-sm">
                  <span className="text-on-surface-variant">Nazwa</span>
                  <input
                    className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
                    value={tagForm.name}
                    onChange={(e) =>
                      setTagForm({ ...tagForm, name: e.target.value })
                    }
                    placeholder="VIP"
                    required
                  />
                </label>
                <div className="space-y-1.5 text-sm pb-1">
                  <span className="text-on-surface-variant block mb-1">Kolor</span>
                  <div className="flex gap-1.5">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Kolor ${c}`}
                        onClick={() => setTagForm({ ...tagForm, color: c })}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${
                          tagForm.color === c
                            ? "scale-110 border-white"
                            : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="pb-0.5">
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-tertiary/20 text-tertiary border border-tertiary/20 rounded-lg hover:bg-tertiary/30 transition-colors font-medium text-sm"
                  >
                    Dodaj
                  </button>
                </div>
              </form>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {tags.map((t) => (
                    <div
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: `${t.color || "#555"}22`,
                        borderColor: `${t.color || "#888"}44`,
                        color: t.color || '#e5e1e4'
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.color || "#888" }}
                      />
                      {t.name}
                      <button
                        type="button"
                        className="ml-1 opacity-70 hover:opacity-100 hover:text-danger transition-colors flex items-center justify-center"
                        onClick={() => void removeTag(t)}
                        aria-label={`Usuń tag ${t.name}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-[28px] p-6 flex flex-col gap-4">
              <h2 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">upload_file</span>
                Import CSV
              </h2>
              <p className="text-sm text-on-surface-variant">
                Kolumny: <span className="font-data-mono text-xs text-on-surface">name, phone, email, messenger_psid, whatsapp</span>
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-on-surface-variant file:mr-4 file:rounded-lg file:border-0 file:bg-surface-container file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-on-surface hover:file:bg-white/10 file:transition-colors file:cursor-pointer cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void customersApi
                    .importCsv(file)
                    .then(async (r) => {
                      setMsg(
                        `Import: +${r.created} nowych, ${r.updated} zaktualizowanych, ${r.skipped} pominiętych`,
                      );
                      await reload();
                    })
                    .catch((err: Error) => setError(err.message));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {messageFor && (
        <div className="glass-panel rounded-[28px] p-6 animate-in fade-in slide-in-from-top-4">
          <h2 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">send</span>
            Wiadomość do {messageFor.name || "klienta"}
          </h2>
          <form className="mt-4 space-y-4" onSubmit={sendMessage}>
            <label className="block space-y-1.5 text-sm">
              <span className="text-on-surface-variant">Kanał</span>
              <select
                className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                <option value="messenger">Messenger</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
              </select>
            </label>
            <textarea
              className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-3 py-2 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors min-h-[100px] resize-y"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Cześć! Przypominamy o wizycie…"
              required
            />
            <div className="flex flex-wrap gap-3 pt-2">
              <button 
                type="submit"
                className="px-5 py-2.5 bg-primary/20 text-primary border border-primary/20 rounded-full hover:bg-primary/30 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Wyślij
              </button>
              <button
                type="button"
                className="px-5 py-2.5 glass-panel rounded-full hover:bg-surface-container transition-colors font-medium text-sm text-on-surface-variant"
                onClick={() => setMessageFor(null)}
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => {
          const psid = c.external_ids?.messenger || "";
          const assigned = new Set((c.tags || []).map((t) => t.id));
          const channels = channelBadges(c);
          const open = expandedId === c.id;
          
          return (
            <div key={c.id} className="glass-panel rounded-[28px] p-5 hover:border-white/20 hover:shadow-glow transition-all flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full border border-white/10 flex items-center justify-center bg-surface-container font-medium text-on-surface text-lg">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-sans font-medium text-on-surface text-body-md truncate">{c.name || 'Bez nazwy'}</h3>
                    <p className="text-sm text-on-surface-variant truncate">{contactLine(c)}</p>
                  </div>
                </div>
                {psid && (
                  <div className="font-data-mono text-[10px] text-on-surface-variant/70 flex flex-col items-end shrink-0" title={`PSID: ${psid}`}>
                    <span className="material-symbols-outlined text-[16px] text-tertiary mb-0.5">chat</span>
                    {psid.slice(0, 6)}…
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-auto">
                {(c.tags || []).length === 0 && channels.length === 0 && (
                   <span className="text-xs text-on-surface-variant/50 italic">Brak tagów</span>
                )}
                {(c.tags || []).map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium flex items-center gap-1 border border-white/5"
                    style={{
                      backgroundColor: `${t.color || "#888"}22`,
                      color: t.color || '#e5e1e4'
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color || "#888" }} />
                    {t.name}
                  </span>
                ))}
                {channels.map((ch) => (
                  <span
                    key={ch}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-primary-container/20 text-primary-container border border-primary-container/20"
                  >
                    {ch}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  title="Napisz wiadomość"
                  disabled={!psid && !c.external_ids?.instagram && !c.external_ids?.telegram}
                  onClick={() => {
                    setMessageFor(c);
                    setChannel("messenger");
                    setMessageText("");
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center glass-panel hover:bg-primary/20 hover:text-primary transition-colors text-on-surface-variant disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </button>
                <a
                  href={`tel:${c.phone || ''}`}
                  title="Zadzwoń"
                  className={`w-9 h-9 rounded-full flex items-center justify-center glass-panel transition-colors ${!c.phone ? 'opacity-50 cursor-not-allowed text-on-surface-variant' : 'hover:bg-secondary/20 hover:text-secondary text-on-surface-variant'}`}
                  onClick={(e) => !c.phone && e.preventDefault()}
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                </a>
                <button
                  type="button"
                  title="Więcej akcji"
                  onClick={() => setExpandedId(open ? null : c.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center glass-panel transition-colors ml-auto ${open ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{open ? 'expand_less' : 'more_horiz'}</span>
                </button>
              </div>

              {open && (
                <div className="pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                  <CustomerExtras
                    customer={c}
                    tags={tags}
                    assigned={assigned}
                    tagEditId={tagEditId}
                    setTagEditId={setTagEditId}
                    editId={editId}
                    setEditId={setEditId}
                    editPsid={editPsid}
                    setEditPsid={setEditPsid}
                    onToggleTag={toggleCustomerTag}
                    onSavePsid={savePsid}
                    onRemove={removeCustomer}
                    onMessage={() => {
                      setMessageFor(c);
                      setChannel("messenger");
                      setMessageText("");
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {visible.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 glass-panel rounded-[28px] mt-4 border-dashed border-white/20">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/50">search_off</span>
          <p className="text-on-surface-variant">Brak klientów pasujących do filtra.</p>
        </div>
      )}
    </div>
  );
}

function CustomerExtras({
  customer,
  tags,
  assigned,
  tagEditId,
  setTagEditId,
  editId,
  setEditId,
  editPsid,
  setEditPsid,
  onToggleTag,
  onSavePsid,
  onRemove,
}: {
  customer: Customer;
  tags: CustomerTag[];
  assigned: Set<string>;
  tagEditId: string | null;
  setTagEditId: (id: string | null) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  editPsid: string;
  setEditPsid: (v: string) => void;
  onToggleTag: (c: Customer, t: CustomerTag) => void;
  onSavePsid: (c: Customer) => void;
  onRemove: (c: Customer) => void;
  onMessage: () => void;
}) {
  const psid = customer.external_ids?.messenger || "";
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTagEditId(tagEditId === customer.id ? null : customer.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${tagEditId === customer.id ? 'bg-surface-container border-white/20 text-on-surface' : 'border-white/10 text-on-surface-variant hover:border-white/20 hover:text-on-surface'}`}
        >
          Edytuj tagi
        </button>
        <button
          type="button"
          onClick={() => {
            setEditId(customer.id);
            setEditPsid(psid);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${editId === customer.id ? 'bg-surface-container border-white/20 text-on-surface' : 'border-white/10 text-on-surface-variant hover:border-white/20 hover:text-on-surface'}`}
        >
          Edytuj PSID
        </button>
        <button
          type="button"
          onClick={() => void onRemove(customer)}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-danger/20 text-error hover:bg-danger/10"
        >
          Usuń klienta
        </button>
      </div>

      {tagEditId === customer.id && (
        <div className="bg-surface-container/30 rounded-xl p-3 border border-white/5">
          <p className="mb-2.5 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
            Zarządzaj tagami
          </p>
          {tags.length === 0 ? (
            <p className="text-xs text-on-surface-variant italic">
              Brak dostępnych tagów. Utwórz je w panelu u góry.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const on = assigned.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void onToggleTag(customer, t)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1.5 border ${
                      on
                        ? "border-transparent"
                        : "border-white/10 text-on-surface-variant hover:border-white/20 hover:text-on-surface"
                    }`}
                    style={
                      on
                        ? {
                            backgroundColor: `${t.color || "#888"}22`,
                            color: t.color || '#fff',
                            borderColor: `${t.color || "#888"}44`
                          }
                        : undefined
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color || "#888" }} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {editId === customer.id && (
        <div className="bg-surface-container/30 rounded-xl p-3 border border-white/5 flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 space-y-1 text-xs">
            <span className="text-on-surface-variant uppercase tracking-wider font-medium">Messenger PSID</span>
            <input
              className="w-full bg-surface-container/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
              value={editPsid}
              onChange={(e) => setEditPsid(e.target.value)}
              placeholder="Wprowadź ID"
            />
          </label>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => void onSavePsid(customer)}
              className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/20 rounded-lg hover:bg-primary/30 transition-colors font-medium text-xs"
            >
              Zapisz
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="px-3 py-1.5 glass-panel rounded-lg hover:bg-surface-container transition-colors font-medium text-xs text-on-surface-variant"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

