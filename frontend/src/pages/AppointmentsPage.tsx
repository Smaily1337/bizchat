import { type FormEvent, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  appointmentsApi,
  customersApi,
  notificationsApi,
  servicesApi,
  staffApi,
} from "@/api";
import type { Appointment, Customer, Service, StaffMember } from "@/api/types";
import { useToast } from "@/components/ToastProvider";
import { GlassButton, GlassTableSkeleton } from "@/components/ui";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/GlassInput";

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekująca",
  confirmed: "Potwierdzona",
  cancelled: "Anulowana",
  completed: "Zakończona",
  no_show: "Nieobecność",
};

const FALLBACK_REMINDER =
  "Cześć {{klient}}! Przypominamy o wizycie ({{usluga}}) w {{firma}} dnia {{data}} o {{godzina}}. Do zobaczenia!";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 font-medium text-xs border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Potwierdzona
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 font-medium text-xs border border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Oczekująca
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 font-medium text-xs border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Anulowana
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium text-xs border border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Zakończona
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-[var(--muted)] font-medium text-xs border border-white/10">
          {STATUS_LABEL[status] || status}
        </span>
      );
  }
}

function getInitials(name?: string | null) {
  if (!name) return "KL";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const { push } = useToast();
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [form, setForm] = useState({
    customer_id: "",
    service_id: "",
    staff_id: "",
    start_at: "",
    status: "confirmed",
    notes: "",
    new_customer_name: "",
    new_customer_phone: "",
    new_customer_email: "",
  });

  async function reload() {
    const [a, s, c, st] = await Promise.all([
      appointmentsApi.list(),
      servicesApi.list(),
      customersApi.list(),
      staffApi.list().catch(() => [] as StaffMember[]),
    ]);
    setItems(a);
    setServices(s);
    setCustomers(c);
    setStaff(st.filter((x) => x.is_active));
    if (!form.service_id && s[0]) {
      setForm((f) => ({ ...f, service_id: s[0].id, customer_id: c[0]?.id || "" }));
    }
  }

  useEffect(() => {
    void reload()
      .then(() => {
        const editId = searchParams.get("edit");
        if (editId) {
          setItems((prev) => {
            const found = prev.find((a) => a.id === editId);
            if (found) openEdit(found);
            return prev;
          });
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((a) => {
      const matchesStatus =
        statusFilter === "all" ? true : a.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (a.customer_name && a.customer_name.toLowerCase().includes(q)) ||
        (a.service_name && a.service_name.toLowerCase().includes(q)) ||
        (a.staff_name && a.staff_name.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, searchQuery]);

  function openCreate() {
    setEditing(null);
    setClientMode(customers.length > 0 ? "existing" : "new");
    const local = new Date();
    local.setMinutes(0, 0, 0);
    local.setHours(local.getHours() + 1);
    setForm({
      customer_id: customers[0]?.id || "",
      service_id: services[0]?.id || "",
      staff_id: "",
      start_at: local.toISOString().slice(0, 16),
      status: "confirmed",
      notes: "",
      new_customer_name: "",
      new_customer_phone: "",
      new_customer_email: "",
    });
    setShowForm(true);
  }

  function openEdit(a: Appointment) {
    setEditing(a);
    setClientMode("existing");
    setForm({
      customer_id: a.customer_id,
      service_id: a.service_id,
      staff_id: a.staff_id || "",
      start_at: new Date(a.start_at).toISOString().slice(0, 16),
      status: a.status,
      notes: a.notes || "",
      new_customer_name: "",
      new_customer_phone: "",
      new_customer_email: "",
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
          const c = await customersApi.create({
            name,
            phone: form.new_customer_phone.trim() || undefined,
            email: form.new_customer_email.trim() || undefined,
          });
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
          staff_id: form.staff_id || null,
        });
        push({ title: "Zapisano zmiany", message: "Wizyta została zaktualizowana", tone: "canary" });
      } else {
        await appointmentsApi.create({
          customer_id: customerId,
          service_id: form.service_id,
          start_at: start,
          status: form.status,
          notes: form.notes || null,
          staff_id: form.staff_id || null,
        });
        push({ title: "Dodano wizytę", message: "Nowa wizyta została utworzona", tone: "canary" });
      }
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd zapisu");
    }
  }

  async function cancelAppt(id: string) {
    if (!confirm("Czy na pewno chcesz anulować tę wizytę?")) return;
    try {
      await appointmentsApi.cancel(id, "Anulowano w panelu");
      push({ title: "Wizyta anulowana", message: "Status zmieniony na anulowana", tone: "canary" });
      await reload();
    } catch (err) {
      push({ title: "Błąd anulowania", message: err instanceof Error ? err.message : "Błąd", tone: "danger" });
    }
  }

  async function notifyCustomer(a: Appointment) {
    setNotifyingId(a.id);
    try {
      const templates = await notificationsApi.templates();
      const reminder =
        templates.find((t) => t.kind === "reminder" && t.is_default) ||
        templates.find((t) => t.kind === "reminder");
      const log = await notificationsApi.send({
        appointment_id: a.id,
        template_id: reminder?.id,
        body: reminder ? undefined : FALLBACK_REMINDER,
      });
      const via = log.channel || a.channel || "kanał rezerwacji";
      if (log.status === "failed") {
        push({
          title: "Wysyłka nieudana",
          message: log.error || `Kanał: ${via}`,
          tone: "danger",
        });
      } else {
        push({
          title: "Przypomnienie wysłane",
          message: `Do: ${a.customer_name || "klient"} przez ${via}`,
          tone: "canary",
        });
      }
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
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-glass-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-container)] to-[var(--secondary-container)] flex items-center justify-center text-white shadow-lg shrink-0">
            <span className="material-symbols-outlined text-[24px]">event_note</span>
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-bright)]">
              Wizyty
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Zarządzaj rezerwacjami, personelem i powiadomieniami
            </p>
          </div>
        </div>

        <GlassButton variant="primary" onClick={openCreate}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nowa wizyta
        </GlassButton>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar: Search and Filter Chips */}
      <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj klienta, usługi, notatek..."
            className="w-full bg-[var(--surface-container)] border border-glass-border rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-bright)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "Wszystkie" },
            { id: "pending", label: "Oczekujące" },
            { id: "confirmed", label: "Potwierdzone" },
            { id: "completed", label: "Zakończone" },
            { id: "cancelled", label: "Anulowane" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? "bg-[var(--primary-container)] text-white shadow"
                  : "text-[var(--muted)] hover:text-[var(--text-bright)] hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal / Panel */}
      {showForm && (
        <div className="glass-panel rounded-xl p-6 border-t-2 border-t-[var(--primary)] shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-glass-border pb-4 mb-5">
            <h2 className="font-display text-lg font-bold text-[var(--text-bright)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--primary)]">
                {editing ? "edit" : "calendar_add_on"}
              </span>
              {editing ? "Edytuj wizytę" : "Nowa wizyta"}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[var(--muted)] hover:text-[var(--text-bright)]"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            {!editing && (
              <div className="space-y-3 sm:col-span-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode("existing");
                      setForm((f) => ({
                        ...f,
                        new_customer_name: "",
                        new_customer_phone: "",
                        new_customer_email: "",
                      }));
                    }}
                    disabled={customers.length === 0}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      clientMode === "existing"
                        ? "bg-[var(--primary-container)] text-white shadow"
                        : "border border-glass-border bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
                    }`}
                  >
                    Istniejący klient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientMode("new");
                      setForm((f) => ({ ...f, customer_id: "" }));
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      clientMode === "new"
                        ? "bg-[var(--primary-container)] text-white shadow"
                        : "border border-glass-border bg-[var(--surface-container)] text-[var(--muted)] hover:text-[var(--text-bright)]"
                    }`}
                  >
                    Nowy klient
                  </button>
                </div>

                {clientMode === "existing" ? (
                  <label className="block space-y-1.5 text-xs font-semibold text-[var(--muted)]">
                    <span>Wybierz klienta z bazy</span>
                    <GlassSelect
                      value={form.customer_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, customer_id: e.target.value }))
                      }
                      required
                    >
                      <option value="">— Wybierz klienta —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.id.slice(0, 8)} {c.phone ? `(${c.phone})` : ""}
                        </option>
                      ))}
                    </GlassSelect>
                  </label>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className="block space-y-1 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
                      <span>Imię i nazwisko klienta *</span>
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
                    <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                      <span>Telefon</span>
                      <GlassInput
                        type="tel"
                        value={form.new_customer_phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            new_customer_phone: e.target.value,
                          }))
                        }
                        placeholder="+48 123 456 789"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                      <span>E-mail</span>
                      <GlassInput
                        type="email"
                        value={form.new_customer_email}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            new_customer_email: e.target.value,
                          }))
                        }
                        placeholder="anna@example.com"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Usługa *</span>
              <GlassSelect
                value={form.service_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, service_id: e.target.value }))
                }
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_min} min · {s.price} PLN)
                  </option>
                ))}
              </GlassSelect>
            </label>

            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Przypisany specjalista</span>
              <GlassSelect
                value={form.staff_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, staff_id: e.target.value }))
                }
              >
                <option value="">Bez przypisania (dowolny)</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </GlassSelect>
            </label>

            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Termin i godzina *</span>
              <GlassInput
                type="datetime-local"
                value={form.start_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_at: e.target.value }))
                }
                required
              />
            </label>

            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)]">
              <span>Status</span>
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

            <label className="space-y-1.5 text-xs font-semibold text-[var(--muted)] sm:col-span-2">
              <span>Notatki do wizyty</span>
              <GlassTextarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Wskazówki, preferencje klienta..."
              />
            </label>

            <div className="flex gap-3 sm:col-span-2 pt-2">
              <GlassButton type="submit" variant="primary">
                <span className="material-symbols-outlined text-[18px]">check</span>
                {editing ? "Zapisz zmiany" : "Utwórz wizytę"}
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Anuluj
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* Appointments List / Table */}
      {loading ? (
        <GlassTableSkeleton rows={6} />
      ) : (
        <section className="glass-panel rounded-xl overflow-hidden shadow-2xl animate-fade-up">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[var(--muted)] font-semibold text-xs uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-3.5 px-6">Termin</th>
                  <th className="py-3.5 px-6">Klient</th>
                  <th className="py-3.5 px-6">Usługa</th>
                  <th className="py-3.5 px-6">Pracownik</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-6 text-center text-[var(--muted)]">
                      <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                        search_off
                      </span>
                      Brak wizyt pasujących do wybranych kryteriów.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((a) => {
                    const cust = customers.find((c) => c.id === a.customer_id);
                    const st = staff.find((s) => s.id === a.staff_id);
                    const startDate = new Date(a.start_at);
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="font-mono text-sm font-semibold text-[var(--text-bright)]">
                            {startDate.toLocaleDateString("pl-PL", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-xs text-[var(--muted)] font-mono">
                            {startDate.toLocaleTimeString("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface-solid)] border border-glass-border flex items-center justify-center text-[var(--primary)] font-bold text-xs shrink-0">
                              {getInitials(cust?.name || a.customer_name)}
                            </div>
                            <div>
                              <p className="font-semibold text-[var(--text-bright)]">
                                {cust?.name || a.customer_name || "Brak danych"}
                              </p>
                              {cust?.phone && (
                                <p className="text-xs text-[var(--muted)] font-mono">
                                  {cust.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-medium text-[var(--text-bright)]">
                            {a.service_name || "Usługa"}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-xs text-[var(--muted)]">
                            {st?.name || a.staff_name || "Dowolny pracownik"}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openEdit(a)}
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-white/5 rounded-lg transition-colors"
                              title="Edytuj wizytę"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                edit
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void notifyCustomer(a)}
                              disabled={a.status === "cancelled" || notifyingId === a.id}
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] hover:bg-white/5 rounded-lg transition-colors disabled:opacity-30"
                              title="Wyślij przypomnienie"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {notifyingId === a.id ? "sync" : "notifications_active"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void cancelAppt(a.id)}
                              disabled={a.status === "cancelled"}
                              className="p-1.5 text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30"
                              title="Anuluj wizytę"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                cancel
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

