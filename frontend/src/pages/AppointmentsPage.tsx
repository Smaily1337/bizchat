import { type FormEvent, useEffect, useState } from "react";
import {
  appointmentsApi,
  customersApi,
  notificationsApi,
  servicesApi,
} from "@/api";
import type { Appointment, Customer, Service } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton, GlassCard } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  confirmed: "Potwierdzona",
  cancelled: "Anulowana",
  completed: "Zakończona",
  no_show: "Nieobecność",
};

const FALLBACK_REMINDER =
  "Cześć {{klient}}! Przypominamy o wizycie ({{usluga}}) w {{firma}} dnia {{data}} o {{godzina}}. Do zobaczenia!";

export function AppointmentsPage() {
  const { push } = useToast();
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [items, setItems] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    start_at: "",
    status: "confirmed",
    notes: "",
    new_customer_name: "",
  });

  async function reload() {
    const [a, s, c] = await Promise.all([
      appointmentsApi.list(),
      servicesApi.list(),
      customersApi.list(),
    ]);
    setItems(a);
    setServices(s);
    setCustomers(c);
    if (!form.service_id && s[0]) {
      setForm((f) => ({ ...f, service_id: s[0].id, customer_id: c[0]?.id || "" }));
    }
  }

  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, []);

  function openCreate() {
    setEditing(null);
    setClientMode(customers.length > 0 ? "existing" : "new");
    const local = new Date();
    local.setMinutes(0, 0, 0);
    local.setHours(local.getHours() + 1);
    setForm({
      customer_id: customers[0]?.id || "",
      service_id: services[0]?.id || "",
      start_at: local.toISOString().slice(0, 16),
      status: "confirmed",
      notes: "",
      new_customer_name: "",
    });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditing(a);
    setClientMode("existing");
    setForm({
      customer_id: a.customer_id,
      service_id: a.service_id,
      start_at: new Date(a.start_at).toISOString().slice(0, 16),
      status: a.status,
      notes: a.notes || "",
      new_customer_name: "",
    });
    setShowForm(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let customerId = form.customer_id;
      if (!editing) {
        if (clientMode === "new") {
          const name = form.new_customer_name.trim();
          if (!name) {
            setError("Podaj imię i nazwisko nowego klienta");
            return;
          }
          const c = await customersApi.create({ name });
          customerId = c.id;
        } else if (!customerId) {
          setError("Wybierz klienta z listy");
          return;
        }
      }
      const start = new Date(form.start_at).toISOString();
      if (editing) {
        await appointmentsApi.update(editing.id, {
          start_at: start,
          status: form.status,
          notes: form.notes || null,
          service_id: form.service_id,
        });
      } else {
        await appointmentsApi.create({
          customer_id: customerId,
          service_id: form.service_id,
          start_at: start,
          status: form.status,
          notes: form.notes || null,
        });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    }
  }

  async function cancelAppt(id: string) {
    if (!confirm("Anulować wizytę?")) return;
    await appointmentsApi.cancel(id, "Anulowano w panelu");
    await reload();
  }

  async function notifyCustomer(a: Appointment) {
    setNotifyingId(a.id);
    try {
      const templates = await notificationsApi.templates();
      const reminder =
        templates.find((t) => t.kind === "reminder" && t.is_default) ||
        templates.find((t) => t.kind === "reminder");
      await notificationsApi.send({
        appointment_id: a.id,
        template_id: reminder?.id,
        body: reminder ? undefined : FALLBACK_REMINDER,
      });
      push({
        title: "Przypomnienie wysłane",
        message: `Do: ${a.customer_name || "klient"} — szczegóły w zakładce Powiadomienia.`,
        tone: "canary",
      });
    } catch (err) {
      push({
        title: "Nie udało się wysłać",
        message: err instanceof Error ? err.message : "Błąd wysyłki",
        tone: "danger",
      });
    } finally {
      setNotifyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Wizyty</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Lista, dodawanie, edycja i anulowanie wizyt
          </p>
        </div>
        <GlassButton onClick={openCreate}>+ Nowa wizyta</GlassButton>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {showForm && (
        <GlassCard className="animate-fade-up">
          <p className="font-display text-lg font-semibold">
            {editing ? "Edytuj wizytę" : "Nowa wizyta"}
          </p>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
            {!editing && (
              <div className="space-y-3 sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <GlassButton
                    type="button"
                    variant={clientMode === "existing" ? "primary" : "ghost"}
                    className="!py-1.5"
                    onClick={() => {
                      setClientMode("existing");
                      setForm((f) => ({ ...f, new_customer_name: "" }));
                    }}
                    disabled={customers.length === 0}
                  >
                    Istniejący klient
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant={clientMode === "new" ? "primary" : "ghost"}
                    className="!py-1.5"
                    onClick={() => {
                      setClientMode("new");
                      setForm((f) => ({ ...f, customer_id: "" }));
                    }}
                  >
                    Nowy klient
                  </GlassButton>
                </div>
                {clientMode === "existing" ? (
                  <label className="block space-y-1 text-sm">
                    <span className="text-[var(--muted)]">Wybierz z listy</span>
                    <GlassSelect
                      value={form.customer_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, customer_id: e.target.value }))
                      }
                      required
                    >
                      <option value="">— wybierz klienta —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.id.slice(0, 8)}
                        </option>
                      ))}
                    </GlassSelect>
                  </label>
                ) : (
                  <label className="block space-y-1 text-sm">
                    <span className="text-[var(--muted)]">Imię i nazwisko</span>
                    <GlassInput
                      value={form.new_customer_name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          new_customer_name: e.target.value,
                        }))
                      }
                      placeholder="np. Anna Kowalska"
                      required
                    />
                  </label>
                )}
              </div>
            )}
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Usługa</span>
              <GlassSelect
                value={form.service_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_id: e.target.value }))
                }
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_min} min)
                  </option>
                ))}
              </GlassSelect>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Start</span>
              <GlassInput
                type="datetime-local"
                value={form.start_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_at: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[var(--muted)]">Status</span>
              <GlassSelect
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </GlassSelect>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-[var(--muted)]">Notatki</span>
              <GlassTextarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <GlassButton type="submit">Zapisz</GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <GlassCard>
            <p className="text-sm text-[var(--muted)]">Brak wizyt.</p>
          </GlassCard>
        )}
        {items.map((a) => (
          <GlassCard
            key={a.id}
            className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-display text-base font-semibold">
                {a.service_name || "Usługa"}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {a.customer_name || "Klient"} ·{" "}
                {new Date(a.start_at).toLocaleString("pl-PL")} –{" "}
                {new Date(a.end_at).toLocaleTimeString("pl-PL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-1 text-xs text-canary/90">
                {STATUS_LABEL[a.status] || a.status} · {a.channel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <GlassButton
                variant="subtle"
                className="!py-1.5"
                onClick={() => void notifyCustomer(a)}
                disabled={a.status === "cancelled" || notifyingId === a.id}
              >
                {notifyingId === a.id ? "Wysyłanie…" : "Powiadom"}
              </GlassButton>
              <GlassButton
                variant="subtle"
                className="!py-1.5"
                onClick={() => openEdit(a)}
                disabled={a.status === "cancelled"}
              >
                Edytuj
              </GlassButton>
              <GlassButton
                variant="ghost"
                className="!py-1.5"
                onClick={() => void cancelAppt(a.id)}
                disabled={a.status === "cancelled"}
              >
                Anuluj
              </GlassButton>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
