import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { appointmentsApi, customersApi } from "@/api";
import type { Appointment, Customer } from "@/api/types";
import { GlassButton, GlassCard, PageHeader } from "@/components/ui";
import { GlassInput } from "@/components/ui/GlassInput";

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  const [items, setItems] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [editing, setEditing] = useState<Customer | null>(null);

  async function reload() {
    const [c, a] = await Promise.all([customersApi.list(), appointmentsApi.list()]);
    setItems(c);
    setAppointments(a);
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  const filtered = items.filter((c) => {
    const blob = `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  const selected = items.find((c) => c.id === selectedId) || null;
  const history = selected
    ? appointments
        .filter((a) => a.customer_id === selected.id)
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    : [];

  async function save() {
    setError(null);
    try {
      if (editing) {
        await customersApi.update(editing.id, {
          name: form.name || null,
          phone: form.phone || null,
          email: form.email || null,
        });
      } else {
        if (!form.name.trim()) {
          setError("Podaj imię klienta");
          return;
        }
        await customersApi.create({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
        });
      }
      setEditing(null);
      setForm({ name: "", phone: "", email: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd zapisu");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon="group"
        title="Klienci"
        subtitle="Kontakty, historia wizyt, szybkie umówienie"
      >
        <GlassInput
          placeholder="Szukaj po imieniu, telefonie, mailu"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </PageHeader>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setParams({ id: c.id })}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                selectedId === c.id
                  ? "border-[var(--text)] bg-[var(--surface)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--muted)]"
              }`}
            >
              <p className="text-sm font-medium">{c.name || "Bez imienia"}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {[c.phone, c.email].filter(Boolean).join(" · ") || "Brak kontaktu"}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <GlassCard>
              <p className="text-sm text-[var(--muted)]">Brak klientów na liście.</p>
            </GlassCard>
          )}
        </div>

        <aside className="space-y-4">
          <GlassCard>
            <p className="text-sm font-medium">{editing ? "Edycja" : "Nowy klient"}</p>
            <div className="mt-3 space-y-2">
              <GlassInput
                placeholder="Imię i nazwisko"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <GlassInput
                placeholder="Telefon"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <GlassInput
                placeholder="E-mail"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="flex gap-2">
                <GlassButton onClick={() => void save()}>Zapisz</GlassButton>
                {editing ? (
                  <GlassButton
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setForm({ name: "", phone: "", email: "" });
                    }}
                  >
                    Anuluj
                  </GlassButton>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {selected ? (
            <GlassCard>
              <p className="text-sm font-medium">{selected.name || "Klient"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {[selected.phone, selected.email].filter(Boolean).join(" · ") || "Brak kontaktu"}
              </p>
              <div className="mt-3 flex gap-2">
                <GlassButton
                  variant="subtle"
                  className="!py-1.5 !text-xs"
                  onClick={() => {
                    setEditing(selected);
                    setForm({
                      name: selected.name || "",
                      phone: selected.phone || "",
                      email: selected.email || "",
                    });
                  }}
                >
                  Edytuj
                </GlassButton>
                <Link to={`/appointments?new=1&customer=${selected.id}`}>
                  <GlassButton className="!py-1.5 !text-xs">Umów wizytę</GlassButton>
                </Link>
              </div>
              <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                Historia
              </p>
              <ul className="mt-2 space-y-2 text-xs">
                {history.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 text-[var(--muted)]">
                    <span className="truncate">{a.service_name}</span>
                    <span className="shrink-0">
                      {new Date(a.start_at).toLocaleDateString("pl-PL")}
                    </span>
                  </li>
                ))}
                {history.length === 0 && <li className="text-[var(--muted)]">Brak wizyt</li>}
              </ul>
            </GlassCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
